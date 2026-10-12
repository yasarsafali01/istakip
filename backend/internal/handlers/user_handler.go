package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type UserHandler struct {
	users *repository.UserRepo
	roles *services.RoleStore
	teams *repository.TeamRepo
}

func NewUserHandler(users *repository.UserRepo, roles *services.RoleStore, teams *repository.TeamRepo) *UserHandler {
	return &UserHandler{users: users, roles: roles, teams: teams}
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
	h.roles.Decorate(&user)
	if user.Teams, err = h.teams.MembershipsOf(r.Context(), user.ID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load teams")
		return
	}
	response.JSON(w, http.StatusOK, user)
}

type updateProfileRequest struct {
	Building    *string `json:"building"`
	Floor       *string `json:"floor"`
	Room        *string `json:"room"`
	NotifyEmail bool    `json:"notifyEmail"`
	NotifySMS   bool    `json:"notifySms"`
	NotifyPush  bool    `json:"notifyPush"`
}

// UpdateMe updates the caller's own profile location and notification
// preferences. Only notifyPush is actually wired to anything today.
func (h *UserHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	trim := func(s *string) *string {
		if s == nil {
			return nil
		}
		v := strings.TrimSpace(*s)
		if v == "" {
			return nil
		}
		return &v
	}
	user, err := h.users.UpdateProfile(r.Context(), claims.UserID, trim(req.Building), trim(req.Floor), trim(req.Room),
		req.NotifyEmail, req.NotifySMS, req.NotifyPush)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}
	h.roles.Decorate(&user)
	if user.Teams, err = h.teams.MembershipsOf(r.Context(), user.ID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load teams")
		return
	}
	response.JSON(w, http.StatusOK, user)
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func (h *UserHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.NewPassword) < 6 {
		response.Error(w, http.StatusBadRequest, "Yeni şifre en az 6 karakter olmalıdır")
		return
	}
	hash, err := h.users.GetPasswordHash(r.Context(), claims.UserID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load user")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.CurrentPassword)); err != nil {
		response.Error(w, http.StatusBadRequest, "Mevcut şifre hatalı")
		return
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to hash password")
		return
	}
	if err := h.users.UpdatePasswordHash(r.Context(), claims.UserID, string(newHash)); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update password")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
