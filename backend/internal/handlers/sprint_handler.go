package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type SprintHandler struct {
	sprints  *repository.SprintRepo
	projects *repository.ProjectRepo
}

func NewSprintHandler(sprints *repository.SprintRepo, projects *repository.ProjectRepo) *SprintHandler {
	return &SprintHandler{sprints: sprints, projects: projects}
}

func canManageIssues(role models.Role) bool {
	return role == models.RoleSystemAdmin || role == models.RoleDepartmentHead || role == models.RoleProjectManager
}

func (h *SprintHandler) requireProjectAccess(r *http.Request, projectID uuid.UUID) (models.Project, bool) {
	claims, _ := authmw.CurrentClaims(r.Context())
	project, err := h.projects.GetByID(r.Context(), projectID)
	if err != nil {
		return models.Project{}, false
	}
	return project, canAccessProject(claims, project)
}

func (h *SprintHandler) List(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid project id")
		return
	}
	if _, ok := h.requireProjectAccess(r, projectID); !ok {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	sprints, err := h.sprints.ListByProject(r.Context(), projectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list sprints")
		return
	}
	response.JSON(w, http.StatusOK, sprints)
}

type createSprintRequest struct {
	Month int `json:"month"`
	Year  int `json:"year"`
}

func (h *SprintHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid project id")
		return
	}
	if !canManageIssues(claims.Role) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	if _, ok := h.requireProjectAccess(r, projectID); !ok {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req createSprintRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Month < 1 || req.Month > 12 || req.Year < 2000 {
		response.Error(w, http.StatusBadRequest, "geçerli bir month (1-12) ve year gerekli")
		return
	}

	start, end := services.CalculateSprintDates(req.Year, time.Month(req.Month))
	sprint := models.Sprint{
		ProjectID: projectID,
		Name:      services.SprintName(req.Year, time.Month(req.Month)),
		Month:     req.Month,
		Year:      req.Year,
		StartDate: start,
		EndDate:   end,
		Status:    models.SprintPlanned,
	}

	created, err := h.sprints.Create(r.Context(), sprint)
	if errors.Is(err, repository.ErrDuplicateSprint) {
		response.Error(w, http.StatusConflict, "Bu ay için sprint zaten mevcut")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create sprint")
		return
	}
	response.JSON(w, http.StatusCreated, created)
}

func (h *SprintHandler) Start(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, func(id uuid.UUID) (models.Sprint, error) {
		return h.sprints.Start(r.Context(), id)
	})
}

func (h *SprintHandler) Complete(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, func(id uuid.UUID) (models.Sprint, error) {
		return h.sprints.Complete(r.Context(), id)
	})
}

func (h *SprintHandler) transition(w http.ResponseWriter, r *http.Request, do func(uuid.UUID) (models.Sprint, error)) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !canManageIssues(claims.Role) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid sprint id")
		return
	}

	existing, err := h.sprints.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "sprint not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load sprint")
		return
	}
	if _, ok := h.requireProjectAccess(r, existing.ProjectID); !ok {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	updated, err := do(id)
	if errors.Is(err, repository.ErrActiveSprintExists) {
		response.Error(w, http.StatusConflict, "Zaten aktif bir sprint var")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update sprint")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}
