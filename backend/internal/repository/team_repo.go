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

// ErrNotUnitStaff: the user doesn't belong to the daire başkanlığı that owns
// the team's müdürlük.
var ErrNotUnitStaff = errors.New("user is not staff of the team's unit")

// AddMember adds a user to a team. Any staff of the same daire başkanlığı may
// join, so one person can serve on teams of several müdürlükler in that unit.
func (r *TeamRepo) AddMember(ctx context.Context, teamID, userID uuid.UUID) error {
	var staff bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
		  SELECT 1 FROM teams t
		  JOIN projects p ON p.id = t.project_id
		  JOIN users u ON u.id = $2
		  WHERE t.id = $1 AND (u.unit_id = p.unit_id OR p.manager_id = u.id))`,
		teamID, userID).Scan(&staff); err != nil {
		return err
	}
	if !staff {
		return ErrNotUnitStaff
	}
	_, err := r.pool.Exec(ctx,
		`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, teamID, userID)
	return err
}

// MembershipsOf returns every team the user belongs to, with its müdürlük.
func (r *TeamRepo) MembershipsOf(ctx context.Context, userID uuid.UUID) ([]models.TeamMembership, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.name, p.id, p.name
		 FROM team_members m
		 JOIN teams t ON t.id = m.team_id
		 JOIN projects p ON p.id = t.project_id
		 WHERE m.user_id = $1
		 ORDER BY p.name, t.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.TeamMembership{}
	for rows.Next() {
		var m models.TeamMembership
		if err := rows.Scan(&m.TeamID, &m.TeamName, &m.ProjectID, &m.ProjectName); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *TeamRepo) RemoveMember(ctx context.Context, teamID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, teamID, userID)
	return err
}

// ErrTeamOutsideUnit: a requested team belongs to another daire başkanlığı.
var ErrTeamOutsideUnit = errors.New("team outside unit")

// SetUserTeams replaces the user's memberships among the teams of one daire
// başkanlığı; memberships in other units' teams are left untouched.
func (r *TeamRepo) SetUserTeams(ctx context.Context, userID, unitID uuid.UUID, teamIDs []uuid.UUID) error {
	unique := map[uuid.UUID]bool{}
	ids := []uuid.UUID{}
	for _, id := range teamIDs {
		if !unique[id] {
			unique[id] = true
			ids = append(ids, id)
		}
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var inUnit int
	if err := tx.QueryRow(ctx, `
		SELECT count(*) FROM teams t JOIN projects p ON p.id = t.project_id
		WHERE t.id = ANY($1) AND p.unit_id = $2`, ids, unitID).Scan(&inUnit); err != nil {
		return err
	}
	if inUnit != len(ids) {
		return ErrTeamOutsideUnit
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM team_members m USING teams t, projects p
		WHERE m.team_id = t.id AND p.id = t.project_id AND m.user_id = $1 AND p.unit_id = $2`, userID, unitID); err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := tx.Exec(ctx,
			`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
