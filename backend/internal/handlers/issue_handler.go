package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
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
	users      *repository.UserRepo
	notifier   *services.Notifier
	forms      *repository.RequestFormRepo
	files      *repository.FileRepo
}

func NewIssueHandler(issues *repository.IssueRepo, projects *repository.ProjectRepo, activities *repository.ActivityRepo, users *repository.UserRepo, notifier *services.Notifier, forms *repository.RequestFormRepo, files *repository.FileRepo) *IssueHandler {
	return &IssueHandler{issues: issues, projects: projects, activities: activities, users: users, notifier: notifier, forms: forms, files: files}
}

// canModifyIssue: the role must hold the permission (issue.edit / issue.delete)
// and the issue must be in its scope. An "own"-scope role (external requester)
// may only touch a request it opened itself.
func canModifyIssue(claims *services.Claims, permission string, issue models.Issue, project models.Project) bool {
	if !claims.Can(permission) {
		return false
	}
	isOwnRequest := issue.IsRequest && issue.ReporterID == claims.UserID
	if claims.Scope == models.ScopeOwn && !isOwnRequest {
		return false
	}
	return services.CanAccessIssue(claims, issue, project)
}

func canEditIssue(claims *services.Claims, issue models.Issue, project models.Project) bool {
	return canModifyIssue(claims, services.PermIssueEdit, issue, project)
}

// canChangeStatus needs the issue.status permission on an issue in scope.
func canChangeStatus(claims *services.Claims, issue models.Issue, project models.Project) bool {
	return claims.Can(services.PermIssueStatus) && services.CanAccessIssue(claims, issue, project)
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
	// Helpdesk walk-in/phone requests only (requires helpdesk.create): who
	// actually needs help, since that person has no account of their own.
	ContactName  string `json:"contactName"`
	ContactPhone string `json:"contactPhone"`
	// Requests only: the chosen request form (talep türü) and its answers
	// keyed by question id.
	RequestFormID *uuid.UUID                 `json:"requestFormId"`
	Answers       map[string]json.RawMessage `json:"answers"`
}

