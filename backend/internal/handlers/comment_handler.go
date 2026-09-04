package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type CommentHandler struct {
	comments   *repository.CommentRepo
	issues     *repository.IssueRepo
	projects   *repository.ProjectRepo
	activities *repository.ActivityRepo
}

func NewCommentHandler(comments *repository.CommentRepo, issues *repository.IssueRepo, projects *repository.ProjectRepo, activities *repository.ActivityRepo) *CommentHandler {
	return &CommentHandler{comments: comments, issues: issues, projects: projects, activities: activities}
}

func (h *CommentHandler) List(w http.ResponseWriter, r *http.Request) {
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

	comments, err := h.comments.ListByIssue(r.Context(), issueID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list comments")
		return
	}
	response.JSON(w, http.StatusOK, comments)
}

type createCommentRequest struct {
	Text string `json:"text"`
}

func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		response.Error(w, http.StatusBadRequest, "yorum metni boş olamaz")
		return
	}

	comment, err := h.comments.Create(r.Context(), issueID, claims.UserID, req.Text)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create comment")
		return
	}
	if err := h.activities.Create(r.Context(), issueID, claims.UserID, "comment", "Yorum ekledi"); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to record activity")
		return
	}
	response.JSON(w, http.StatusCreated, comment)
}

// Delete only allows a user to remove their own comment.
func (h *CommentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid comment id")
		return
	}

	comment, err := h.comments.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "comment not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load comment")
		return
	}
	if comment.AuthorID != claims.UserID {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	if err := h.comments.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to delete comment")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
