package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type CommentRepo struct {
	pool *pgxpool.Pool
}

func NewCommentRepo(pool *pgxpool.Pool) *CommentRepo {
	return &CommentRepo{pool: pool}
}

func scanComment(row pgx.Row) (models.Comment, error) {
	var c models.Comment
	err := row.Scan(&c.ID, &c.IssueID, &c.AuthorID, &c.Text, &c.CreatedAt)
	return c, err
}

func (r *CommentRepo) ListByIssue(ctx context.Context, issueID uuid.UUID) ([]models.Comment, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, issue_id, author_id, text, created_at FROM comments WHERE issue_id = $1 ORDER BY created_at`,
		issueID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Comment
	for rows.Next() {
		c, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *CommentRepo) Create(ctx context.Context, issueID, authorID uuid.UUID, text string) (models.Comment, error) {
	row := r.pool.QueryRow(ctx,
		`INSERT INTO comments (issue_id, author_id, text) VALUES ($1, $2, $3)
		 RETURNING id, issue_id, author_id, text, created_at`,
		issueID, authorID, text,
	)
	return scanComment(row)
}

func (r *CommentRepo) GetByID(ctx context.Context, id uuid.UUID) (models.Comment, error) {
	row := r.pool.QueryRow(ctx, `SELECT id, issue_id, author_id, text, created_at FROM comments WHERE id = $1`, id)
	c, err := scanComment(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Comment{}, ErrNotFound
	}
	return c, err
}

func (r *CommentRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM comments WHERE id = $1`, id)
	return err
}
