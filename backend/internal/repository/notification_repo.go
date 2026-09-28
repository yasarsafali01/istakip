package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type NotificationRepo struct {
	pool *pgxpool.Pool
}

func NewNotificationRepo(pool *pgxpool.Pool) *NotificationRepo {
	return &NotificationRepo{pool: pool}
}

// Create inserts a notification. Callers should only call this when the
// recipient's NotifyPush preference is true (the only wired-up channel).
func (r *NotificationRepo) Create(ctx context.Context, userID uuid.UUID, ntype, title, body string, issueID *uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO notifications (user_id, type, title, body, issue_id) VALUES ($1,$2,$3,$4,$5)`,
		userID, ntype, title, body, issueID)
	return err
}

// ListByUser returns the most recent notifications for a user, newest first.
func (r *NotificationRepo) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]models.Notification, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, type, title, body, issue_id, created_at, read_at
		 FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
		userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &n.IssueID, &n.CreatedAt, &n.ReadAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *NotificationRepo) UnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`, userID,
	).Scan(&count)
	return count, err
}

// MarkRead marks one notification read, scoped to its owner (so a user can't
// mark someone else's notification read by guessing an id).
func (r *NotificationRepo) MarkRead(ctx context.Context, id, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`, id, userID)
	return err
}

func (r *NotificationRepo) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, userID)
	return err
}
