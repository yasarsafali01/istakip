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

type IssueHandler struct {
	issues     *repository.IssueRepo
	projects   *repository.ProjectRepo
	activities *repository.ActivityRepo
}

func NewIssueHandler(issues *repository.IssueRepo, projects *repository.ProjectRepo, activities *repository.ActivityRepo) *IssueHandler {
	return &IssueHandler{issues: issues, projects: projects, activities: activities}
}

func isWorker(role models.Role) bool       { return role == models.RoleWorker }
func isExternalUser(role models.Role) bool { return role == models.RoleExternalUser }

// canEditIssue mirrors IssueDetailContent.jsx's canEdit (see
// .kiro/specs/jira-clone-frontend/design.md): Worker never; External_User
// only on their own request; others per project access.
func canEditIssue(claims *services.Claims, issue models.Issue, project models.Project) bool {
	if isWorker(claims.Role) {
		return false
	}
	isOwnRequest := issue.IsRequest && issue.ReporterID == claims.UserID
	if isExternalUser(claims.Role) && !isOwnRequest {
		return false
	}
	return services.CanAccessIssue(claims, issue, project)
}

// canChangeStatus: Worker may only move status (not edit fields);
// Admin/DeptHead/PM can too. External_User cannot change status.
func canChangeStatus(claims *services.Claims, issue models.Issue, project models.Project) bool {
	if !services.CanAccessIssue(claims, issue, project) {
		return false
	}
	return canManageIssues(claims.Role) || isWorker(claims.Role)
}

func (h *IssueHandler) loadWithProject(r *http.Request, id uuid.UUID) (models.Issue, models.Project, error) {
	issue, err := h.issues.GetByID(r.Context(), id)
	if err != nil {
		return models.Issue{}, models.Project{}, err
	}
	project, err := h.projects.GetByID(r.Context(), issue.ProjectID)
	return issue, project, err
}

func (h *IssueHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	q := r.URL.Query()

	filter := repository.IssueFilter{Priority: q.Get("priority")}
	if v := q.Get("projectId"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.ProjectID = &id
		}
	}
	if q.Get("backlog") == "true" {
		filter.BacklogOnly = true
	} else if v := q.Get("sprintId"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.SprintID = &id
		}
	}
	if v := q.Get("isRequest"); v != "" {
		b := v == "true"
		filter.IsRequest = &b
	}
	if v := q.Get("assigneeId"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.AssigneeID = &id
		}
	}

	issues, err := h.issues.List(r.Context(), services.IssueScopeFor(claims), filter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list issues")
		return
	}
	if issues == nil {
		issues = []models.Issue{}
	}
	response.JSON(w, http.StatusOK, issues)
}

func (h *IssueHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !services.CanAccessIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	response.JSON(w, http.StatusOK, issue)
}