func (h *IssueHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())

	var req createIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if !req.IsRequest && !claims.Can(services.PermIssueCreate) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	if req.IsRequest && !claims.Can(services.PermRequestCreate) {
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
	if claims.Scope != models.ScopeOwn && !canAccessProject(claims, project) {
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

	newIssue := repository.NewIssue{
		ProjectID:   req.ProjectID,
		SprintID:    req.SprintID,
		Title:       req.Title,
		Description: req.Description,
		Type:        issueType,
		Priority:    priority,
		AssigneeID:  req.AssigneeID,
		ReporterID:  claims.UserID,
		IsRequest:   req.IsRequest,
	}
	// contactName/contactPhone only apply to a helpdesk walk-in/phone request
	// opened on someone else's behalf — silently ignored otherwise so a
	// regular requester filling their own name in by mistake has no effect.
	if req.IsRequest && claims.Can(services.PermHelpdeskCreate) {
		if req.ContactName != "" {
			newIssue.ContactName = &req.ContactName
		}
		if req.ContactPhone != "" {
			newIssue.ContactPhone = &req.ContactPhone
		}
	}

	if req.IsRequest {
		forms, err := h.forms.ListByProject(r.Context(), project.ID, false)
		if err != nil {
			response.Error(w, http.StatusInternalServerError, "failed to load request forms")
			return
		}
		// A project with active forms requires picking one — otherwise its
		// required questions could be skipped by simply not choosing a form.
		if len(forms) > 0 {
			if req.RequestFormID == nil {
				response.Error(w, http.StatusBadRequest, "Lütfen talep türünü seçin")
				return
			}
			var form *models.RequestForm
			for i := range forms {
				if forms[i].ID == *req.RequestFormID {
					form = &forms[i]
					break
				}
			}
			if form == nil {
				response.Error(w, http.StatusBadRequest, "Seçilen talep türü bu müdürlükte bulunamadı")
				return
			}
			answers, err := services.BuildAnswers(form.Questions, req.Answers)
			if err != nil {
				response.Error(w, http.StatusBadRequest, err.Error())
				return
			}
			attach, err := h.resolveFileAnswers(r, claims, form, answers)
			var formErr services.FormError
			if errors.As(err, &formErr) {
				response.Error(w, http.StatusBadRequest, formErr.Msg)
				return
			}
			if err != nil {
				response.Error(w, http.StatusInternalServerError, "failed to load files")
				return
			}
			newIssue.AttachFileIDs = attach
			newIssue.RequestFormID = &form.ID
			newIssue.RequestFormName = &form.Name
			newIssue.RequestAnswers = answers
		}
	}

	created, err := h.issues.Create(r.Context(), newIssue)
	if errors.Is(err, repository.ErrFileAlreadyAttached) {
		response.Error(w, http.StatusConflict, "Yüklenen dosyalardan biri başka bir talebe eklenmiş, lütfen yeniden yükleyin")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create issue")
		return
	}

	if err := h.activities.Create(r.Context(), created.ID, claims.UserID, "created", "Talep oluşturuldu"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}

	response.JSON(w, http.StatusCreated, created)
}

// resolveFileAnswers turns file-question answers (uploaded file ids) into
// FileRefs in place and returns the ids to attach to the new request. Each
// file must be the caller's own, not yet attached, and of a category the
// question accepts.
func (h *IssueHandler) resolveFileAnswers(r *http.Request, claims *services.Claims, form *models.RequestForm, answers []models.RequestAnswer) ([]uuid.UUID, error) {
	var attach []uuid.UUID
	for i, a := range answers {
		if a.Type != models.QuestionFile {
			continue
		}
		var question models.RequestQuestion
		for _, q := range form.Questions {
			if q.ID == a.QuestionID {
				question = q
			}
		}
		raw, _ := a.Value.([]string)
		ids := make([]uuid.UUID, 0, len(raw))
		for _, s := range raw {
			ids = append(ids, uuid.MustParse(s)) // validated by services.BuildAnswers
		}
		found, err := h.files.GetMany(r.Context(), ids)
		if err != nil {
			return nil, err
		}
		refs := make([]models.FileRef, 0, len(ids))
		for _, id := range ids {
			f, ok := found[id]
			if !ok || f.UploaderID != claims.UserID || f.IssueID != nil {
				return nil, services.FormError{Msg: "\"" + question.Label + "\": dosya bulunamadı, lütfen yeniden yükleyin"}
			}
			if accept := question.Settings.Accept; len(accept) > 0 {
				cat := services.FileCategory(f.OriginalName)
				ok := false
				for _, c := range accept {
					ok = ok || c == cat
				}
				if !ok {
					return nil, services.FormError{Msg: "\"" + question.Label + "\": " + f.OriginalName + " bu soru için izin verilen bir dosya türü değil"}
				}
			}
			refs = append(refs, models.FileRef{ID: f.ID, Name: f.OriginalName, Size: f.SizeBytes})
			attach = append(attach, f.ID)
		}
		answers[i].Value = refs
	}
	return attach, nil
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

	if issue.Status == models.StatusPendingApproval && !claims.Can(services.PermIssueApprove) {
		response.Error(w, http.StatusForbidden, "Onay bekleyen talebin durumunu yalnızca yönetici değiştirebilir")
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
	validStatuses := map[string]bool{"To Do": true, "In Progress": true, "Geri Çevrildi": true}
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
	h.notifier.Notify(r.Context(), updated.ReporterID, claims.UserID, services.NotifyStatus,
		"Talebinizin durumu değişti", updated.Title+": "+req.Status, &updated.ID)
	response.JSON(w, http.StatusOK, updated)
}

// Cancel lets a requester withdraw their own request while it's still open.
func (h *IssueHandler) Cancel(w http.ResponseWriter, r *http.Request) {
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
	if !issue.IsRequest || issue.ReporterID != claims.UserID {
		response.Error(w, http.StatusForbidden, "Yalnızca kendi talebinizi iptal edebilirsiniz")
		return
	}
	terminal := map[string]bool{"Done": true, "Geri Çevrildi": true, "İptal Edildi": true}
	if terminal[issue.Status] {
		response.Error(w, http.StatusBadRequest, "Bu talep zaten sonuçlanmış")
		return
	}

	updated, err := h.issues.SetStatus(r.Context(), id, "İptal Edildi")
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to cancel issue")
		return
	}
	if err := h.activities.Create(r.Context(), id, claims.UserID, "status_change", "Talep, talep eden tarafından iptal edildi"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}

type forwardRequest struct {
	TargetProjectID uuid.UUID `json:"targetProjectId"`
	Note            string    `json:"note"`
}

// Forward routes a request to a different project ("başka bir birime/konuya
// yönlendirme" in the reference system's terms — see canModifyIssue's doc).
func (h *IssueHandler) Forward(w http.ResponseWriter, r *http.Request) {
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
	if !issue.IsRequest {
		response.Error(w, http.StatusBadRequest, "Yalnızca talepler yönlendirilebilir")
		return
	}
	if !claims.Can(services.PermIssueForward) || !services.CanAccessIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req forwardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TargetProjectID == uuid.Nil || req.TargetProjectID == issue.ProjectID {
		response.Error(w, http.StatusBadRequest, "geçerli bir hedef müdürlük seçin")
		return
	}
	targetProject, err := h.projects.GetByID(r.Context(), req.TargetProjectID)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusBadRequest, "geçersiz hedef müdürlük")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load target project")
		return
	}

	updated, err := h.issues.Forward(r.Context(), id, req.TargetProjectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to forward issue")
		return
	}
	desc := `"` + project.Name + `" → "` + targetProject.Name + `" müdürlüğüne yönlendirildi`
	if req.Note != "" {
		desc += ": " + req.Note
	}
	if err := h.activities.Create(r.Context(), id, claims.UserID, "field_update", desc); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	h.notifier.Notify(r.Context(), updated.ReporterID, claims.UserID, services.NotifyForwarded,
		"Talebiniz yönlendirildi", updated.Title+" → "+targetProject.Name, &updated.ID)
	response.JSON(w, http.StatusOK, updated)
}

