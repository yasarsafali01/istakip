package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type RoleHandler struct {
	roles    *repository.RoleRepo
	users    *repository.UserRepo
	projects *repository.ProjectRepo
	store    *services.RoleStore
}

func NewRoleHandler(roles *repository.RoleRepo, users *repository.UserRepo, projects *repository.ProjectRepo, store *services.RoleStore) *RoleHandler {
	return &RoleHandler{roles: roles, users: users, projects: projects, store: store}
}

const forbiddenMsg = "Bu sayfaya erişim yetkiniz bulunmamaktadır"

var validScopes = map[models.Scope]bool{
	models.ScopeAll: true, models.ScopeUnit: true, models.ScopeManager: true,
	models.ScopeProject: true, models.ScopeOwn: true,
}

// Permissions returns the fixed permission catalog (used by the role editor).
func (h *RoleHandler) Permissions(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, services.PermissionCatalog)
}

// List returns every role. Readable by any signed-in user (role names are shown
// in user lists); editing is guarded by role.manage.
func (h *RoleHandler) List(w http.ResponseWriter, r *http.Request) {
	roles, err := h.roles.List(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list roles")
		return
	}
	response.JSON(w, http.StatusOK, roles)
}

type roleRequest struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Scope       models.Scope `json:"scope"`
	Level       int          `json:"level"`
	Permissions []string     `json:"permissions"`
}

// cleanPermissions drops duplicates and rejects unknown keys.
func cleanPermissions(in []string) ([]string, bool) {
	seen := map[string]bool{}
	out := []string{}
	for _, p := range in {
		if !services.ValidPermission(p) {
			return nil, false
		}
		if !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	return out, true
}

func (h *RoleHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermRoleManage) {
		response.Error(w, http.StatusForbidden, forbiddenMsg)
		return
	}
	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		response.Error(w, http.StatusBadRequest, "Rol adı zorunludur")
		return
	}
	if !validScopes[req.Scope] {
		response.Error(w, http.StatusBadRequest, "Geçersiz veri kapsamı")
		return
	}
	if req.Level <= 0 || req.Level >= 100 {
		response.Error(w, http.StatusBadRequest, "Seviye 1-99 arasında olmalıdır (100, Sistem Yöneticisi için ayrılmıştır)")
		return
	}
	perms, ok := cleanPermissions(req.Permissions)
	if !ok {
		response.Error(w, http.StatusBadRequest, "Geçersiz izin")
		return
	}

	suffix := make([]byte, 4)
	_, _ = rand.Read(suffix)
	def := models.RoleDef{
		Key:         models.Role("role_" + hex.EncodeToString(suffix)),
		Name:        req.Name,
		Description: strings.TrimSpace(req.Description),
		Scope:       req.Scope,
		Level:       req.Level,
		Permissions: perms,
	}
	if err := h.roles.Create(r.Context(), def); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create role")
		return
	}
	_ = h.store.Reload(r.Context())
	created, _ := h.roles.Get(r.Context(), def.Key)
	response.JSON(w, http.StatusCreated, created)
}

func (h *RoleHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermRoleManage) {
		response.Error(w, http.StatusForbidden, forbiddenMsg)
		return
	}
	key := models.Role(chi.URLParam(r, "key"))
	existing, err := h.roles.Get(r.Context(), key)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "role not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load role")
		return
	}
	// The admin role is locked so nobody can lock themselves out of role management.
	if existing.Key == models.RoleSystemAdmin {
		response.Error(w, http.StatusForbidden, "Sistem Yöneticisi rolü değiştirilemez")
		return
	}

	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		response.Error(w, http.StatusBadRequest, "Rol adı zorunludur")
		return
	}
	perms, ok := cleanPermissions(req.Permissions)
	if !ok {
		response.Error(w, http.StatusBadRequest, "Geçersiz izin")
		return
	}
	// Built-in roles keep their data scope and level; only custom roles can change them.
	scope := models.Scope("")
	var level *int
	if !existing.IsSystem {
		if !validScopes[req.Scope] {
			response.Error(w, http.StatusBadRequest, "Geçersiz veri kapsamı")
			return
		}
		scope = req.Scope
		if req.Level <= 0 || req.Level >= 100 {
			response.Error(w, http.StatusBadRequest, "Seviye 1-99 arasında olmalıdır (100, Sistem Yöneticisi için ayrılmıştır)")
			return
		}
		level = &req.Level
	}

	if err := h.roles.Update(r.Context(), key, req.Name, strings.TrimSpace(req.Description), scope, level, perms); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update role")
		return
	}
	_ = h.store.Reload(r.Context())
	updated, _ := h.roles.Get(r.Context(), key)
	response.JSON(w, http.StatusOK, updated)
}

