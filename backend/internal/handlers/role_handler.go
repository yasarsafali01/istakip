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
	roles *repository.RoleRepo
	users *repository.UserRepo
	store *services.RoleStore
}

func NewRoleHandler(roles *repository.RoleRepo, users *repository.UserRepo, store *services.RoleStore) *RoleHandler {
	return &RoleHandler{roles: roles, users: users, store: store}
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
	// Built-in roles keep their data scope; only custom roles can change it.
	scope := models.Scope("")
	if !existing.IsSystem {
		if !validScopes[req.Scope] {
			response.Error(w, http.StatusBadRequest, "Geçersiz veri kapsamı")
			return
		}
		scope = req.Scope
	}

	if err := h.roles.Update(r.Context(), key, req.Name, strings.TrimSpace(req.Description), scope, perms); err != nil {
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
}

// AssignUserRole gives a user a role (and optionally a unit/project). A role
// with a unit or project scope needs the user to belong to one.
func (h *RoleHandler) AssignUserRole(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermRoleManage) {
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
	unitID, projectID := user.UnitID, user.ProjectID
	if req.UnitID != nil {
		unitID = req.UnitID
	}
	if req.ProjectID != nil {
		projectID = req.ProjectID
	}
	if def.Scope == models.ScopeUnit && unitID == nil {
		response.Error(w, http.StatusBadRequest, "Bu rol için kullanıcının bir birimi olmalı")
		return
	}
	if def.Scope == models.ScopeProject && projectID == nil {
		response.Error(w, http.StatusBadRequest, "Bu rol için kullanıcının bir projesi olmalı")
		return
	}

	updated, err := h.users.SetRole(r.Context(), id, req.Role, req.UnitID, req.ProjectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to assign role")
		return
	}
	_ = h.store.Reload(r.Context())
	response.JSON(w, http.StatusOK, updated)
}