type rateRequest struct {
	Rating  int16  `json:"rating"`
	Comment string `json:"comment"`
}

// Rate lets a requester score their resolved request once.
func (h *IssueHandler) Rate(w http.ResponseWriter, r *http.Request) {
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
	if !issue.IsRequest || issue.ReporterID != claims.UserID {
		response.Error(w, http.StatusForbidden, "Yalnızca kendi talebinizi puanlayabilirsiniz")
		return
	}
	if issue.Status != "Done" {
		response.Error(w, http.StatusBadRequest, "Yalnızca tamamlanmış talepler puanlanabilir")
		return
	}
	if issue.RatedAt != nil {
		response.Error(w, http.StatusBadRequest, "Bu talep zaten puanlandı")
		return
	}

	var req rateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		response.Error(w, http.StatusBadRequest, "rating 1-5 arasında olmalıdır")
		return
	}

	updated, err := h.issues.Rate(r.Context(), id, req.Rating, req.Comment)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to rate issue")
		return
	}
	if err := h.activities.Create(r.Context(), id, claims.UserID, "field_update", "Talep puanlandı"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	if updated.AssigneeID != nil {
		h.notifier.Notify(r.Context(), *updated.AssigneeID, claims.UserID, services.NotifyRated,
			"Çözümünüz puanlandı", updated.Title, &updated.ID)
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
			response.Error(w, http.StatusBadRequest, "bu müdürlükte envanter takibi etkin değil")
			return
		}
		if req.EquipmentID == nil || req.Quantity <= 0 {
			response.Error(w, http.StatusBadRequest, "teçhizat seçildiğinde equipmentId ve pozitif bir quantity zorunludur")
			return
		}
	}

	// Without issue.approve the work isn't closed yet: it waits for a
	// manager, with the resolution (and any inventory use) parked until then.
	if !claims.Can(services.PermIssueApprove) {
		if issue.Status == models.StatusPendingApproval {
			response.Error(w, http.StatusBadRequest, "Bu iş zaten yönetici onayı bekliyor")
			return
		}
		pc := models.PendingCompletion{ResolutionNote: note, SubmittedBy: claims.UserID, SubmittedAt: time.Now()}
		if req.UsedEquipment {
			pc.EquipmentID, pc.Quantity = req.EquipmentID, req.Quantity
		}
		updated, err := h.issues.SubmitCompletion(r.Context(), id, pc)
		if err != nil {
			response.Error(w, http.StatusInternalServerError, "failed to submit completion")
			return
		}
		if project.ManagerID != claims.UserID {
			h.notifier.Notify(r.Context(), project.ManagerID, claims.UserID, services.NotifyStatus,
				"Onayınızı bekleyen bir iş var", updated.Title, &updated.ID)
		}
		response.JSON(w, http.StatusOK, map[string]interface{}{"issue": updated, "pendingApproval": true})
		return
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
	h.notifier.Notify(r.Context(), result.Issue.ReporterID, claims.UserID, services.NotifyStatus,
		"Talebiniz tamamlandı", result.Issue.Title, &result.Issue.ID)
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"issue":        result.Issue,
		"stockWarning": result.StockWarning,
	})
}

