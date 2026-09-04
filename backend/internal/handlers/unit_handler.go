package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
)

type UnitHandler struct {
	units *repository.UnitRepo
}

func NewUnitHandler(units *repository.UnitRepo) *UnitHandler {
	return &UnitHandler{units: units}
}

// List: System_Admin sees all units, Department_Head sees only their own,
// everyone else gets an empty list.
func (h *UnitHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())

	var onlyID *uuid.UUID
	switch claims.Role {
	case models.RoleSystemAdmin:
		// no filter — see everything
	case models.RoleDepartmentHead:
		if claims.UnitID == nil {
			response.JSON(w, http.StatusOK, []models.Unit{})
			return
		}
		onlyID = claims.UnitID
	default:
		response.JSON(w, http.StatusOK, []models.Unit{})
		return
	}

	units, err := h.units.List(r.Context(), onlyID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list units")
		return
	}
	response.JSON(w, http.StatusOK, units)
}

type createUnitRequest struct {
	Name             string    `json:"name"`
	UnitCode         string    `json:"unitCode"`
	DepartmentHeadID uuid.UUID `json:"departmentHeadId"`
}

func (h *UnitHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if claims.Role != models.RoleSystemAdmin {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req createUnitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.UnitCode == "" || req.DepartmentHeadID == uuid.Nil {
		response.Error(w, http.StatusBadRequest, "name, unitCode ve departmentHeadId zorunludur")
		return
	}

	exists, err := h.units.CodeExists(r.Context(), req.UnitCode)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to validate unit code")
		return
	}
	if exists {
		response.Error(w, http.StatusConflict, "Bu birim kodu zaten kullanılıyor")
		return
	}

	unit, err := h.units.Create(r.Context(), req.Name, req.UnitCode, req.DepartmentHeadID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create unit")
		return
	}
	response.JSON(w, http.StatusCreated, unit)
}

type updateUnitRequest struct {
	Name             string     `json:"name"`
	DepartmentHeadID *uuid.UUID `json:"departmentHeadId"`
}

func (h *UnitHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if claims.Role != models.RoleSystemAdmin {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid unit id")
		return
	}

	var req updateUnitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	unit, err := h.units.Update(r.Context(), id, req.Name, req.DepartmentHeadID)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "unit not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update unit")
		return
	}
	response.JSON(w, http.StatusOK, unit)
}
