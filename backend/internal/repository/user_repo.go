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

const userColumns = "id, name, email, password_hash, role, unit_id, project_id, avatar_color, created_at"

func scanUser(row pgx.Row) (models.User, error) {
	var u models.User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.UnitID, &u.ProjectID, &u.AvatarColor, &u.CreatedAt)
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

	var out []models.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
