package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type ReplyTemplateRepo struct {
	pool *pgxpool.Pool
}

func NewReplyTemplateRepo(pool *pgxpool.Pool) *ReplyTemplateRepo {
	return &ReplyTemplateRepo{pool: pool}
}

const templateColumns = "id, project_id, title, body, sort_order, is_active, created_at"

func scanTemplate(row pgx.Row) (models.ReplyTemplate, error) {
	var t models.ReplyTemplate
	err := row.Scan(&t.ID, &t.ProjectID, &t.Title, &t.Body, &t.SortOrder, &t.IsActive, &t.CreatedAt)
	return t, err
}

// ListByProject returns active templates by default; includeInactive=true for the management screen.
func (r *ReplyTemplateRepo) ListByProject(ctx context.Context, projectID uuid.UUID, includeInactive bool) ([]models.ReplyTemplate, error) {
	query := "SELECT " + templateColumns + " FROM reply_templates WHERE project_id = $1"
	if !includeInactive {
		query += " AND is_active = true"
	}
	query += " ORDER BY sort_order, title"

	rows, err := r.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.ReplyTemplate{}
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *ReplyTemplateRepo) GetByID(ctx context.Context, id uuid.UUID) (models.ReplyTemplate, error) {
	row := r.pool.QueryRow(ctx, "SELECT "+templateColumns+" FROM reply_templates WHERE id = $1", id)
	t, err := scanTemplate(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ReplyTemplate{}, ErrNotFound
	}
	return t, err
}

func (r *ReplyTemplateRepo) Create(ctx context.Context, projectID uuid.UUID, title, body string, sortOrder int) (models.ReplyTemplate, error) {
	var id uuid.UUID
	if err := r.pool.QueryRow(ctx,
		`INSERT INTO reply_templates (project_id, title, body, sort_order) VALUES ($1,$2,$3,$4) RETURNING id`,
		projectID, title, body, sortOrder,
	).Scan(&id); err != nil {
		return models.ReplyTemplate{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *ReplyTemplateRepo) Update(ctx context.Context, id uuid.UUID, title, body string, sortOrder int, isActive bool) (models.ReplyTemplate, error) {
	tag, err := r.pool.Exec(ctx,
		`UPDATE reply_templates SET title = $2, body = $3, sort_order = $4, is_active = $5 WHERE id = $1`,
		id, title, body, sortOrder, isActive)
	if err != nil {
		return models.ReplyTemplate{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.ReplyTemplate{}, ErrNotFound
	}
	return r.GetByID(ctx, id)
}

func (r *ReplyTemplateRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM reply_templates WHERE id = $1`, id)
	return err
}
