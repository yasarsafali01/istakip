package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type ActivityHandler struct {
	activities *repository.ActivityRepo
	issues     *repository.IssueRepo
	projects   *repository.ProjectRepo
}

func NewActivityHandler(activities *repository.ActivityRepo, issues *repository.IssueRepo, projects *repository.ProjectRepo) *ActivityHandler {
	return &ActivityHandler{activities: activities, issues: issues, projects: projects}
}

func (h *ActivityHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	issueID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}

	issue, err := h.issues.GetByID(r.Context(), issueID)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	project, err := h.projects.GetByID(r.Context(), issue.ProjectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load project")
		return
	}
	if !services.CanAccessIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	activities, err := h.activities.ListByIssue(r.Context(), issueID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list activities")
		return
	}
	response.JSON(w, http.StatusOK, activities)
}
