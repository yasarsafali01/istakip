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

type TeamHandler struct {
	teams    *repository.TeamRepo
	projects *repository.ProjectRepo
}

func NewTeamHandler(teams *repository.TeamRepo, projects *repository.ProjectRepo) *TeamHandler {
	return &TeamHandler{teams: teams, projects: projects}
}

func (h *TeamHandler) loadProject(r *http.Request, idParam string) (uuid.UUID, error) {
	return uuid.Parse(chi.URLParam(r, idParam))
}

// List returns a project's teams. Any role with project access may read them
// (needed to show team options in the assignee picker).
func (h *TeamHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	projectID, err := h.loadProject(r, "id")
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

	teams, err := h.teams.ListByProject(r.Context(), projectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list teams")
		return
	}
	response.JSON(w, http.StatusOK, teams)
}

type createTeamRequest struct {
	Name string `json:"name"`
}

func (h *TeamHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermTeamManage) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	projectID, err := h.loadProject(r, "id")
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

	var req createTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.Error(w, http.StatusBadRequest, "Ekip adı zorunludur")
		return
	}

	team, err := h.teams.Create(r.Context(), projectID, name)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create team")
		return
	}
	response.JSON(w, http.StatusCreated, team)
}

// mustManageTeam loads the team and checks team.manage + project scope.
func (h *TeamHandler) mustManageTeam(r *http.Request) (uuid.UUID, error) {
	claims, _ := authmw.CurrentClaims(r.Context())
	teamID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		return uuid.Nil, err
	}
	team, err := h.teams.GetByID(r.Context(), teamID)
	if err != nil {
		return uuid.Nil, err
	}
	project, err := h.projects.GetByID(r.Context(), team.ProjectID)
	if err != nil {
		return uuid.Nil, err
	}
	if !claims.Can(services.PermTeamManage) || !services.CanAccessProject(claims, project) {
		return uuid.Nil, errForbidden
	}
	return teamID, nil
}

func (h *TeamHandler) Rename(w http.ResponseWriter, r *http.Request) {
	teamID, err := h.mustManageTeam(r)
	if err != nil {
		respondTeamErr(w, err)
		return
	}
	var req createTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.Error(w, http.StatusBadRequest, "Ekip adı zorunludur")
		return
	}
	team, err := h.teams.Rename(r.Context(), teamID, name)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to rename team")
		return
	}
	response.JSON(w, http.StatusOK, team)
}

func (h *TeamHandler) Delete(w http.ResponseWriter, r *http.Request) {
	teamID, err := h.mustManageTeam(r)
	if err != nil {
		respondTeamErr(w, err)
		return
	}
	if err := h.teams.Delete(r.Context(), teamID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to delete team")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type teamMemberRequest struct {
	UserID uuid.UUID `json:"userId"`
}

func (h *TeamHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	teamID, err := h.mustManageTeam(r)
	if err != nil {
		respondTeamErr(w, err)
		return
	}
	var req teamMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == uuid.Nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.teams.AddMember(r.Context(), teamID, req.UserID); err != nil {
		if errors.Is(err, repository.ErrNotProjectStaff) {
			response.Error(w, http.StatusBadRequest, "Ekibe yalnızca bu müdürlüğün personeli eklenebilir")
			return
		}
		response.Error(w, http.StatusInternalServerError, "failed to add member")
		return
	}
	team, err := h.teams.GetByID(r.Context(), teamID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load team")
		return
	}
	response.JSON(w, http.StatusOK, team)
}

func (h *TeamHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	teamID, err := h.mustManageTeam(r)
	if err != nil {
		respondTeamErr(w, err)
		return
	}
	userID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if err := h.teams.RemoveMember(r.Context(), teamID, userID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to remove member")
		return
	}
	team, err := h.teams.GetByID(r.Context(), teamID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load team")
		return
	}
	response.JSON(w, http.StatusOK, team)
}

var errForbidden = errors.New("forbidden")

func respondTeamErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errForbidden):
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
	case errors.Is(err, repository.ErrNotFound):
		response.Error(w, http.StatusNotFound, "team not found")
	default:
		response.Error(w, http.StatusBadRequest, "invalid request")
	}
}
