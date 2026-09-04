package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type AuthHandler struct {
	auth *services.AuthService
}

func NewAuthHandler(auth *services.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type tokenResponse struct {
	AccessToken  string      `json:"accessToken"`
	RefreshToken string      `json:"refreshToken"`
	User         interface{} `json:"user,omitempty"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, pair, err := h.auth.Login(r.Context(), req.Email, req.Password)
	if errors.Is(err, services.ErrInvalidCredentials) {
		response.Error(w, http.StatusUnauthorized, "Kullanıcı adı veya şifre hatalı.")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "login failed")
		return
	}

	response.JSON(w, http.StatusOK, tokenResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		User:         user,
	})
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		response.Error(w, http.StatusBadRequest, "refreshToken is required")
		return
	}

	pair, err := h.auth.Refresh(r.Context(), req.RefreshToken)
	if errors.Is(err, services.ErrInvalidRefreshToken) {
		response.Error(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "refresh failed")
		return
	}

	response.JSON(w, http.StatusOK, tokenResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		response.Error(w, http.StatusBadRequest, "refreshToken is required")
		return
	}

	if err := h.auth.Logout(r.Context(), req.RefreshToken); err != nil {
		response.Error(w, http.StatusInternalServerError, "logout failed")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
