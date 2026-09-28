package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

var ErrNotFound = errors.New("not found")

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

const userColumns = "id, name, email, password_hash, role, unit_id, project_id, avatar_color, created_at, " +
	"building, floor, room, notify_email, notify_sms, notify_push"

func scanUser(row pgx.Row) (models.User, error) {
	var u models.User
	err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.UnitID, &u.ProjectID, &u.AvatarColor, &u.CreatedAt,
		&u.Building, &u.Floor, &u.Room, &u.NotifyEmail, &u.NotifySMS, &u.NotifyPush,
	)
	return u, err
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (models.User, error) {
	row := r.pool.QueryRow(ctx, "SELECT "+userColumns+" FROM users WHERE lower(email) = lower($1)", email)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return u, err
}

func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (models.User, error) {
	row := r.pool.QueryRow(ctx, "SELECT "+userColumns+" FROM users WHERE id = $1", id)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return u, err
}

func (r *UserRepo) List(ctx context.Context) ([]models.User, error) {
	rows, err := r.pool.Query(ctx, "SELECT "+userColumns+" FROM users ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// SetRole assigns a role (and optionally a unit/project) to a user.
func (r *UserRepo) SetRole(ctx context.Context, id uuid.UUID, role models.Role, unitID, projectID *uuid.UUID) (models.User, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE users SET role = $2,
		  unit_id = COALESCE($3, unit_id),
		  project_id = COALESCE($4, project_id)
		WHERE id = $1 RETURNING `+userColumns, id, role, unitID, projectID)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return u, err
}

// UpdateProfile updates a user's own editable profile fields.
func (r *UserRepo) UpdateProfile(ctx context.Context, id uuid.UUID, building, floor, room *string, notifyEmail, notifySMS, notifyPush bool) (models.User, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE users SET building = $2, floor = $3, room = $4,
		  notify_email = $5, notify_sms = $6, notify_push = $7
		WHERE id = $1 RETURNING `+userColumns, id, building, floor, room, notifyEmail, notifySMS, notifyPush)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return u, err
}

// UpdatePasswordHash sets a new bcrypt hash for the user (password change).
func (r *UserRepo) UpdatePasswordHash(ctx context.Context, id uuid.UUID, hash string) error {
	tag, err := r.pool.Exec(ctx, "UPDATE users SET password_hash = $2 WHERE id = $1", id, hash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetPasswordHash returns just the bcrypt hash (for change-password verification).
func (r *UserRepo) GetPasswordHash(ctx context.Context, id uuid.UUID) (string, error) {
	var hash string
	err := r.pool.QueryRow(ctx, "SELECT password_hash FROM users WHERE id = $1", id).Scan(&hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return hash, err
}
