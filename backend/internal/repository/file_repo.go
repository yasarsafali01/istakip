package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

type FileRepo struct {
	pool *pgxpool.Pool
}

func NewFileRepo(pool *pgxpool.Pool) *FileRepo {
	return &FileRepo{pool: pool}
}

const fileColumns = "id, uploader_id, issue_id, original_name, content_type, size_bytes, storage_name, created_at"

func scanFile(row pgx.Row) (models.RequestFile, error) {
	var f models.RequestFile
	err := row.Scan(&f.ID, &f.UploaderID, &f.IssueID, &f.OriginalName, &f.ContentType, &f.SizeBytes, &f.StorageName, &f.CreatedAt)
	return f, err
}

func (r *FileRepo) Create(ctx context.Context, f models.RequestFile) (models.RequestFile, error) {
	return scanFile(r.pool.QueryRow(ctx,
		`INSERT INTO request_files (uploader_id, original_name, content_type, size_bytes, storage_name)
		 VALUES ($1, $2, $3, $4, $5) RETURNING `+fileColumns,
		f.UploaderID, f.OriginalName, f.ContentType, f.SizeBytes, f.StorageName))
}

func (r *FileRepo) GetByID(ctx context.Context, id uuid.UUID) (models.RequestFile, error) {
	f, err := scanFile(r.pool.QueryRow(ctx, "SELECT "+fileColumns+" FROM request_files WHERE id = $1", id))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.RequestFile{}, ErrNotFound
	}
	return f, err
}

// GetMany returns the files that exist among ids, keyed by id.
func (r *FileRepo) GetMany(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]models.RequestFile, error) {
	rows, err := r.pool.Query(ctx, "SELECT "+fileColumns+" FROM request_files WHERE id = ANY($1)", ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[uuid.UUID]models.RequestFile{}
	for rows.Next() {
		f, err := scanFile(rows)
		if err != nil {
			return nil, err
		}
		out[f.ID] = f
	}
	return out, rows.Err()
}
