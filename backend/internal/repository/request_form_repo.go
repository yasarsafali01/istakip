package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type RequestFormRepo struct {
	pool *pgxpool.Pool
}

func NewRequestFormRepo(pool *pgxpool.Pool) *RequestFormRepo {
	return &RequestFormRepo{pool: pool}
}

// ErrQuestionFormMismatch: a submitted question id already belongs to a
// different form, so the save would hijack another form's question.
var ErrQuestionFormMismatch = errors.New("question belongs to another form")

const formColumns = "id, project_id, name, description, is_active, sort_order, created_at"

func scanForm(row pgx.Row) (models.RequestForm, error) {
	var f models.RequestForm
	err := row.Scan(&f.ID, &f.ProjectID, &f.Name, &f.Description, &f.IsActive, &f.SortOrder, &f.CreatedAt)
	f.Questions = []models.RequestQuestion{}
	return f, err
}

// ListByProject returns the project's forms with their questions; inactive
// forms only when includeInactive (the management screen).
func (r *RequestFormRepo) ListByProject(ctx context.Context, projectID uuid.UUID, includeInactive bool) ([]models.RequestForm, error) {
	query := "SELECT " + formColumns + " FROM request_forms WHERE project_id = $1"
	if !includeInactive {
		query += " AND is_active"
	}
	query += " ORDER BY sort_order, created_at"

	rows, err := r.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	forms := []models.RequestForm{}
	for rows.Next() {
		f, err := scanForm(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		forms = append(forms, f)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(forms) == 0 {
		return forms, nil
	}

	ids := make([]uuid.UUID, len(forms))
	index := map[uuid.UUID]int{}
	for i, f := range forms {
		ids[i] = f.ID
		index[f.ID] = i
	}
	questions, err := r.questionsFor(ctx, r.pool, ids)
	if err != nil {
		return nil, err
	}
	for _, q := range questions {
		i := index[q.FormID]
		forms[i].Questions = append(forms[i].Questions, q)
	}
	return forms, nil
}

func (r *RequestFormRepo) GetByID(ctx context.Context, id uuid.UUID) (models.RequestForm, error) {
	f, err := scanForm(r.pool.QueryRow(ctx, "SELECT "+formColumns+" FROM request_forms WHERE id = $1", id))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.RequestForm{}, ErrNotFound
	}
	if err != nil {
		return models.RequestForm{}, err
	}
	qs, err := r.questionsFor(ctx, r.pool, []uuid.UUID{id})
	if err != nil {
		return models.RequestForm{}, err
	}
	f.Questions = qs
	return f, nil
}

type querier interface {
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}

func (r *RequestFormRepo) questionsFor(ctx context.Context, db querier, formIDs []uuid.UUID) ([]models.RequestQuestion, error) {
	rows, err := db.Query(ctx,
		`SELECT id, form_id, label, help_text, placeholder, type, options, required, sort_order, show_if, width, settings
		 FROM request_questions WHERE form_id = ANY($1) ORDER BY sort_order, created_at`, formIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.RequestQuestion{}
	for rows.Next() {
		var q models.RequestQuestion
		if err := rows.Scan(&q.ID, &q.FormID, &q.Label, &q.HelpText, &q.Placeholder, &q.Type,
			&q.Options, &q.Required, &q.SortOrder, &q.ShowIf, &q.Width, &q.Settings); err != nil {
			return nil, err
		}
		if q.Options == nil {
			q.Options = []string{}
		}
		out = append(out, q)
	}
	return out, rows.Err()
}

// Create appends a new, empty form at the end of the project's list.
func (r *RequestFormRepo) Create(ctx context.Context, projectID uuid.UUID, name, description string) (models.RequestForm, error) {
	var id uuid.UUID
	if err := r.pool.QueryRow(ctx,
		`INSERT INTO request_forms (project_id, name, description, sort_order)
		 VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM request_forms WHERE project_id = $1))
		 RETURNING id`,
		projectID, name, description,
	).Scan(&id); err != nil {
		return models.RequestForm{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *RequestFormRepo) Update(ctx context.Context, id uuid.UUID, name, description string, isActive bool) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE request_forms SET name = $2, description = $3, is_active = $4 WHERE id = $1`,
		id, name, description, isActive)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *RequestFormRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM request_forms WHERE id = $1`, id)
	return err
}

// ReplaceQuestions saves a form's whole question list in one transaction:
// listed questions are inserted or updated (ids are generated client-side so
// showIf can reference a question that is new in the same save), every other
// question of the form is deleted, and sort order follows list position.
func (r *RequestFormRepo) ReplaceQuestions(ctx context.Context, formID uuid.UUID, questions []models.RequestQuestion) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := replaceQuestionsTx(ctx, tx, formID, questions); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func replaceQuestionsTx(ctx context.Context, tx pgx.Tx, formID uuid.UUID, questions []models.RequestQuestion) error {
	keep := make([]uuid.UUID, 0, len(questions))
	for i, q := range questions {
		tag, err := tx.Exec(ctx,
			`INSERT INTO request_questions (id, form_id, label, help_text, placeholder, type, options, required, sort_order, show_if, width, settings)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
			 ON CONFLICT (id) DO UPDATE SET
			   label = EXCLUDED.label, help_text = EXCLUDED.help_text, placeholder = EXCLUDED.placeholder,
			   type = EXCLUDED.type, options = EXCLUDED.options, required = EXCLUDED.required,
			   sort_order = EXCLUDED.sort_order, show_if = EXCLUDED.show_if, width = EXCLUDED.width,
			   settings = EXCLUDED.settings
			 WHERE request_questions.form_id = EXCLUDED.form_id`,
			q.ID, formID, q.Label, q.HelpText, q.Placeholder, q.Type, q.Options, q.Required, i, q.ShowIf, q.Width, q.Settings)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrQuestionFormMismatch
		}
		keep = append(keep, q.ID)
	}
	_, err := tx.Exec(ctx, `DELETE FROM request_questions WHERE form_id = $1 AND NOT (id = ANY($2))`, formID, keep)
	return err
}

// Duplicate copies a form and its questions under a new name. Question ids
// are regenerated and conditions are re-pointed at the copies.
func (r *RequestFormRepo) Duplicate(ctx context.Context, sourceID uuid.UUID, name string) (models.RequestForm, error) {
	src, err := r.GetByID(ctx, sourceID)
	if err != nil {
		return models.RequestForm{}, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.RequestForm{}, err
	}
	defer tx.Rollback(ctx)

	var newID uuid.UUID
	if err := tx.QueryRow(ctx,
		`INSERT INTO request_forms (project_id, name, description, is_active, sort_order)
		 VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM request_forms WHERE project_id = $1))
		 RETURNING id`,
		src.ProjectID, name, src.Description, src.IsActive,
	).Scan(&newID); err != nil {
		return models.RequestForm{}, err
	}

	remap := map[uuid.UUID]uuid.UUID{}
	copies := make([]models.RequestQuestion, len(src.Questions))
	for i, q := range src.Questions {
		remap[q.ID] = uuid.New()
		q.ID = remap[q.ID]
		if q.ShowIf != nil {
			cond := *q.ShowIf
			cond.QuestionID = remap[cond.QuestionID] // parent is always earlier, so already mapped
			q.ShowIf = &cond
		}
		copies[i] = q
	}
	if err := replaceQuestionsTx(ctx, tx, newID, copies); err != nil {
		return models.RequestForm{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.RequestForm{}, err
	}
	return r.GetByID(ctx, newID)
}
