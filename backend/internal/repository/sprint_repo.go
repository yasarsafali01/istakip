package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

var ErrDuplicateSprint = errors.New("sprint already exists for this month/year")
var ErrActiveSprintExists = errors.New("an active sprint already exists for this project")

type SprintRepo struct {
	pool *pgxpool.Pool
}

func NewSprintRepo(pool *pgxpool.Pool) *SprintRepo {
	return &SprintRepo{pool: pool}
}

const sprintColumns = "id, project_id, name, month, year, start_date, end_date, status"

func scanSprint(row pgx.Row) (models.Sprint, error) {
	var s models.Sprint
	err := row.Scan(&s.ID, &s.ProjectID, &s.Name, &s.Month, &s.Year, &s.StartDate, &s.EndDate, &s.Status)
	return s, err
}

func (r *SprintRepo) ListByProject(ctx context.Context, projectID uuid.UUID) ([]models.Sprint, error) {
	rows, err := r.pool.Query(ctx, "SELECT "+sprintColumns+" FROM sprints WHERE project_id = $1 ORDER BY year, month", projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Sprint
	for rows.Next() {
		s, err := scanSprint(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *SprintRepo) GetByID(ctx context.Context, id uuid.UUID) (models.Sprint, error) {
	row := r.pool.QueryRow(ctx, "SELECT "+sprintColumns+" FROM sprints WHERE id = $1", id)
	s, err := scanSprint(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Sprint{}, ErrNotFound
	}
	return s, err
}

func (r *SprintRepo) Create(ctx context.Context, s models.Sprint) (models.Sprint, error) {
	row := r.pool.QueryRow(ctx,
		`INSERT INTO sprints (project_id, name, month, year, start_date, end_date, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING `+sprintColumns,
		s.ProjectID, s.Name, s.Month, s.Year, s.StartDate, s.EndDate, s.Status,
	)
	created, err := scanSprint(row)
	if isUniqueViolation(err, "sprints_project_id_month_year_key") {
		return models.Sprint{}, ErrDuplicateSprint
	}
	return created, err
}

func (r *SprintRepo) Start(ctx context.Context, id uuid.UUID) (models.Sprint, error) {
	row := r.pool.QueryRow(ctx,
		`UPDATE sprints SET status = 'Active' WHERE id = $1 RETURNING `+sprintColumns, id,
	)
	s, err := scanSprint(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Sprint{}, ErrNotFound
	}
	if isUniqueViolation(err, "uq_one_active_sprint_per_project") {
		return models.Sprint{}, ErrActiveSprintExists
	}
	return s, err
}

// Complete marks the sprint Completed and moves its unfinished issues
// (status != 'Done') back to the backlog (sprint_id = NULL), atomically.
func (r *SprintRepo) Complete(ctx context.Context, id uuid.UUID) (models.Sprint, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.Sprint{}, err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `UPDATE sprints SET status = 'Completed' WHERE id = $1 RETURNING `+sprintColumns, id)
	s, err := scanSprint(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Sprint{}, ErrNotFound
	}
	if err != nil {
		return models.Sprint{}, err
	}

	if _, err := tx.Exec(ctx, `UPDATE issues SET sprint_id = NULL, updated_at = now() WHERE sprint_id = $1 AND status <> 'Done'`, id); err != nil {
		return models.Sprint{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.Sprint{}, err
	}
	return s, nil
}

func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" && (constraint == "" || pgErr.ConstraintName == constraint)
	}
	return false
}
