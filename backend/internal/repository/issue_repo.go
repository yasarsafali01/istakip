package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type IssueRepo struct {
	pool *pgxpool.Pool
}

func NewIssueRepo(pool *pgxpool.Pool) *IssueRepo {
	return &IssueRepo{pool: pool}
}

const issueSelectBase = `
	SELECT i.id, i.number, i.project_id, p.key, i.sprint_id, i.title, i.description, i.type,
	       i.priority, i.status, i.assignee_id, i.reporter_id, i.is_request, i.time_spent,
	       i.created_at, i.updated_at, i.resolved_at,
	       COALESCE(array_agg(v.user_id) FILTER (WHERE v.user_id IS NOT NULL), '{}')
	FROM issues i
	JOIN projects p ON p.id = i.project_id
	LEFT JOIN issue_visible_users v ON v.issue_id = i.id
`

const issueGroupBy = " GROUP BY i.id, p.key "

func scanIssue(row pgx.Row) (models.Issue, error) {
	var iss models.Issue
	err := row.Scan(&iss.ID, &iss.Number, &iss.ProjectID, &iss.ProjectKey, &iss.SprintID, &iss.Title, &iss.Description,
		&iss.Type, &iss.Priority, &iss.Status, &iss.AssigneeID, &iss.ReporterID, &iss.IsRequest, &iss.TimeSpent,
		&iss.CreatedAt, &iss.UpdatedAt, &iss.ResolvedAt, &iss.VisibleTo)
	if err == nil {
		iss.Key = fmt.Sprintf("%s-%d", iss.ProjectKey, iss.Number)
	}
	return iss, err
}

// VisibilityScope narrows the issue list to what a role is allowed to see —
// the backend equivalent of frontend/src/utils/permissionUtils.js's
// getVisibleIssues/getVisibleRequests. Exactly the field matching the
// caller's role should be set.
type VisibilityScope struct {
	All          bool
	UnitID       *uuid.UUID // Department_Head
	ManagerID    *uuid.UUID // Project_Manager
	ProjectID    *uuid.UUID // Worker
	OwnOrVisible *uuid.UUID // External_User: reporter_id = X OR visible to X
}

// IssueFilter holds optional query-string filters layered on top of the
// visibility scope.
type IssueFilter struct {
	ProjectID   *uuid.UUID
	SprintID    *uuid.UUID
	BacklogOnly bool
	IsRequest   *bool
	AssigneeID  *uuid.UUID
	Priority    string
}

func (r *IssueRepo) List(ctx context.Context, scope VisibilityScope, filter IssueFilter) ([]models.Issue, error) {
	query := issueSelectBase
	var clauses []string
	var args []interface{}
	arg := func(v interface{}) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	switch {
	case scope.All:
		// no restriction
	case scope.UnitID != nil:
		clauses = append(clauses, "p.unit_id = "+arg(*scope.UnitID))
	case scope.ManagerID != nil:
		clauses = append(clauses, "p.manager_id = "+arg(*scope.ManagerID))
	case scope.ProjectID != nil:
		clauses = append(clauses, "i.project_id = "+arg(*scope.ProjectID))
	case scope.OwnOrVisible != nil:
		placeholder := arg(*scope.OwnOrVisible)
		clauses = append(clauses, fmt.Sprintf(
			"(i.reporter_id = %s OR EXISTS (SELECT 1 FROM issue_visible_users vv WHERE vv.issue_id = i.id AND vv.user_id = %s))",
			placeholder, placeholder))
	default:
		clauses = append(clauses, "false") // no scope matched → nothing visible
	}

	if filter.ProjectID != nil {
		clauses = append(clauses, "i.project_id = "+arg(*filter.ProjectID))
	}
	if filter.BacklogOnly {
		clauses = append(clauses, "i.sprint_id IS NULL")
	} else if filter.SprintID != nil {
		clauses = append(clauses, "i.sprint_id = "+arg(*filter.SprintID))
	}
	if filter.IsRequest != nil {
		clauses = append(clauses, "i.is_request = "+arg(*filter.IsRequest))
	}
	if filter.AssigneeID != nil {
		clauses = append(clauses, "i.assignee_id = "+arg(*filter.AssigneeID))
	}
	if filter.Priority != "" {
		clauses = append(clauses, "i.priority = "+arg(filter.Priority))
	}

	for i, c := range clauses {
		if i == 0 {
			query += " WHERE " + c
		} else {
			query += " AND " + c
		}
	}
	query += issueGroupBy + " ORDER BY i.created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Issue
	for rows.Next() {
		iss, err := scanIssue(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, iss)
	}
	return out, rows.Err()
}

