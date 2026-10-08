package handlers

import (
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

type RequestFormHandler struct {
	forms    *repository.RequestFormRepo
	projects *repository.ProjectRepo
}

func NewRequestFormHandler(forms *repository.RequestFormRepo, projects *repository.ProjectRepo) *RequestFormHandler {
	return &RequestFormHandler{forms: forms, projects: projects}
}

const errNoFormAccess = "Bu müdürlüğün talep formlarını düzenleme yetkiniz yok"

func canManageForms(claims *services.Claims, project models.Project) bool {
	return claims.Can(services.PermRequestForm) && services.CanAccessProject(claims, project)
}

func (h *RequestFormHandler) projectFromURL(w http.ResponseWriter, r *http.Request) (models.Project, bool) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid project id")
		return models.Project{}, false
	}
	project, err := h.projects.GetByID(r.Context(), projectID)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "project not found")
		return models.Project{}, false
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load project")
		return models.Project{}, false
	}
	return project, true
}

// managedForm loads /request-forms/{id} and checks the caller may edit it.
func (h *RequestFormHandler) managedForm(w http.ResponseWriter, r *http.Request) (models.RequestForm, bool) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid form id")
		return models.RequestForm{}, false
	}
	form, err := h.forms.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "Talep formu bulunamadı")
		return models.RequestForm{}, false
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load form")
		return models.RequestForm{}, false
	}
	project, err := h.projects.GetByID(r.Context(), form.ProjectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load project")
		return models.RequestForm{}, false
	}
	if !canManageForms(claims, project) {
		response.Error(w, http.StatusForbidden, errNoFormAccess)
		return models.RequestForm{}, false
	}
	return form, true
}

// List returns a project's forms with their questions. Anyone who may open
// requests can read any project's active forms — a requester picks the
// target project freely (issue Create allows it). ?all=1 additionally returns
// inactive forms, for managers only.
func (h *RequestFormHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	project, ok := h.projectFromURL(w, r)
	if !ok {
		return
	}
	if !claims.Can(services.PermRequestCreate) && !services.CanAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	includeInactive := r.URL.Query().Get("all") == "1" && canManageForms(claims, project)
	forms, err := h.forms.ListByProject(r.Context(), project.ID, includeInactive)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list forms")
		return
	}
	response.JSON(w, http.StatusOK, forms)
}

type formMetaRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    *bool  `json:"isActive"`
}

func (req *formMetaRequest) validate() (string, string, bool) {
	name := strings.TrimSpace(req.Name)
	return name, strings.TrimSpace(req.Description), name != ""
}

func (h *RequestFormHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	project, ok := h.projectFromURL(w, r)
	if !ok {
		return
	}
	if !canManageForms(claims, project) {
		response.Error(w, http.StatusForbidden, errNoFormAccess)
		return
	}
	var req formMetaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, desc, valid := req.validate()
	if !valid {
		response.Error(w, http.StatusBadRequest, "Form adı zorunludur")
		return
	}
	form, err := h.forms.Create(r.Context(), project.ID, name, desc)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create form")
		return
	}
	response.JSON(w, http.StatusCreated, form)
}

func (h *RequestFormHandler) Update(w http.ResponseWriter, r *http.Request) {
	form, ok := h.managedForm(w, r)
	if !ok {
		return
	}
	var req formMetaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name, desc, valid := req.validate()
	if !valid {
		response.Error(w, http.StatusBadRequest, "Form adı zorunludur")
		return
	}
	isActive := form.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	if err := h.forms.Update(r.Context(), form.ID, name, desc, isActive); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update form")
		return
	}
	h.respondForm(w, r, form.ID, http.StatusOK)
}

type saveQuestionsRequest struct {
	Questions []models.RequestQuestion `json:"questions"`
}

// ReplaceQuestions saves the form's whole question list at once (the builder
// edits it as one document).
func (h *RequestFormHandler) ReplaceQuestions(w http.ResponseWriter, r *http.Request) {
	form, ok := h.managedForm(w, r)
	if !ok {
		return
	}
	var req saveQuestionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	questions, err := services.NormalizeQuestions(req.Questions)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	err = h.forms.ReplaceQuestions(r.Context(), form.ID, questions)
	if errors.Is(err, repository.ErrQuestionFormMismatch) {
		response.Error(w, http.StatusBadRequest, "Geçersiz soru kimliği")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to save questions")
		return
	}
	h.respondForm(w, r, form.ID, http.StatusOK)
}

func (h *RequestFormHandler) Duplicate(w http.ResponseWriter, r *http.Request) {
	form, ok := h.managedForm(w, r)
	if !ok {
		return
	}
	copied, err := h.forms.Duplicate(r.Context(), form.ID, form.Name+" (kopya)")
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to duplicate form")
		return
	}
	response.JSON(w, http.StatusCreated, copied)
}

// Delete removes the form and its questions. Requests already opened with it
// keep their answers and form name (snapshots); only the link is cleared.
func (h *RequestFormHandler) Delete(w http.ResponseWriter, r *http.Request) {
	form, ok := h.managedForm(w, r)
	if !ok {
		return
	}
	if err := h.forms.Delete(r.Context(), form.ID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to delete form")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *RequestFormHandler) respondForm(w http.ResponseWriter, r *http.Request, id uuid.UUID, status int) {
	form, err := h.forms.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load form")
		return
	}
	response.JSON(w, status, form)
}
