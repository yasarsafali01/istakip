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

var ErrNotFound = errors.New("not found")

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

const userColumns = "id, name, email, password_hash, role, unit_id, project_id, avatar_color, created_at, " +
	"building, floor, room, notify_email, notify_sms, notify_push, is_active, " +
	"COALESCE((SELECT array_agg(x.role_key ORDER BY x.role_key) FROM user_extra_roles x WHERE x.user_id = users.id), '{}'), " +
	"COALESCE((SELECT array_agg(up.project_id ORDER BY up.project_id = users.project_id DESC, up.project_id) " +
	"FROM user_projects up WHERE up.user_id = users.id), '{}')"

// prefixedUserColumns is userColumns for queries that alias users as "u".
var prefixedUserColumns = "u.id, u.name, u.email, u.password_hash, u.role, u.unit_id, u.project_id, u.avatar_color, u.created_at, " +
	"u.building, u.floor, u.room, u.notify_email, u.notify_sms, u.notify_push, u.is_active, " +
	"COALESCE((SELECT array_agg(x.role_key ORDER BY x.role_key) FROM user_extra_roles x WHERE x.user_id = u.id), '{}'), " +
	"COALESCE((SELECT array_agg(up.project_id ORDER BY up.project_id = u.project_id DESC, up.project_id) " +
	"FROM user_projects up WHERE up.user_id = u.id), '{}')"

