package services

import (
	"path/filepath"
	"strings"
)

// MaxUploadBytes caps a single uploaded file.
const MaxUploadBytes = 10 << 20 // 10 MB

// FileCategories groups the allowed upload extensions; a file question's
// Accept list names categories from here. Anything not listed is rejected
// at upload time, whatever the question allows.
var FileCategories = map[string][]string{
	"image":   {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"},
	"pdf":     {".pdf"},
	"office":  {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp"},
	"text":    {".txt", ".csv"},
	"archive": {".zip", ".rar", ".7z"},
}

// FileCategory returns the category of a file name by extension, or "" when
// the extension isn't allowed at all.
func FileCategory(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	for cat, exts := range FileCategories {
		for _, e := range exts {
			if e == ext {
				return cat
			}
		}
	}
	return ""
}

func validFileCategory(c string) bool {
	_, ok := FileCategories[c]
	return ok
}
