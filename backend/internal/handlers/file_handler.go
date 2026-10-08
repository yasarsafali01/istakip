package handlers

import (
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type FileHandler struct {
	files     *repository.FileRepo
	issues    *repository.IssueRepo
	projects  *repository.ProjectRepo
	uploadDir string
}

func NewFileHandler(files *repository.FileRepo, issues *repository.IssueRepo, projects *repository.ProjectRepo, uploadDir string) *FileHandler {
	return &FileHandler{files: files, issues: issues, projects: projects, uploadDir: uploadDir}
}

// Upload stores one file (multipart field "file") for a request-form file
// question. It is unattached until a request referencing it is created.
func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	if !claims.Can(services.PermRequestCreate) {
		response.Error(w, http.StatusForbidden, "Bu sayfaya erişim yetkiniz bulunmamaktadır")
		return
	}

	// A little headroom over the file limit for the multipart envelope.
	r.Body = http.MaxBytesReader(w, r.Body, services.MaxUploadBytes+1<<20)
	file, header, err := r.FormFile("file")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			response.Error(w, http.StatusRequestEntityTooLarge, "Dosya en fazla 10 MB olabilir")
			return
		}
		response.Error(w, http.StatusBadRequest, "Dosya alınamadı")
		return
	}
	defer file.Close()

	name := filepath.Base(header.Filename)
	if services.FileCategory(name) == "" {
		response.Error(w, http.StatusBadRequest, "Bu dosya türü yüklenemez")
		return
	}
	if header.Size > services.MaxUploadBytes {
		response.Error(w, http.StatusRequestEntityTooLarge, "Dosya en fazla 10 MB olabilir")
		return
	}

	if err := os.MkdirAll(h.uploadDir, 0o750); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to prepare upload dir")
		return
	}
	storageName := uuid.NewString()
	dst, err := os.OpenFile(filepath.Join(h.uploadDir, storageName), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o640)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to store file")
		return
	}
	size, copyErr := io.Copy(dst, io.LimitReader(file, services.MaxUploadBytes+1))
	closeErr := dst.Close()
	if copyErr != nil || closeErr != nil || size > services.MaxUploadBytes {
		os.Remove(filepath.Join(h.uploadDir, storageName))
		if size > services.MaxUploadBytes {
			response.Error(w, http.StatusRequestEntityTooLarge, "Dosya en fazla 10 MB olabilir")
			return
		}
		response.Error(w, http.StatusInternalServerError, "failed to store file")
		return
	}

	contentType := mime.TypeByExtension(filepath.Ext(name))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	saved, err := h.files.Create(r.Context(), models.RequestFile{
		UploaderID: claims.UserID, OriginalName: name, ContentType: contentType,
		SizeBytes: size, StorageName: storageName,
	})
	if err != nil {
		os.Remove(filepath.Join(h.uploadDir, storageName))
		response.Error(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	response.JSON(w, http.StatusCreated, saved)
}

// Download streams a file. Before it is attached only its uploader may read
// it; afterwards anyone who can see the request.
func (h *FileHandler) Download(w http.ResponseWriter, r *http.Request) {
	claims, _ := authmw.CurrentClaims(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid file id")
		return
	}
	f, err := h.files.GetByID(r.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		response.Error(w, http.StatusNotFound, "Dosya bulunamadı")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to load file")
		return
	}

	allowed := f.UploaderID == claims.UserID
	if !allowed && f.IssueID != nil {
		issue, err := h.issues.GetByID(r.Context(), *f.IssueID)
		if err == nil {
			if project, err := h.projects.GetByID(r.Context(), issue.ProjectID); err == nil {
				allowed = services.CanAccessIssue(claims, issue, project)
			}
		}
	}
	if !allowed {
		response.Error(w, http.StatusForbidden, "Bu dosyaya erişim yetkiniz yok")
		return
	}

	src, err := os.Open(filepath.Join(h.uploadDir, f.StorageName))
	if err != nil {
		response.Error(w, http.StatusNotFound, "Dosya bulunamadı")
		return
	}
	defer src.Close()

	w.Header().Set("Content-Type", f.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(f.SizeBytes, 10))
	// RFC 5987 form keeps Turkish characters in the file name intact.
	w.Header().Set("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(f.OriginalName))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	io.Copy(w, src)
}
