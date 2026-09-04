package handlers

import (
	"errors"
	"net/http"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
)

type UserHandler struct {
	users *repository.UserRepo
}

func NewUserHandler(users *repository.UserRepo) *UserHandler {
	return &UserHandler{users: users}
}

// List returns every user's safe profile (no password hash). The original
// frontend kept the full user list in client state for every role (names,
// avatars, assignee dropdowns), so this mirrors that flat trust model.
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.users.List(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	response.JSON(w, http.StatusOK, users)
}

func (h *UserHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	user, err := h.users.GetByID(r.Context(), claims.UserID)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load user")
		return
	}
	response.JSON(w, http.StatusOK, user)
}
