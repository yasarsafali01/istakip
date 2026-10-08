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

type ReplyTemplateHandler struct {
	templates *repository.ReplyTemplateRepo
	projects  *repository.ProjectRepo
}

func NewReplyTemplateHandler(templates *repository.ReplyTemplateRepo, projects *repository.ProjectRepo) *ReplyTemplateHandler {
	return &ReplyTemplateHandler{templates: templates, projects: projects}
}

// List returns active templates for a project; anyone with project access can
// read them (they're used to insert canned replies into a comment).
func (h *ReplyTemplateHandler) List(w http.ResponseWriter, r *http.Request) {
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
	if !services.CanAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	includeInactive := claims.Can(services.PermTemplateManage) && r.URL.Query().Get("all") == "1"
	kind := r.URL.Query().Get("kind")
	if kind != "" && kind != models.TemplateReply && kind != models.TemplateResolution {
		response.Error(w, http.StatusBadRequest, "geçersiz şablon türü")
		return
	}
	templates, err := h.templates.ListByProject(r.Context(), projectID, kind, includeInactive)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list templates")
		return
	}
	response.JSON(w, http.StatusOK, templates)
}

type templateRequest struct {
	Kind      string `json:"kind"` // create only; "" = reply
	Title     string `json:"title"`
	Body      string `json:"body"`
	SortOrder int    `json:"sortOrder"`
	IsActive  *bool  `json:"isActive"`
}

func (h *ReplyTemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermTemplateManage) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
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
	if !services.CanAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req templateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	title := strings.TrimSpace(req.Title)
	body := strings.TrimSpace(req.Body)
	if title == "" || body == "" {
		response.Error(w, http.StatusBadRequest, "Başlık ve şablon metni zorunludur")
		return
	}

	kind := req.Kind
	if kind == "" {
		kind = models.TemplateReply
	}
	if kind != models.TemplateReply && kind != models.TemplateResolution {
		response.Error(w, http.StatusBadRequest, "geçersiz şablon türü")
		return
	}
	created, err := h.templates.Create(r.Context(), projectID, kind, title, body, req.SortOrder)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create template")
		return
	}
	response.JSON(w, http.StatusCreated, created)
}

func (h *ReplyTemplateHandler) mustManage(r *http.Request) (uuid.UUID, error) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		return uuid.Nil, err
	}
	tmpl, err := h.templates.GetByID(r.Context(), id)
	if err != nil {
		return uuid.Nil, err
	}
	project, err := h.projects.GetByID(r.Context(), tmpl.ProjectID)
	if err != nil {
		return uuid.Nil, err
	}
	if !claims.Can(services.PermTemplateManage) || !services.CanAccessProject(claims, project) {
		return uuid.Nil, errForbidden
	}
	return id, nil
}

func (h *ReplyTemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := h.mustManage(r)
	if err != nil {
		respondTeamErr(w, err)
		return
	}
	var req templateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	title := strings.TrimSpace(req.Title)
	body := strings.TrimSpace(req.Body)
	if title == "" || body == "" {
		response.Error(w, http.StatusBadRequest, "Başlık ve şablon metni zorunludur")
		return
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	updated, err := h.templates.Update(r.Context(), id, title, body, req.SortOrder, isActive)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update template")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

func (h *ReplyTemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := h.mustManage(r)
	if err != nil {
		respondTeamErr(w, err)
		return
	}
	if err := h.templates.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to delete template")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
