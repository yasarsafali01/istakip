package services

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/yasarsafali01/istakip/backend/internal/models"
)

const (
	maxQuestionsPerForm = 50
	maxOptionsPerChoice = 50
	maxAnswerLength     = 4000
	maxFilesPerQuestion = 10
)

// FormError is a user-facing (Turkish) validation message.
type FormError struct{ Msg string }

func (e FormError) Error() string { return e.Msg }

func formErr(format string, args ...interface{}) error {
	return FormError{Msg: fmt.Sprintf(format, args...)}
}

func isChoiceType(t string) bool {
	return t == models.QuestionSelect || t == models.QuestionRadio || t == models.QuestionCheckbox
}

func validQuestionType(t string) bool {
	switch t {
	case models.QuestionText, models.QuestionTextarea, models.QuestionNumber, models.QuestionDate,
		models.QuestionSelect, models.QuestionRadio, models.QuestionCheckbox, models.QuestionBoolean,
		models.QuestionFile:
		return true
	}
	return false
}

// NormalizeQuestions validates a form designed by a manager and cleans it in
// place (trimmed text, de-duplicated options, options dropped for non-choice
// types). A condition may only point at an EARLIER single-answer question so
// the form can be evaluated top-down without cycles.
func NormalizeQuestions(questions []models.RequestQuestion) ([]models.RequestQuestion, error) {
	if len(questions) > maxQuestionsPerForm {
		return nil, formErr("Bir formda en fazla %d soru olabilir", maxQuestionsPerForm)
	}
	byID := map[uuid.UUID]models.RequestQuestion{}
	out := make([]models.RequestQuestion, 0, len(questions))

	for i, q := range questions {
		n := i + 1
		if q.ID == uuid.Nil {
			q.ID = uuid.New()
		}
		if _, dup := byID[q.ID]; dup {
			return nil, formErr("%d. soru: aynı soru kimliği iki kez kullanılmış", n)
		}
		q.Label = strings.TrimSpace(q.Label)
		q.HelpText = strings.TrimSpace(q.HelpText)
		q.Placeholder = strings.TrimSpace(q.Placeholder)
		if q.Label == "" {
			return nil, formErr("%d. soru: soru metni zorunludur", n)
		}
		if !validQuestionType(q.Type) {
			return nil, formErr("%d. soru: geçersiz soru tipi", n)
		}
		switch q.Width {
		case 0:
			q.Width = 12
		case 3, 4, 6, 12:
		default:
			return nil, formErr("\"%s\": geçersiz genişlik", q.Label)
		}

		if isChoiceType(q.Type) {
			seen := map[string]bool{}
			opts := []string{}
			for _, o := range q.Options {
				o = strings.TrimSpace(o)
				if o == "" || seen[o] {
					continue
				}
				seen[o] = true
				opts = append(opts, o)
			}
			if len(opts) == 0 {
				return nil, formErr("\"%s\": en az bir seçenek eklenmelidir", q.Label)
			}
			if len(opts) > maxOptionsPerChoice {
				return nil, formErr("\"%s\": en fazla %d seçenek olabilir", q.Label, maxOptionsPerChoice)
			}
			q.Options = opts
		} else {
			q.Options = []string{}
		}

		if q.Type == models.QuestionFile {
			if q.Settings.MaxFiles < 1 {
				q.Settings.MaxFiles = 1
			}
			if q.Settings.MaxFiles > maxFilesPerQuestion {
				q.Settings.MaxFiles = maxFilesPerQuestion
			}
			accept := []string{}
			for _, c := range q.Settings.Accept {
				if validFileCategory(c) && !contains(accept, c) {
					accept = append(accept, c)
				}
			}
			q.Settings.Accept = accept
		} else {
			q.Settings = models.QuestionSettings{}
		}

		if q.ShowIf != nil {
			parent, ok := byID[q.ShowIf.QuestionID]
			if !ok {
				return nil, formErr("\"%s\": koşul yalnızca kendinden önceki bir soruya bağlanabilir", q.Label)
			}
			switch parent.Type {
			case models.QuestionSelect, models.QuestionRadio:
				if !contains(parent.Options, q.ShowIf.Value) {
					return nil, formErr("\"%s\": koşul değeri \"%s\" sorusunun seçenekleri arasında yok", q.Label, parent.Label)
				}
			case models.QuestionBoolean:
				if q.ShowIf.Value != "true" && q.ShowIf.Value != "false" {
					return nil, formErr("\"%s\": koşul değeri Evet ya da Hayır olmalıdır", q.Label)
				}
			default:
				return nil, formErr("\"%s\": koşul yalnızca açılır liste, tek seçim veya onay kutusu sorularına bağlanabilir", q.Label)
			}
		}

		byID[q.ID] = q
		out = append(out, q)
	}
	return out, nil
}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}