func (r *IssueRepo) GetByID(ctx context.Context, id uuid.UUID) (models.Issue, error) {
	row := r.pool.QueryRow(ctx, issueSelectBase+" WHERE i.id = $1"+issueGroupBy, id)
	iss, err := scanIssue(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Issue{}, ErrNotFound
	}
	return iss, err
}

type NewIssue struct {
	ProjectID   uuid.UUID
	SprintID    *uuid.UUID
	Title       string
	Description string
	Type        string
	Priority    string
	AssigneeID  *uuid.UUID
	ReporterID  uuid.UUID
	IsRequest   bool
}

// Create atomically reserves the next issue number for the project and
// inserts the issue, avoiding a race between concurrent creations.
func (r *IssueRepo) Create(ctx context.Context, in NewIssue) (models.Issue, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.Issue{}, err
	}
	defer tx.Rollback(ctx)

	var number int
	if err := tx.QueryRow(ctx,
		`UPDATE projects SET next_issue_number = next_issue_number + 1
		 WHERE id = $1 RETURNING next_issue_number - 1`,
		in.ProjectID,
	).Scan(&number); err != nil {
		return models.Issue{}, err
	}

	var id uuid.UUID
	if err := tx.QueryRow(ctx,
		`INSERT INTO issues (number, project_id, sprint_id, title, description, type, priority, status,
		                     assignee_id, reporter_id, is_request)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,'To Do',$8,$9,$10) RETURNING id`,
		number, in.ProjectID, in.SprintID, in.Title, in.Description, in.Type, in.Priority,
		in.AssigneeID, in.ReporterID, in.IsRequest,
	).Scan(&id); err != nil {
		return models.Issue{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.Issue{}, err
	}
	return r.GetByID(ctx, id)
}

type IssueUpdate struct {
	Title         *string
	Description   *string
	Type          *string
	Priority      *string
	ProjectID     *uuid.UUID
	AssigneeID    *uuid.UUID
	ClearAssignee bool
}

func (r *IssueRepo) Update(ctx context.Context, id uuid.UUID, u IssueUpdate) (models.Issue, error) {
	_, err := r.pool.Exec(ctx,
		`UPDATE issues SET
		   title = COALESCE($2, title),
		   description = COALESCE($3, description),
		   type = COALESCE($4, type),
		   priority = COALESCE($5, priority),
		   project_id = COALESCE($6, project_id),
		   assignee_id = CASE WHEN $7 THEN NULL ELSE COALESCE($8, assignee_id) END,
		   updated_at = now()
		 WHERE id = $1`,
		id, u.Title, u.Description, u.Type, u.Priority, u.ProjectID, u.ClearAssignee, u.AssigneeID,
	)
	if err != nil {
		return models.Issue{}, err
	}
	return r.GetByID(ctx, id)
}

