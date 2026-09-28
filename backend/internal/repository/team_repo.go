package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type TeamRepo struct {
	pool *pgxpool.Pool
}

func NewTeamRepo(pool *pgxpool.Pool) *TeamRepo {
	return &TeamRepo{pool: pool}
}

// ListByProject returns every team for a project along with its member ids.
func (r *TeamRepo) ListByProject(ctx context.Context, projectID uuid.UUID) ([]models.Team, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.project_id, t.name, t.created_at,
		        COALESCE(array_agg(m.user_id) FILTER (WHERE m.user_id IS NOT NULL), '{}')
		 FROM teams t
		 LEFT JOIN team_members m ON m.team_id = t.id
		 WHERE t.project_id = $1
		 GROUP BY t.id
		 ORDER BY t.name`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Team{}
	for rows.Next() {
		var t models.Team
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.CreatedAt, &t.MemberIDs); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *TeamRepo) GetByID(ctx context.Context, id uuid.UUID) (models.Team, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT t.id, t.project_id, t.name, t.created_at,
		        COALESCE(array_agg(m.user_id) FILTER (WHERE m.user_id IS NOT NULL), '{}')
		 FROM teams t
		 LEFT JOIN team_members m ON m.team_id = t.id
		 WHERE t.id = $1
		 GROUP BY t.id`, id)
	var t models.Team
	err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.CreatedAt, &t.MemberIDs)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Team{}, ErrNotFound
	}
	return t, err
}

func (r *TeamRepo) Create(ctx context.Context, projectID uuid.UUID, name string) (models.Team, error) {
	var id uuid.UUID
	if err := r.pool.QueryRow(ctx,
		`INSERT INTO teams (project_id, name) VALUES ($1, $2) RETURNING id`, projectID, name,
	).Scan(&id); err != nil {
		return models.Team{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *TeamRepo) Rename(ctx context.Context, id uuid.UUID, name string) (models.Team, error) {
	tag, err := r.pool.Exec(ctx, `UPDATE teams SET name = $2 WHERE id = $1`, id, name)
	if err != nil {
		return models.Team{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Team{}, ErrNotFound
	}
	return r.GetByID(ctx, id)
}

func (r *TeamRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM teams WHERE id = $1`, id)
	return err
}

func (r *TeamRepo) AddMember(ctx context.Context, teamID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, teamID, userID)
	return err
}

func (r *TeamRepo) RemoveMember(ctx context.Context, teamID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, teamID, userID)
	return err
}