// conditionValue renders a stored answer the way showIf.Value is written.
func conditionValue(a interface{}) (string, bool) {
	switch v := a.(type) {
	case string:
		return v, true
	case bool:
		return strconv.FormatBool(v), true
	}
	return "", false
}

// BuildAnswers validates raw answers (questionId → JSON value) against the
// project's current form and returns the snapshot to store. Questions hidden
// by an unmet condition are skipped entirely — their required flag doesn't
// apply and any value sent for them is dropped. Unknown ids are ignored.
func BuildAnswers(questions []models.RequestQuestion, raw map[string]json.RawMessage) ([]models.RequestAnswer, error) {
	values := map[uuid.UUID]interface{}{} // accepted answers, for condition checks
	visible := map[uuid.UUID]models.RequestQuestion{}
	out := []models.RequestAnswer{}

	for _, q := range questions {
		if q.ShowIf != nil {
			parent, shown := visible[q.ShowIf.QuestionID]
			if !shown {
				continue
			}
			parentVal, answered := values[parent.ID]
			// An unticked boolean is stored as "no answer" but still means false.
			if !answered && parent.Type == models.QuestionBoolean {
				parentVal, answered = false, true
			}
			if !answered {
				continue
			}
			if s, ok := conditionValue(parentVal); !ok || s != q.ShowIf.Value {
				continue
			}
		}
		visible[q.ID] = q

		value, err := parseAnswer(q, raw[q.ID.String()])
		if err != nil {
			return nil, err
		}
		if value == nil {
			if q.Required {
				return nil, formErr("\"%s\" sorusu zorunludur", q.Label)
			}
			continue
		}
		values[q.ID] = value
		out = append(out, models.RequestAnswer{QuestionID: q.ID, Label: q.Label, Type: q.Type, Value: value})
	}
	return out, nil
}

// parseAnswer returns nil for "not answered" (missing, empty string, empty
// list, or an unchecked boolean — so a required boolean means "must tick").
func parseAnswer(q models.RequestQuestion, raw json.RawMessage) (interface{}, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	invalid := formErr("\"%s\" sorusunun cevabı geçersiz", q.Label)

	switch q.Type {
	case models.QuestionCheckbox:
		var list []string
		if err := json.Unmarshal(raw, &list); err != nil {
			return nil, invalid
		}
		picked := []string{}
		for _, v := range list {
			if !contains(q.Options, v) {
				return nil, invalid
			}
			if !contains(picked, v) {
				picked = append(picked, v)
			}
		}
		if len(picked) == 0 {
			return nil, nil
		}
		return picked, nil

	case models.QuestionBoolean:
		var b bool
		if err := json.Unmarshal(raw, &b); err != nil {
			return nil, invalid
		}
		if !b {
			return nil, nil
		}
		return true, nil

	case models.QuestionFile:
		// Uploaded file ids; the handler resolves them to FileRefs and checks
		// ownership/type, since that needs the database.
		var ids []string
		if err := json.Unmarshal(raw, &ids); err != nil {
			return nil, invalid
		}
		unique := []string{}
		for _, id := range ids {
			if _, err := uuid.Parse(id); err != nil {
				return nil, invalid
			}
			if !contains(unique, id) {
				unique = append(unique, id)
			}
		}
		if len(unique) == 0 {
			return nil, nil
		}
		max := q.Settings.MaxFiles
		if max < 1 {
			max = 1
		}
		if len(unique) > max {
			return nil, formErr("\"%s\" sorusuna en fazla %d dosya yüklenebilir", q.Label, max)
		}
		return unique, nil
	}

	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, invalid
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	if len([]rune(s)) > maxAnswerLength {
		return nil, formErr("\"%s\" cevabı en fazla %d karakter olabilir", q.Label, maxAnswerLength)
	}

	switch q.Type {
	case models.QuestionNumber:
		if _, err := strconv.ParseFloat(strings.Replace(s, ",", ".", 1), 64); err != nil {
			return nil, formErr("\"%s\" sorusuna sayı girilmelidir", q.Label)
		}
	case models.QuestionDate:
		if _, err := time.Parse("2006-01-02", s); err != nil {
			return nil, formErr("\"%s\" sorusuna geçerli bir tarih girilmelidir", q.Label)
		}
	case models.QuestionSelect, models.QuestionRadio:
		if !contains(q.Options, s) {
			return nil, invalid
		}
	}
	return s, nil
}