// SetStatus changes status for any transition other than "Done" (that flow
// is handled separately by Complete, which also records resolution details).
func (r *IssueRepo) SetStatus(ctx context.Context, id uuid.UUID, status string) (models.Issue, error) {
	_, err := r.pool.Exec(ctx, `UPDATE issues SET status = $2, updated_at = now() WHERE id = $1`, id, status)
	if err != nil {
		return models.Issue{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *IssueRepo) SetAssignee(ctx context.Context, id uuid.UUID, assigneeID *uuid.UUID) (models.Issue, error) {
	_, err := r.pool.Exec(ctx, `UPDATE issues SET assignee_id = $2, updated_at = now() WHERE id = $1`, id, assigneeID)
	if err != nil {
		return models.Issue{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *IssueRepo) SetSprint(ctx context.Context, id uuid.UUID, sprintID *uuid.UUID) (models.Issue, error) {
	_, err := r.pool.Exec(ctx, `UPDATE issues SET sprint_id = $2, updated_at = now() WHERE id = $1`, id, sprintID)
	if err != nil {
		return models.Issue{}, err
	}
	return r.GetByID(ctx, id)
}

// SetDates updates resolvedAt/timeSpent independently of a status
// transition (Requirement 19.5/19.6 — PM/DeptHead/Admin adjusting these
// after the fact).
func (r *IssueRepo) SetDates(ctx context.Context, id uuid.UUID, resolvedAt *time.Time, timeSpent int) (models.Issue, error) {
	_, err := r.pool.Exec(ctx,
		`UPDATE issues SET resolved_at = $2, time_spent = $3, updated_at = now() WHERE id = $1`,
		id, resolvedAt, timeSpent,
	)
	if err != nil {
		return models.Issue{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *IssueRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM issues WHERE id = $1`, id)
	return err
}

func (r *IssueRepo) AddVisibleUser(ctx context.Context, issueID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO issue_visible_users (issue_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		issueID, userID,
	)
	return err
}

// CompleteResult is what the "Done" transaction needs and returns.
type CompleteParams struct {
	IssueID          uuid.UUID
	ResolutionNote   string
	ResolverID       uuid.UUID
	InventoryItemID  *uuid.UUID
	InventoryUsedQty int
}

type CompleteResult struct {
	Issue        models.Issue
	StockWarning bool
}

// Complete transitions an issue to Done: sets status/resolvedAt, records the
// resolution note as a comment + activity, and (if an inventory item was
// selected) atomically decrements its quantity — allowed to go negative
// (soft warning, not a hard block), also logged as an activity.
func (r *IssueRepo) Complete(ctx context.Context, p CompleteParams) (CompleteResult, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return CompleteResult{}, err
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	if _, err := tx.Exec(ctx,
		`UPDATE issues SET status = 'Done', resolved_at = COALESCE(resolved_at, $2), updated_at = $2 WHERE id = $1`,
		p.IssueID, now,
	); err != nil {
		return CompleteResult{}, err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO comments (issue_id, author_id, text, created_at) VALUES ($1, $2, $3, $4)`,
		p.IssueID, p.ResolverID, p.ResolutionNote, now,
	); err != nil {
		return CompleteResult{}, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO activities (issue_id, user_id, type, description, created_at) VALUES ($1, $2, 'status_change', $3, $4)`,
		p.IssueID, p.ResolverID, `Durum "Done" olarak değiştirildi`, now,
	); err != nil {
		return CompleteResult{}, err
	}

	result := CompleteResult{}
	if p.InventoryItemID != nil && p.InventoryUsedQty > 0 {
		var beforeQty int
		if err := tx.QueryRow(ctx, `SELECT quantity FROM inventory WHERE id = $1`, *p.InventoryItemID).Scan(&beforeQty); err != nil {
			return CompleteResult{}, err
		}
		if beforeQty < p.InventoryUsedQty {
			result.StockWarning = true
		}
		var itemName string
		if err := tx.QueryRow(ctx,
			`UPDATE inventory SET quantity = quantity - $2 WHERE id = $1 RETURNING name`,
			*p.InventoryItemID, p.InventoryUsedQty,
		).Scan(&itemName); err != nil {
			return CompleteResult{}, err
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO activities (issue_id, user_id, type, description, created_at) VALUES ($1, $2, 'field_update', $3, $4)`,
			p.IssueID, p.ResolverID, fmt.Sprintf("%s stoktan %d adet düşüldü", itemName, p.InventoryUsedQty), now,
		); err != nil {
			return CompleteResult{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return CompleteResult{}, err
	}

	issue, err := r.GetByID(ctx, p.IssueID)
	result.Issue = issue
	return result, err
}

// Clone duplicates a request: new number, title suffixed "(Kopya)", status
// reset to To Do, resolvedAt/timeSpent/assignee/visibleTo cleared.
func (r *IssueRepo) Clone(ctx context.Context, sourceID uuid.UUID) (models.Issue, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.Issue{}, err
	}
	defer tx.Rollback(ctx)

	var projectID, reporterID uuid.UUID
	var title, description, itype, priority string
	var isRequest bool
	if err := tx.QueryRow(ctx,
		`SELECT project_id, title, description, type, priority, is_request, reporter_id FROM issues WHERE id = $1`, sourceID,
	).Scan(&projectID, &title, &description, &itype, &priority, &isRequest, &reporterID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.Issue{}, ErrNotFound
		}
		return models.Issue{}, err
	}

	var number int
	if err := tx.QueryRow(ctx,
		`UPDATE projects SET next_issue_number = next_issue_number + 1
		 WHERE id = $1 RETURNING next_issue_number - 1`,
		projectID,
	).Scan(&number); err != nil {
		return models.Issue{}, err
	}

	var newID uuid.UUID
	if err := tx.QueryRow(ctx,
		`INSERT INTO issues (number, project_id, title, description, type, priority, status, is_request, reporter_id)
		 VALUES ($1, $2, $3, $4, $5, $6, 'To Do', $7, $8) RETURNING id`,
		number, projectID, title+" (Kopya)", description, itype, priority, isRequest, reporterID,
	).Scan(&newID); err != nil {
		return models.Issue{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.Issue{}, err
	}
	return r.GetByID(ctx, newID)
}
