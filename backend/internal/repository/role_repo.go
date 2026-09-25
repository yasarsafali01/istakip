package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

var ErrRoleInUse = errors.New("role is assigned to users")

type RoleRepo struct {
	pool *pgxpool.Pool
}

func NewRoleRepo(pool *pgxpool.Pool) *RoleRepo {
	return &RoleRepo{pool: pool}
}

// List returns every role with its permissions and how many users hold it.
func (r *RoleRepo) List(ctx context.Context) ([]models.RoleDef, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.key, r.name, r.description, r.scope, r.is_system,
		       COALESCE((SELECT count(*) FROM users u WHERE u.role = r.key), 0)
		FROM roles r ORDER BY r.is_system DESC, r.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.RoleDef
	index := map[models.Role]int{}
	for rows.Next() {
		var d models.RoleDef
		if err := rows.Scan(&d.Key, &d.Name, &d.Description, &d.Scope, &d.IsSystem, &d.UserCount); err != nil {
			return nil, err
		}
		d.Permissions = []string{}
		index[d.Key] = len(out)
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	prows, err := r.pool.Query(ctx, "SELECT role_key, permission FROM role_permissions ORDER BY permission")
	if err != nil {
		return nil, err
	}
	defer prows.Close()
	for prows.Next() {
		var key models.Role
		var perm string
		if err := prows.Scan(&key, &perm); err != nil {
			return nil, err
		}
		if i, ok := index[key]; ok {
			out[i].Permissions = append(out[i].Permissions, perm)
		}
	}
	return out, prows.Err()
}

func (r *RoleRepo) Get(ctx context.Context, key models.Role) (models.RoleDef, error) {
	all, err := r.List(ctx)
	if err != nil {
		return models.RoleDef{}, err
	}
	for _, d := range all {
		if d.Key == key {
			return d, nil
		}
	}
	return models.RoleDef{}, ErrNotFound
}

func (r *RoleRepo) Create(ctx context.Context, d models.RoleDef) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		"INSERT INTO roles (key, name, description, scope, is_system) VALUES ($1,$2,$3,$4,FALSE)",
		d.Key, d.Name, d.Description, d.Scope); err != nil {
		return err
	}
	if err := setPermissions(ctx, tx, d.Key, d.Permissions); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Update replaces a role's name, description and permission set. The scope is
// only changed when scope is non-empty (custom roles).
func (r *RoleRepo) Update(ctx context.Context, key models.Role, name, description string, scope models.Scope, permissions []string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		"UPDATE roles SET name = $2, description = $3, scope = COALESCE(NULLIF($4,''), scope) WHERE key = $1",
		key, name, description, string(scope))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err := setPermissions(ctx, tx, key, permissions); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func setPermissions(ctx context.Context, tx pgx.Tx, key models.Role, permissions []string) error {
	if _, err := tx.Exec(ctx, "DELETE FROM role_permissions WHERE role_key = $1", key); err != nil {
		return err
	}
	for _, p := range permissions {
		if _, err := tx.Exec(ctx, "INSERT INTO role_permissions (role_key, permission) VALUES ($1,$2) ON CONFLICT DO NOTHING", key, p); err != nil {
			return err
		}
	}
	return nil
}

// Delete removes a custom role that no user holds.
func (r *RoleRepo) Delete(ctx context.Context, key models.Role) error {
	var inUse bool
	if err := r.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE role = $1)", key).Scan(&inUse); err != nil {
		return err
	}
	if inUse {
		return ErrRoleInUse
	}
	tag, err := r.pool.Exec(ctx, "DELETE FROM roles WHERE key = $1 AND is_system = FALSE", key)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UserRoles returns every user's current role so the auth layer can honour a
// role change without waiting for the user's access token to expire.
func (r *RoleRepo) UserRoles(ctx context.Context) (map[uuid.UUID]models.Role, error) {
	rows, err := r.pool.Query(ctx, "SELECT id, role FROM users")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[uuid.UUID]models.Role{}
	for rows.Next() {
		var id uuid.UUID
		var role models.Role
		if err := rows.Scan(&id, &role); err != nil {
			return nil, err
		}
		out[id] = role
	}
	return out, rows.Err()
}
