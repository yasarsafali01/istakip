package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type UnitRepo struct {
	pool *pgxpool.Pool
}

func NewUnitRepo(pool *pgxpool.Pool) *UnitRepo {
	return &UnitRepo{pool: pool}
}

const unitColumns = "id, name, unit_code, department_head_id, created_at"

func scanUnit(row pgx.Row) (models.Unit, error) {
	var u models.Unit
	err := row.Scan(&u.ID, &u.Name, &u.UnitCode, &u.DepartmentHeadID, &u.CreatedAt)
	return u, err
}

// List returns all units, or a single unit when onlyID is set (used to scope
// Department_Head to their own unit).
func (r *UnitRepo) List(ctx context.Context, onlyID *uuid.UUID) ([]models.Unit, error) {
	query := "SELECT " + unitColumns + " FROM units"
	args := []interface{}{}
	if onlyID != nil {
		query += " WHERE id = $1"
		args = append(args, *onlyID)
	}
	query += " ORDER BY name"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Unit
	for rows.Next() {
		u, err := scanUnit(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *UnitRepo) GetByID(ctx context.Context, id uuid.UUID) (models.Unit, error) {
	row := r.pool.QueryRow(ctx, "SELECT "+unitColumns+" FROM units WHERE id = $1", id)
	u, err := scanUnit(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Unit{}, ErrNotFound
	}
	return u, err
}

func (r *UnitRepo) CodeExists(ctx context.Context, unitCode string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM units WHERE lower(unit_code) = lower($1))", unitCode).Scan(&exists)
	return exists, err
}

func (r *UnitRepo) Create(ctx context.Context, name, unitCode string, departmentHeadID uuid.UUID) (models.Unit, error) {
	row := r.pool.QueryRow(ctx,
		`INSERT INTO units (name, unit_code, department_head_id) VALUES ($1, $2, $3)
		 RETURNING `+unitColumns,
		name, unitCode, departmentHeadID,
	)
	return scanUnit(row)
}

func (r *UnitRepo) Update(ctx context.Context, id uuid.UUID, name string, departmentHeadID *uuid.UUID) (models.Unit, error) {
	row := r.pool.QueryRow(ctx,
		`UPDATE units SET
		   name = COALESCE(NULLIF($2, ''), name),
		   department_head_id = COALESCE($3, department_head_id)
		 WHERE id = $1
		 RETURNING `+unitColumns,
		id, name, departmentHeadID,
	)
	u, err := scanUnit(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Unit{}, ErrNotFound
	}
	return u, err
}
