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

type InventoryHandler struct {
	inventory *repository.InventoryRepo
	projects  *repository.ProjectRepo
}

func NewInventoryHandler(inventory *repository.InventoryRepo, projects *repository.ProjectRepo) *InventoryHandler {
	return &InventoryHandler{inventory: inventory, projects: projects}
}

func (h *InventoryHandler) List(w http.ResponseWriter, r *http.Request) {
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
	if !canAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	items, err := h.inventory.ListByProject(r.Context(), projectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list inventory")
		return
	}
	response.JSON(w, http.StatusOK, items)
}

type createInventoryRequest struct {
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
	Unit     string `json:"unit"`
}

func (h *InventoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid project id")
		return
	}
	if !canManageIssues(claims.Role) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
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
	if !canAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	if !project.HasInventory {
		response.Error(w, http.StatusBadRequest, "bu projede envanter takibi etkin değil")
		return
	}

	var req createInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.Unit == "" {
		response.Error(w, http.StatusBadRequest, "name ve unit zorunludur")
		return
	}

	item, err := h.inventory.Create(r.Context(), projectID, req.Name, req.Quantity, req.Unit)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create inventory item")
		return
	}
	response.JSON(w, http.StatusCreated, item)
}

type adjustInventoryRequest struct {
	QuantityChange int `json:"quantityChange"`
}

func (h *InventoryHandler) Adjust(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !canManageIssues(claims.Role) && claims.Role != models.RoleWorker {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid inventory id")
		return
	}

	item, err := h.inventory.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "inventory item not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load inventory item")
		return
	}
	project, err := h.projects.GetByID(r.Context(), item.ProjectID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load project")
		return
	}
	if !canAccessProject(claims, project) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	var req adjustInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updated, err := h.inventory.AdjustQuantity(r.Context(), id, req.QuantityChange)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update inventory")
		return
	}
	response.JSON(w, http.StatusOK, updated)
}
