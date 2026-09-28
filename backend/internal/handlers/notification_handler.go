package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
)

type NotificationHandler struct {
	notifications *repository.NotificationRepo
}

func NewNotificationHandler(notifications *repository.NotificationRepo) *NotificationHandler {
	return &NotificationHandler{notifications: notifications}
}

func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	list, err := h.notifications.ListByUser(r.Context(), claims.UserID, 50)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list notifications")
		return
	}
	response.JSON(w, http.StatusOK, list)
}

func (h *NotificationHandler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	count, err := h.notifications.UnreadCount(r.Context(), claims.UserID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to count notifications")
		return
	}
	response.JSON(w, http.StatusOK, map[string]int{"count": count})
}

func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid notification id")
		return
	}
	if err := h.notifications.MarkRead(r.Context(), id, claims.UserID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to mark notification read")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if err := h.notifications.MarkAllRead(r.Context(), claims.UserID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to mark notifications read")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
