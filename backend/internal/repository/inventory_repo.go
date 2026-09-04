package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type InventoryRepo struct {
	pool *pgxpool.Pool
}

func NewInventoryRepo(pool *pgxpool.Pool) *InventoryRepo {
	return &InventoryRepo{pool: pool}
}

func scanInventoryItem(row pgx.Row) (models.InventoryItem, error) {
	var i models.InventoryItem
	err := row.Scan(&i.ID, &i.ProjectID, &i.Name, &i.Quantity, &i.Unit)
	return i, err
}

func (r *InventoryRepo) ListByProject(ctx context.Context, projectID uuid.UUID) ([]models.InventoryItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, project_id, name, quantity, unit FROM inventory WHERE project_id = $1 ORDER BY name`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.InventoryItem
	for rows.Next() {
		i, err := scanInventoryItem(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

func (r *InventoryRepo) GetByID(ctx context.Context, id uuid.UUID) (models.InventoryItem, error) {
	row := r.pool.QueryRow(ctx, `SELECT id, project_id, name, quantity, unit FROM inventory WHERE id = $1`, id)
	i, err := scanInventoryItem(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.InventoryItem{}, ErrNotFound
	}
	return i, err
}

func (r *InventoryRepo) Create(ctx context.Context, projectID uuid.UUID, name string, quantity int, unit string) (models.InventoryItem, error) {
	row := r.pool.QueryRow(ctx,
		`INSERT INTO inventory (project_id, name, quantity, unit) VALUES ($1, $2, $3, $4)
		 RETURNING id, project_id, name, quantity, unit`,
		projectID, name, quantity, unit,
	)
	return scanInventoryItem(row)
}

// AdjustQuantity changes quantity by a signed delta (matches the frontend's
// UPDATE_INVENTORY action) — allowed to go negative, no hard floor.
func (r *InventoryRepo) AdjustQuantity(ctx context.Context, id uuid.UUID, delta int) (models.InventoryItem, error) {
	row := r.pool.QueryRow(ctx,
		`UPDATE inventory SET quantity = quantity + $2 WHERE id = $1
		 RETURNING id, project_id, name, quantity, unit`,
		id, delta,
	)
	i, err := scanInventoryItem(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.InventoryItem{}, ErrNotFound
	}
	return i, err
}