func scanUser(row pgx.Row) (models.User, error) {
	var u models.User
	var extra []string
	err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.UnitID, &u.ProjectID, &u.AvatarColor, &u.CreatedAt,
		&u.Building, &u.Floor, &u.Room, &u.NotifyEmail, &u.NotifySMS, &u.NotifyPush, &u.IsActive, &extra, &u.ProjectIDs,
	)
	u.ExtraRoles = make([]models.Role, len(extra))
	for i, k := range extra {
		u.ExtraRoles[i] = models.Role(k)
	}
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
	if projectID != nil {
		if _, err := r.pool.Exec(ctx,
			`INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, *projectID); err != nil {
			return models.User{}, err
		}
	}
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

// SetExtraRoles replaces the user's additional roles.
func (r *UserRepo) SetExtraRoles(ctx context.Context, id uuid.UUID, roles []models.Role) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM user_extra_roles WHERE user_id = $1`, id); err != nil {
		return err
	}
	for _, role := range roles {
		if _, err := tx.Exec(ctx,
			`INSERT INTO user_extra_roles (user_id, role_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, role); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
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

var ErrEmailTaken = errors.New("email already registered")

func mapEmailTaken(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "users_email_key" {
		return ErrEmailTaken
	}
	return err
}

type NewUser struct {
	Name         string
	Email        string
	PasswordHash string
	Role         models.Role
	UnitID       *uuid.UUID
	ProjectIDs   []uuid.UUID // first one is the primary müdürlük
	AvatarColor  string
}

// setProjects replaces the user's müdürlükler; the first becomes the primary.
func setProjects(ctx context.Context, tx pgx.Tx, id uuid.UUID, projectIDs []uuid.UUID) error {
	if _, err := tx.Exec(ctx, `DELETE FROM user_projects WHERE user_id = $1`, id); err != nil {
		return err
	}
	for _, pid := range projectIDs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, pid); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `UPDATE users SET project_id = $2 WHERE id = $1`, id, projectIDs[0])
	return err
}

func (r *UserRepo) Create(ctx context.Context, in NewUser) (models.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.User{}, err
	}
	defer tx.Rollback(ctx)
	var id uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, role, unit_id, avatar_color)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		in.Name, in.Email, in.PasswordHash, in.Role, in.UnitID, in.AvatarColor).Scan(&id); err != nil {
		return models.User{}, mapEmailTaken(err)
	}
	if err := setProjects(ctx, tx, id, in.ProjectIDs); err != nil {
		return models.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.User{}, err
	}
	return r.GetByID(ctx, id)
}

// UpdateDetails changes a user's name, e-mail and müdürlükler.
func (r *UserRepo) UpdateDetails(ctx context.Context, id uuid.UUID, name, email string, projectIDs []uuid.UUID) (models.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.User{}, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE users SET name = $2, email = $3 WHERE id = $1`, id, name, email)
	if err != nil {
		return models.User{}, mapEmailTaken(err)
	}
	if tag.RowsAffected() == 0 {
		return models.User{}, ErrNotFound
	}
	if err := setProjects(ctx, tx, id, projectIDs); err != nil {
		return models.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.User{}, err
	}
	return r.GetByID(ctx, id)
}

// ProjectIDsOf returns every müdürlük the user serves in.
func (r *UserRepo) ProjectIDsOf(ctx context.Context, id uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(array_agg(project_id), '{}') FROM user_projects WHERE user_id = $1`, id).Scan(&ids)
	return ids, err
}

// Deactivate disables sign-in, ends open sessions and drops team memberships.
// The row stays so the user's issues, comments and activities keep their author.
func (r *UserRepo) Deactivate(ctx context.Context, id uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE users SET is_active = FALSE WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if _, err := tx.Exec(ctx, `DELETE FROM team_members WHERE user_id = $1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ErrUserOutsideUnit: a selected person isn't active staff of the müdürlük's unit.
var ErrUserOutsideUnit = errors.New("user outside unit")

// SetProjectMembers makes exactly userIDs the personnel of a müdürlük. People
// for whom this is the only müdürlük stay (everyone belongs to at least one);
// primary müdürlükler are fixed up for whoever gained or lost this one.
func (r *UserRepo) SetProjectMembers(ctx context.Context, projectID, unitID uuid.UUID, userIDs []uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var valid int
	if err := tx.QueryRow(ctx, `
		SELECT count(DISTINCT id) FROM users
		WHERE id = ANY($1) AND unit_id = $2 AND is_active
		  AND role NOT IN (SELECT key FROM roles WHERE scope = 'own')`,
		userIDs, unitID).Scan(&valid); err != nil {
		return err
	}
	unique := map[uuid.UUID]bool{}
	for _, id := range userIDs {
		unique[id] = true
	}
	if valid != len(unique) {
		return ErrUserOutsideUnit
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM user_projects up
		WHERE up.project_id = $1 AND NOT (up.user_id = ANY($2))
		  AND EXISTS (SELECT 1 FROM user_projects o WHERE o.user_id = up.user_id AND o.project_id <> $1)`,
		projectID, userIDs); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_projects (user_id, project_id)
		SELECT unnest($2::uuid[]), $1 ON CONFLICT DO NOTHING`, projectID, userIDs); err != nil {
		return err
	}
	// Primary müdürlük: set it for people who had none, move it for people who left this one.
	if _, err := tx.Exec(ctx, `
		UPDATE users u SET project_id = (SELECT up.project_id FROM user_projects up WHERE up.user_id = u.id
		                                 ORDER BY up.project_id = $1 DESC LIMIT 1)
		WHERE (u.project_id IS NULL AND u.id = ANY($2))
		   OR (u.project_id = $1 AND NOT EXISTS (
		         SELECT 1 FROM user_projects up WHERE up.user_id = u.id AND up.project_id = $1))`,
		projectID, userIDs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// assignableWhere: active people (not requesters) who may hold an issue of
// müdürlük $1 — by their primary role's scope: system-wide, the müdürlük's
// daire başkanlığı, its manager, or serving in it (directly or via its teams).
const assignableWhere = `
	u.is_active AND r.scope <> 'own' AND (
	  r.scope = 'all'
	  OR (r.scope = 'unit' AND u.unit_id = p.unit_id)
	  OR (r.scope = 'manager' AND p.manager_id = u.id)
	  OR EXISTS (SELECT 1 FROM user_projects up WHERE up.user_id = u.id AND up.project_id = p.id)
	  OR EXISTS (SELECT 1 FROM team_members tm JOIN teams t ON t.id = tm.team_id
	             WHERE tm.user_id = u.id AND t.project_id = p.id))`

// AssignableUsers lists who an issue of the müdürlük can be assigned to.
func (r *UserRepo) AssignableUsers(ctx context.Context, projectID uuid.UUID) ([]models.User, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+prefixedUserColumns+`
		FROM users u JOIN roles r ON r.key = u.role JOIN projects p ON p.id = $1
		WHERE `+assignableWhere+` ORDER BY u.name`, projectID)
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

// IsAssignable reports whether the user may hold an issue of the müdürlük.
func (r *UserRepo) IsAssignable(ctx context.Context, projectID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM users u JOIN roles r ON r.key = u.role JOIN projects p ON p.id = $1
		               WHERE u.id = $2 AND `+assignableWhere+`)`, projectID, userID).Scan(&ok)
	return ok, err
}
