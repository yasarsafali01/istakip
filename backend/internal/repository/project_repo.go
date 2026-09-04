package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type ProjectRepo struct {
	pool *pgxpool.Pool
}

func NewProjectRepo(pool *pgxpool.Pool) *ProjectRepo {
	return &ProjectRepo{pool: pool}
}

const projectColumns = "id, key, name, description, unit_id, manager_id, has_inventory, next_issue_number, created_at"

func scanProject(row pgx.Row) (models.Project, error) {
	var p models.Project
	err := row.Scan(&p.ID, &p.Key, &p.Name, &p.Description, &p.UnitID, &p.ManagerID, &p.HasInventory, &p.NextIssueNumber, &p.CreatedAt)
	return p, err
}

// ProjectFilter scopes the project list to what the caller's role is allowed
// to see. Exactly one of the fields should be set, or none for "all".
type ProjectFilter struct {
	UnitID    *uuid.UUID // Department_Head: own unit
	ManagerID *uuid.UUID // Project_Manager: projects they manage
	OnlyID    *uuid.UUID // Worker: their single assigned project
	None      bool       // External_User: no projects at all
}

func (r *ProjectRepo) List(ctx context.Context, filter ProjectFilter) ([]models.Project, error) {
	if filter.None {
		return []models.Project{}, nil
	}

	query := "SELECT " + projectColumns + " FROM projects"
	args := []interface{}{}
	switch {
	case filter.UnitID != nil:
		query += " WHERE unit_id = $1"
		args = append(args, *filter.UnitID)
	case filter.ManagerID != nil:
		query += " WHERE manager_id = $1"
		args = append(args, *filter.ManagerID)
	case filter.OnlyID != nil:
		query += " WHERE id = $1"
		args = append(args, *filter.OnlyID)
	}
	query += " ORDER BY created_at"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ProjectRepo) GetByID(ctx context.Context, id uuid.UUID) (models.Project, error) {
	row := r.pool.QueryRow(ctx, "SELECT "+projectColumns+" FROM projects WHERE id = $1", id)
	p, err := scanProject(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Project{}, ErrNotFound
	}
	return p, err
}

func (r *ProjectRepo) CountInUnit(ctx context.Context, unitID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM projects WHERE unit_id = $1", unitID).Scan(&count)
	return count, err
}

func (r *ProjectRepo) Create(ctx context.Context, key, name, description string, unitID, managerID uuid.UUID, hasInventory bool) (models.Project, error) {
	row := r.pool.QueryRow(ctx,
		`INSERT INTO projects (key, name, description, unit_id, manager_id, has_inventory)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING `+projectColumns,
		key, name, description, unitID, managerID, hasInventory,
	)
	return scanProject(row)
}

func (r *ProjectRepo) Update(ctx context.Context, id uuid.UUID, name, description string, managerID *uuid.UUID, hasInventory *bool) (models.Project, error) {
	row := r.pool.QueryRow(ctx,
		`UPDATE projects SET
		   name = COALESCE(NULLIF($2, ''), name),
		   description = COALESCE(NULLIF($3, ''), description),
		   manager_id = COALESCE($4, manager_id),
		   has_inventory = COALESCE($5, has_inventory)
		 WHERE id = $1
		 RETURNING `+projectColumns,
		id, name, description, managerID, hasInventory,
	)
	p, err := scanProject(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Project{}, ErrNotFound
	}
	return p, err
}
