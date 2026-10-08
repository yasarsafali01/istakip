package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type ProjectHandler struct {
	projects *repository.ProjectRepo
	units    *repository.UnitRepo
}

func NewProjectHandler(projects *repository.ProjectRepo, units *repository.UnitRepo) *ProjectHandler {
	return &ProjectHandler{projects: projects, units: units}
}

// List's role switch mirrors permissionUtils.js's getVisibleProjects:
// System_Admin sees everything, Department_Head their unit, Project_Manager
// what they manage, Worker their single assigned project, External_User
// nothing.
func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())

	var filter repository.ProjectFilter
	switch claims.Scope {
	case models.ScopeAll:
		// no filter
	case models.ScopeUnit:
		filter.UnitID = claims.UnitID
	case models.ScopeManager:
		uid := claims.UserID
		filter.ManagerID = &uid
	case models.ScopeProject:
		filter.OnlyID = claims.ProjectID
	case models.ScopeOwn:
		// no filter — a requester picks unit → project when opening a
		// request (issue Create already lets them target any project)
	default:
		filter.None = true
	}

	projects, err := h.projects.List(r.Context(), filter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list projects")
		return
	}
	response.JSON(w, http.StatusOK, projects)
}

func (h *ProjectHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid project id")
		return
	}

	project, err := h.projects.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "project not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load project")
		return
	}

	if !canAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	response.JSON(w, http.StatusOK, project)
}

type createProjectRequest struct {
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	UnitID       uuid.UUID `json:"unitId"`
	ManagerID    uuid.UUID `json:"managerId"`
	HasInventory bool      `json:"hasInventory"`
}

func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermProjectCreate) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		response.Error(w, http.StatusBadRequest, "Müdürlük adı zorunludur")
		return
	}

	unitID := req.UnitID
	if claims.Scope == models.ScopeUnit {
		// A unit-scoped role can only create within its own unit.
		if claims.UnitID == nil {
			response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
			return
		}
		unitID = *claims.UnitID
	}
	if req.ManagerID == uuid.Nil || unitID == uuid.Nil {
		response.Error(w, http.StatusBadRequest, "unitId ve managerId zorunludur")
		return
	}

	unit, err := h.units.GetByID(r.Context(), unitID)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusBadRequest, "geçersiz unitId")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load unit")
		return
	}

	count, err := h.projects.CountInUnit(r.Context(), unitID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to compute project key")
		return
	}
	key := unit.UnitCode
	if count > 0 {
		key = fmt.Sprintf("%s%d", unit.UnitCode, count+1)
	}

	project, err := h.projects.Create(r.Context(), key, req.Name, req.Description, unitID, req.ManagerID, req.HasInventory)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create project")
		return
	}
	response.JSON(w, http.StatusCreated, project)
}

type updateProjectRequest struct {
	Name         string     `json:"name"`
	Description  string     `json:"description"`
	ManagerID    *uuid.UUID `json:"managerId"`
	HasInventory *bool      `json:"hasInventory"`
}

func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid project id")
		return
	}

	project, err := h.projects.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "project not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load project")
		return
	}

	allowed := claims.Can(services.PermProjectEdit) &&
		(claims.Scope == models.ScopeAll ||
			(claims.Scope == models.ScopeUnit && claims.UnitID != nil && *claims.UnitID == project.UnitID))
	if !allowed {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req updateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updated, err := h.projects.Update(r.Context(), id, req.Name, req.Description, req.ManagerID, req.HasInventory)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update project")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

func canAccessProject(claims *services.Claims, project models.Project) bool {
	return services.CanAccessProject(claims, project)
}