// loadPendingApproval loads an issue awaiting approval and checks the caller
// may decide on it (issue.approve and the issue within their scope).
func (h *IssueHandler) loadPendingApproval(w http.ResponseWriter, r *http.Request) (models.Issue, *services.Claims, bool) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid issue id")
		return models.Issue{}, nil, false
	}
	issue, project, err := h.loadWithProject(r, id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "issue not found")
		return models.Issue{}, nil, false
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load issue")
		return models.Issue{}, nil, false
	}
	if !claims.Can(services.PermIssueApprove) || !services.CanAccessIssue(claims, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu işi onaylama yetkiniz yok")
		return models.Issue{}, nil, false
	}
	if issue.Status != models.StatusPendingApproval || issue.PendingCompletion == nil {
		response.Error(w, http.StatusBadRequest, "Bu iş onay beklemiyor")
		return models.Issue{}, nil, false
	}
	return issue, claims, true
}

// ApproveCompletion closes a pending completion: applies the parked
// resolution (comment by the worker, inventory deduction) and marks it Done.
func (h *IssueHandler) ApproveCompletion(w http.ResponseWriter, r *http.Request) {
	issue, claims, ok := h.loadPendingApproval(w, r)
	if !ok {
		return
	}
	pc := issue.PendingCompletion
	approver := claims.UserID
	result, err := h.issues.Complete(r.Context(), repository.CompleteParams{
		IssueID:          issue.ID,
		ResolutionNote:   pc.ResolutionNote,
		ResolverID:       pc.SubmittedBy,
		ApprovedBy:       &approver,
		InventoryItemID:  pc.EquipmentID,
		InventoryUsedQty: pc.Quantity,
	})
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to approve completion")
		return
	}
	h.notifier.Notify(r.Context(), result.Issue.ReporterID, claims.UserID, services.NotifyStatus,
		"Talebiniz tamamlandı", result.Issue.Title, &result.Issue.ID)
	h.notifier.Notify(r.Context(), pc.SubmittedBy, claims.UserID, services.NotifyStatus,
		"Tamamladığınız iş onaylandı", result.Issue.Title, &result.Issue.ID)
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"issue":        result.Issue,
		"stockWarning": result.StockWarning,
	})
}

type rejectCompletionRequest struct {
	Reason string `json:"reason"`
}

// RejectCompletion sends a pending completion back to In Progress.
func (h *IssueHandler) RejectCompletion(w http.ResponseWriter, r *http.Request) {
	issue, claims, ok := h.loadPendingApproval(w, r)
	if !ok {
		return
	}
	var req rejectCompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if len([]rune(reason)) < 5 {
		response.Error(w, http.StatusBadRequest, "Lütfen ret gerekçesini yazın (en az 5 karakter)")
		return
	}
	updated, err := h.issues.RejectCompletion(r.Context(), issue.ID, claims.UserID, reason)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to reject completion")
		return
	}
	h.notifier.Notify(r.Context(), issue.PendingCompletion.SubmittedBy, claims.UserID, services.NotifyStatus,
		"Tamamladığınız iş onaylanmadı", updated.Title, &updated.ID)
	response.JSON(w, http.StatusOK, updated)
}

type updateAssigneeRequest struct {
	AssigneeID     *uuid.UUID `json:"assigneeId"`
	AssigneeTeamID *uuid.UUID `json:"assigneeTeamId"`
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

	var updated models.Issue
	if req.AssigneeTeamID != nil {
		updated, err = h.issues.SetAssigneeTeam(r.Context(), id, req.AssigneeTeamID)
	} else {
		updated, err = h.issues.SetAssignee(r.Context(), id, req.AssigneeID)
	}
	if errors.Is(err, repository.ErrTeamNotInProject) {
		response.Error(w, http.StatusBadRequest, "Seçilen ekip bu müdürlüğe ait değil")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update assignee")
		return
	}

	if err := h.activities.Create(r.Context(), id, claims.UserID, "assignment", "Atama değiştirildi"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	if updated.AssigneeID != nil {
		h.notifier.Notify(r.Context(), *updated.AssigneeID, claims.UserID, services.NotifyAssigned,
			"Size bir iş atandı", updated.Title, &updated.ID)
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
	if !claims.Can(services.PermIssueClone) || (claims.Scope == models.ScopeOwn && !isOwnRequest) {
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
	if err := h.activities.Create(r.Context(), cloned.ID, claims.UserID, "created", "Talep klonlandı"); err != nil {
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
	if !claims.Can(services.PermIssueSprint) {
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
	if !claims.Can(services.PermIssueDates) {
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
	if !claims.Can(services.PermIssueShare) {
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
	if !canModifyIssue(claims, services.PermIssueDelete, issue, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	// Only the person who opened it may delete it — managers included.
	if issue.ReporterID != claims.UserID {
		response.Error(w, http.StatusForbidden, "Yalnızca kendi açtığınız talebi silebilirsiniz")
		return
	}

	if err := h.issues.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to delete issue")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
