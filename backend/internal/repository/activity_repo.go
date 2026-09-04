package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type ActivityRepo struct {
	pool *pgxpool.Pool
}

func NewActivityRepo(pool *pgxpool.Pool) *ActivityRepo {
	return &ActivityRepo{pool: pool}
}

func scanActivity(row pgx.Row) (models.Activity, error) {
	var a models.Activity
	err := row.Scan(&a.ID, &a.IssueID, &a.UserID, &a.Type, &a.Description, &a.CreatedAt)
	return a, err
}

func (r *ActivityRepo) Create(ctx context.Context, issueID, userID uuid.UUID, activityType, description string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO activities (issue_id, user_id, type, description) VALUES ($1, $2, $3, $4)`,
		issueID, userID, activityType, description,
	)
	return err
}

// ListByIssue returns activities newest-first (Property 5: activity feed is
// always sorted newest → oldest).
func (r *ActivityRepo) ListByIssue(ctx context.Context, issueID uuid.UUID) ([]models.Activity, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, issue_id, user_id, type, description, created_at
		 FROM activities WHERE issue_id = $1 ORDER BY created_at DESC`,
		issueID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Activity
	for rows.Next() {
		a, err := scanActivity(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
