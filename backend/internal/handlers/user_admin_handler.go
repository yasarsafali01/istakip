package handlers

import (
	"encoding/json"
	"errors"
	"math/rand"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

// UserAdminHandler lets a Daire Başkanı manage the personnel of their own
// daire başkanlığı: add users, edit them (including team memberships across
// the unit's müdürlükler) and deactivate them. Only callers whose scope is
// the unit may use it; everyone else keeps role assignment only.
type UserAdminHandler struct {
	users    *repository.UserRepo
	projects *repository.ProjectRepo
	teams    *repository.TeamRepo
	store    *services.RoleStore
}

func NewUserAdminHandler(users *repository.UserRepo, projects *repository.ProjectRepo, teams *repository.TeamRepo, store *services.RoleStore) *UserAdminHandler {
	return &UserAdminHandler{users: users, projects: projects, teams: teams, store: store}
}

const minPasswordLen = 6

var avatarColors = []string{"#0052CC", "#00875A", "#FF5630", "#6554C0", "#00B8D9", "#FF991F", "#36B37E", "#2684FF"}

func isUnitAdmin(c *services.Claims) bool {
	return c.Scope == models.ScopeUnit && c.UnitID != nil && c.Can(services.PermAssignUserRole)
}

// unitProjects de-duplicates the requested müdürlükler and checks that there
// is at least one and that all belong to the caller's daire başkanlığı.
func (h *UserAdminHandler) unitProjects(r *http.Request, c *services.Claims, ids []uuid.UUID) ([]uuid.UUID, bool) {
	seen := map[uuid.UUID]bool{}
	out := []uuid.UUID{}
	for _, id := range ids {
		if seen[id] {
			continue
		}
		seen[id] = true
		p, err := h.projects.GetByID(r.Context(), id)
		if err != nil || p.UnitID != *c.UnitID {
			return nil, false
		}
		out = append(out, id)
	}
	return out, len(out) > 0
}

// loadManagedUser returns the target user if the caller may manage them:
// same daire başkanlığı, active, not the caller, and ranked below the caller.
func (h *UserAdminHandler) loadManagedUser(w http.ResponseWriter, r *http.Request, c *services.Claims) (models.User, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid user id")
		return models.User{}, false
	}
	if id == c.UserID {
		response.Error(w, http.StatusBadRequest, "Kendi hesabınızı buradan değiştiremezsiniz")
		return models.User{}, false
	}
	user, err := h.users.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) || (err == nil && !user.IsActive) {
		response.Error(w, http.StatusNotFound, "Kullanıcı bulunamadı")
		return models.User{}, false
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load user")
		return models.User{}, false
	}
	if user.UnitID == nil || *user.UnitID != *c.UnitID {
		response.Error(w, http.StatusForbidden, "Bu kullanıcı yönetim alanınızın dışında")
		return models.User{}, false
	}
	current, ok := h.store.Resolve(user.Role, user.ExtraRoles)
	if !ok || current.Level >= c.Level {
		response.Error(w, http.StatusForbidden, "Bu kullanıcıyı yönetmek için yetkiniz yetersiz")
		return models.User{}, false
	}
	return user, true
}

func (h *UserAdminHandler) respondTeamsErr(w http.ResponseWriter, err error) {
	if errors.Is(err, repository.ErrTeamOutsideUnit) {
		response.Error(w, http.StatusBadRequest, "Yalnızca kendi daire başkanlığınızın ekipleri seçilebilir")
		return
	}
	response.Error(w, http.StatusInternalServerError, "failed to save teams")
}

type createUserRequest struct {
	Name      string      `json:"name"`
	Email     string      `json:"email"`
	Password  string      `json:"password"`
	Role       models.Role `json:"role"`
	ProjectIDs []uuid.UUID `json:"projectIds"` // first = primary müdürlük
	TeamIDs    []uuid.UUID `json:"teamIds"`
}

func (h *UserAdminHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !isUnitAdmin(claims) {
		response.Error(w, http.StatusForbidden, forbiddenMsg)
		return
	}
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, email := strings.TrimSpace(req.Name), strings.TrimSpace(strings.ToLower(req.Email))
	switch {
	case name == "":
		response.Error(w, http.StatusBadRequest, "Ad soyad zorunludur")
		return
	case !strings.Contains(email, "@"):
		response.Error(w, http.StatusBadRequest, "Geçerli bir e-posta girin")
		return
	case len(req.Password) < minPasswordLen:
		response.Error(w, http.StatusBadRequest, "Şifre en az 6 karakter olmalı")
		return
	}
	projectIDs, ok := h.unitProjects(r, claims, req.ProjectIDs)
	if !ok {
		response.Error(w, http.StatusBadRequest, "Daire başkanlığınıza ait en az bir müdürlük seçin")
		return
	}
	def, ok := h.store.Get(req.Role)
	if !ok {
		response.Error(w, http.StatusBadRequest, "Geçersiz rol")
		return
	}
	if def.Level >= claims.Level {
		response.Error(w, http.StatusForbidden, "Bu rolü atamak için yetkiniz yetersiz")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to hash password")
		return
	}
	user, err := h.users.Create(r.Context(), repository.NewUser{
		Name: name, Email: email, PasswordHash: string(hash), Role: req.Role,
		UnitID: claims.UnitID, ProjectIDs: projectIDs,
		AvatarColor: avatarColors[rand.Intn(len(avatarColors))],
	})
	if errors.Is(err, repository.ErrEmailTaken) {
		response.Error(w, http.StatusConflict, "Bu e-posta ile kayıtlı bir kullanıcı zaten var")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}
	if len(req.TeamIDs) > 0 {
		if err := h.teams.SetUserTeams(r.Context(), user.ID, *claims.UnitID, req.TeamIDs); err != nil {
			h.respondTeamsErr(w, err)
			return
		}
	}
	// New users must be in the role store before their first request.
	_ = h.store.Reload(r.Context())
	response.JSON(w, http.StatusCreated, user)
}