type createIssueRequest struct {
	ProjectID   uuid.UUID  `json:"projectId"`
	SprintID    *uuid.UUID `json:"sprintId"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Type        string     `json:"type"`
	Priority    string     `json:"priority"`
	AssigneeID  *uuid.UUID `json:"assigneeId"`
	IsRequest   bool       `json:"isRequest"`
}

func (h *IssueHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())

	var req createIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if !req.IsRequest && !canManageIssues(claims.Role) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	if req.IsRequest && !isExternalUser(claims.Role) && !canManageIssues(claims.Role) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	if req.Title == "" {
		msg := "Başlık zorunludur"
		if req.IsRequest {
			msg = "Talep başlığı zorunludur"
		}
		response.Error(w, http.StatusBadRequest, msg)
		return
	}
	if req.ProjectID == uuid.Nil {
		response.Error(w, http.StatusBadRequest, "projectId zorunludur")
		return
	}

	project, err := h.projects.GetByID(r.Context(), req.ProjectID)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusBadRequest, "geçersiz projectId")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load project")
		return
	}
	// External_User may target any project (they pick unit → project on the
	// request form); everyone else needs ordinary project access.
	if !isExternalUser(claims.Role) && !canAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	priority := req.Priority
	if priority == "" {
		priority = "Medium"
	}
	issueType := req.Type
	if req.IsRequest {
		issueType = "Request"
	} else if issueType == "" {
		issueType = "Task"
	}

	created, err := h.issues.Create(r.Context(), repository.NewIssue{
		ProjectID:   req.ProjectID,
		SprintID:    req.SprintID,
		Title:       req.Title,
		Description: req.Description,
		Type:        issueType,
		Priority:    priority,
		AssigneeID:  req.AssigneeID,
		ReporterID:  claims.UserID,
		IsRequest:   req.IsRequest,
	})
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create issue")
		return
	}

	if err := h.activities.Create(r.Context(), created.ID, claims.UserID, "created", "Issue oluşturuldu"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}

	response.JSON(w, http.StatusCreated, created)
}

type updateIssueRequest struct {
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Type        *string    `json:"type"`
	Priority    *string    `json:"priority"`
	ProjectID   *uuid.UUID `json:"projectId"`
}

func (h *IssueHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !canEditIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req updateIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title != nil && *req.Title == "" {
		response.Error(w, http.StatusBadRequest, "Başlık zorunludur")
		return
	}

	updated, err := h.issues.Update(r.Context(), id, repository.IssueUpdate{
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		Priority:    req.Priority,
		ProjectID:   req.ProjectID,
	})
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update issue")
		return
	}

	if err := h.activities.Create(r.Context(), id, claims.UserID, "field_update", "Talep alanları güncellendi"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func (h *IssueHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !canChangeStatus(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req updateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Status == "Done" {
		response.Error(w, http.StatusBadRequest, "Done durumuna geçiş için POST /issues/{id}/complete kullanın")
		return
	}
	validStatuses := map[string]bool{"To Do": true, "In Progress": true, "In Review": true, "Geri Çevrildi": true}
	if !validStatuses[req.Status] {
		response.Error(w, http.StatusBadRequest, "geçersiz status")
		return
	}

	updated, err := h.issues.SetStatus(r.Context(), id, req.Status)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	desc := `Durum "` + issue.Status + `" → "` + req.Status + `" olarak değiştirildi`
	if err := h.activities.Create(r.Context(), id, claims.UserID, "status_change", desc); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

type completeRequest struct {
	ResolutionNote string     `json:"resolutionNote"`
	UsedEquipment  bool       `json:"usedEquipment"`
	EquipmentID    *uuid.UUID `json:"equipmentId"`
	Quantity       int        `json:"quantity"`
}

func (h *IssueHandler) Complete(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !canChangeStatus(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req completeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	note := req.ResolutionNote
	if len(note) < 10 || len(note) > 2000 {
		response.Error(w, http.StatusBadRequest, "Çözüm notu 10-2000 karakter olmalıdır")
		return
	}
	if req.UsedEquipment {
		if !project.HasInventory {
			response.Error(w, http.StatusBadRequest, "bu projede envanter takibi etkin değil")
			return
		}
		if req.EquipmentID == nil || req.Quantity <= 0 {
			response.Error(w, http.StatusBadRequest, "teçhizat seçildiğinde equipmentId ve pozitif bir quantity zorunludur")
			return
		}
	}

	params := repository.CompleteParams{
		IssueID:        id,
		ResolutionNote: note,
		ResolverID:     claims.UserID,
	}
	if req.UsedEquipment {
		params.InventoryItemID = req.EquipmentID
		params.InventoryUsedQty = req.Quantity
	}

	result, err := h.issues.Complete(r.Context(), params)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to complete issue")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"issue":        result.Issue,
		"stockWarning": result.StockWarning,
	})
}

type updateAssigneeRequest struct {
	AssigneeID *uuid.UUID `json:"assigneeId"`
}

func (h *IssueHandler) UpdateAssignee(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !services.CanChangeAssignee(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req updateAssigneeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updated, err := h.issues.SetAssignee(r.Context(), id, req.AssigneeID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update assignee")
		return
	}

	if err := h.activities.Create(r.Context(), id, claims.UserID, "assignment", "Atama değiştirildi"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

func (h *IssueHandler) Clone(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	isOwnRequest := issue.IsRequest && issue.ReporterID == claims.UserID
	if !canManageIssues(claims.Role) && !isOwnRequest {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	if !services.CanAccessIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	cloned, err := h.issues.Clone(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to clone issue")
		return
	}
	if err := h.activities.Create(r.Context(), cloned.ID, claims.UserID, "created", "Issue klonlandı"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	response.JSON(w, http.StatusCreated, cloned)
}

type moveSprintRequest struct {
	SprintID *uuid.UUID `json:"sprintId"` // nil = move to backlog
}

func (h *IssueHandler) MoveSprint(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !canManageIssues(claims.Role) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	_, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !canAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req moveSprintRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updated, err := h.issues.SetSprint(r.Context(), id, req.SprintID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to move issue")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

type updateDatesRequest struct {
	ResolvedAt *string `json:"resolvedAt"` // ISO8601, null to clear
	TimeSpent  int     `json:"timeSpent"`
}

// UpdateDates lets Admin/DeptHead/PM adjust resolvedAt/timeSpent
// independently of a status transition (Requirement 19.5/19.6).
// External_User is never allowed (Requirement 19.7).
func (h *IssueHandler) UpdateDates(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !canManageIssues(claims.Role) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !services.CanAccessIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req updateDatesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TimeSpent < 0 {
		response.Error(w, http.StatusBadRequest, "Harcanan zaman negatif olamaz")
		return
	}

	var resolvedAt *time.Time
	if req.ResolvedAt != nil && *req.ResolvedAt != "" {
		t, err := time.Parse(time.RFC3339, *req.ResolvedAt)
		if err != nil {
			response.Error(w, http.StatusBadRequest, "geçersiz resolvedAt")
			return
		}
		if t.Before(issue.CreatedAt) {
			response.Error(w, http.StatusBadRequest, "resolvedAt, createdAt tarihinden önce olamaz")
			return
		}
		resolvedAt = &t
	}

	updated, err := h.issues.SetDates(r.Context(), id, resolvedAt, req.TimeSpent)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update dates")
		return
	}
	if err := h.activities.Create(r.Context(), id, claims.UserID, "field_update", "Tarih/zaman bilgisi güncellendi"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

type addVisibleUserRequest struct {
	UserID uuid.UUID `json:"userId"`
}

// AddVisibleUser lets non-External_User roles grant an External_User
// visibility into a request (Requirement 5.9).
func (h *IssueHandler) AddVisibleUser(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if isExternalUser(claims.Role) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !services.CanAccessIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req addVisibleUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == uuid.Nil {
		response.Error(w, http.StatusBadRequest, "userId zorunludur")
		return
	}

	if err := h.issues.AddVisibleUser(r.Context(), id, req.UserID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to add visible user")
		return
	}
	updated, err := h.issues.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

func (h *IssueHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return
	}
	if !canEditIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	if err := h.issues.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to delete issue")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