func (h *RoleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermRoleManage) {
		response.Error(w, http.StatusForbidden, forbiddenMsg)
		return
	}
	key := models.Role(chi.URLParam(r, "key"))
	err := h.roles.Delete(r.Context(), key)
	switch {
	case errors.Is(err, repository.ErrRoleInUse):
		response.Error(w, http.StatusConflict, "Bu role atanmış kullanıcılar var; önce onların rolünü değiştirin")
		return
	case errors.Is(err, repository.ErrNotFound):
		response.Error(w, http.StatusNotFound, "Rol bulunamadı veya yerleşik rol silinemez")
		return
	case err != nil:
		response.Error(w, http.StatusInternalServerError, "failed to delete role")
		return
	}
	_ = h.store.Reload(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

type assignRoleRequest struct {
	Role      models.Role `json:"role"`
	UnitID    *uuid.UUID  `json:"unitId"`
	ProjectID *uuid.UUID  `json:"projectId"`
	// Additional roles; nil keeps the user's current extra roles unchanged.
	ExtraRoles *[]models.Role `json:"extraRoles"`
}

// AssignUserRole gives a user a role, delegated down the org chart: the
// caller must have management authority over the target user (their own
// scope — unit for Department_Head, managed projects for Project_Manager,
// everyone for System_Admin) AND the new role must be strictly weaker than
// the caller's own role (services.CanAssignRoleLevel) — so nobody can ever
// hand out a role at or above their own rank, e.g. a Project_Manager can
// never grant a Department_Head-level role even to their own team member.
// Only a scope="all" caller (System_Admin) may also move the user between
// units/projects in the same call.
func (h *RoleHandler) AssignUserRole(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermAssignUserRole) {
		response.Error(w, http.StatusForbidden, forbiddenMsg)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if id == claims.UserID {
		response.Error(w, http.StatusBadRequest, "Kendi rolünüzü değiştiremezsiniz")
		return
	}
	var req assignRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	def, ok := h.store.Get(req.Role)
	if !ok {
		response.Error(w, http.StatusBadRequest, "Geçersiz rol")
		return
	}

	user, err := h.users.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load user")
		return
	}

	// Management-scope check: is this user even in the caller's org chart?
	var targetProject *models.Project
	if claims.Scope == models.ScopeManager && user.ProjectID != nil {
		p, err := h.projects.GetByID(r.Context(), *user.ProjectID)
		if err == nil {
			targetProject = &p
		}
	}
	if !services.CanManageUser(claims, user, targetProject) {
		response.Error(w, http.StatusForbidden, "Bu kullanıcı yönetim alanınızın dışında")
		return
	}

	// Hierarchy check: the new role(s) and the user's current effective level
	// (highest of all their roles) must be strictly weaker than the caller's
	// own — reject escalation attempts before touching anything.
	current, ok := h.store.Resolve(user.Role, user.ExtraRoles)
	if !ok {
		response.Error(w, http.StatusInternalServerError, "failed to resolve current role")
		return
	}
	if !services.CanAssignRoleLevel(claims.Level, def.Level, current.Level) {
		response.Error(w, http.StatusForbidden, "Bu rolü atamak için yetkiniz yetersiz")
		return
	}

	// Extra roles: de-duplicated, never repeating the primary, each one also
	// strictly below the caller's level.
	var extras []models.Role
	if req.ExtraRoles != nil {
		seen := map[models.Role]bool{req.Role: true}
		for _, key := range *req.ExtraRoles {
			if seen[key] {
				continue
			}
			seen[key] = true
			d, ok := h.store.Get(key)
			if !ok {
				response.Error(w, http.StatusBadRequest, "Geçersiz ek rol")
				return
			}
			if d.Level >= claims.Level {
				response.Error(w, http.StatusForbidden, "\""+d.Name+"\" rolünü atamak için yetkiniz yetersiz")
				return
			}
			extras = append(extras, key)
		}
	}

	// Only a system-wide (scope=all) caller may relocate the user between
	// units/projects in the same call — a scoped manager can only change the role.
	if claims.Scope != models.ScopeAll {
		req.UnitID, req.ProjectID = nil, nil
	}
	unitID, projectID := user.UnitID, user.ProjectID
	if req.UnitID != nil {
		unitID = req.UnitID
	}
	if req.ProjectID != nil {
		projectID = req.ProjectID
	}
	needsUnit, needsProject := def.Scope == models.ScopeUnit, def.Scope == models.ScopeProject
	for _, key := range extras {
		d, _ := h.store.Get(key)
		needsUnit = needsUnit || d.Scope == models.ScopeUnit
		needsProject = needsProject || d.Scope == models.ScopeProject
	}
	if needsUnit && unitID == nil {
		response.Error(w, http.StatusBadRequest, "Bu rol için kullanıcının bir daire başkanlığı olmalı")
		return
	}
	if needsProject && projectID == nil {
		response.Error(w, http.StatusBadRequest, "Bu rol için kullanıcının bir müdürlüğü olmalı")
		return
	}

	if req.ExtraRoles != nil {
		if err := h.users.SetExtraRoles(r.Context(), id, extras); err != nil {
			response.Error(w, http.StatusInternalServerError, "failed to assign extra roles")
			return
		}
	} else {
		// Keep current extras, minus the new primary so it isn't listed twice.
		for _, key := range user.ExtraRoles {
			if key != req.Role {
				extras = append(extras, key)
			}
		}
		if len(extras) != len(user.ExtraRoles) {
			if err := h.users.SetExtraRoles(r.Context(), id, extras); err != nil {
				response.Error(w, http.StatusInternalServerError, "failed to assign extra roles")
				return
			}
		}
	}
	updated, err := h.users.SetRole(r.Context(), id, req.Role, req.UnitID, req.ProjectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to assign role")
		return
	}
	_ = h.store.Reload(r.Context())
	response.JSON(w, http.StatusOK, updated)
}