type updateUserRequest struct {
	Name      string       `json:"name"`
	Email      string       `json:"email"`
	ProjectIDs []uuid.UUID  `json:"projectIds"` // first = primary müdürlük
	Password   string       `json:"password"`   // empty = unchanged
	TeamIDs    *[]uuid.UUID `json:"teamIds"`    // nil = unchanged
}

func (h *UserAdminHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !isUnitAdmin(claims) {
		response.Error(w, http.StatusForbidden, forbiddenMsg)
		return
	}
	user, ok := h.loadManagedUser(w, r, claims)
	if !ok {
		return
	}
	var req updateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, email := strings.TrimSpace(req.Name), strings.TrimSpace(strings.ToLower(req.Email))
	switch {
	case name == "":
		response.Error(w, http.StatusBadRequest, "Ad soyad zorunludur")
		return
	case !strings.Contains(email, "@"):
		response.Error(w, http.StatusBadRequest, "Geçerli bir e-posta girin")
		return
	case req.Password != "" && len(req.Password) < minPasswordLen:
		response.Error(w, http.StatusBadRequest, "Şifre en az 6 karakter olmalı")
		return
	}
	projectIDs, valid := h.unitProjects(r, claims, req.ProjectIDs)
	if !valid {
		response.Error(w, http.StatusBadRequest, "Daire başkanlığınıza ait en az bir müdürlük seçin")
		return
	}

	updated, err := h.users.UpdateDetails(r.Context(), user.ID, name, email, projectIDs)
	if errors.Is(err, repository.ErrEmailTaken) {
		response.Error(w, http.StatusConflict, "Bu e-posta ile kayıtlı bir kullanıcı zaten var")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update user")
		return
	}
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			response.Error(w, http.StatusInternalServerError, "failed to hash password")
			return
		}
		if err := h.users.UpdatePasswordHash(r.Context(), user.ID, string(hash)); err != nil {
			response.Error(w, http.StatusInternalServerError, "failed to update password")
			return
		}
	}
	if req.TeamIDs != nil {
		if err := h.teams.SetUserTeams(r.Context(), user.ID, *claims.UnitID, *req.TeamIDs); err != nil {
			h.respondTeamsErr(w, err)
			return
		}
	}
	response.JSON(w, http.StatusOK, updated)
}

// Deactivate is the "delete" action: the user can no longer sign in and
// leaves all teams, but their past issues and comments keep their name.
func (h *UserAdminHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !isUnitAdmin(claims) {
		response.Error(w, http.StatusForbidden, forbiddenMsg)
		return
	}
	user, ok := h.loadManagedUser(w, r, claims)
	if !ok {
		return
	}
	managerID := user.ID
	managed, err := h.projects.List(r.Context(), repository.ProjectFilter{ManagerID: &managerID})
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to check projects")
		return
	}
	if len(managed) > 0 {
		response.Error(w, http.StatusConflict,
			"\""+user.Name+"\" "+managed[0].Name+" müdürü. Silmeden önce müdürlüğe başka bir müdür atayın")
		return
	}
	if err := h.users.Deactivate(r.Context(), user.ID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to delete user")
		return
	}
	// Drops the user from the role store, so their open access token stops working too.
	_ = h.store.Reload(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

type projectMembersRequest struct {
	UserIDs []uuid.UUID `json:"userIds"`
}

// SetProjectMembers sets a müdürlük's personnel from the müdürlük form
// (Yeni Müdürlük / Müdürlük Bilgileri). Anyone active in the müdürlük's daire
// başkanlığı can be picked; a person can serve in several müdürlükler.
func (h *UserAdminHandler) SetProjectMembers(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid project id")
		return
	}
	project, err := h.projects.GetByID(r.Context(), projectID)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "project not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load project")
		return
	}
	if !claims.Can(services.PermProjectEdit) || !services.CanAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, forbiddenMsg)
		return
	}
	var req projectMembersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserIDs == nil {
		req.UserIDs = []uuid.UUID{}
	}
	if err := h.users.SetProjectMembers(r.Context(), projectID, project.UnitID, req.UserIDs); err != nil {
		if errors.Is(err, repository.ErrUserOutsideUnit) {
			response.Error(w, http.StatusBadRequest, "Yalnızca bu daire başkanlığının aktif personeli seçilebilir")
			return
		}
		response.Error(w, http.StatusInternalServerError, "failed to save personnel")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
