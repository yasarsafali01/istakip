-- A müdürlük can have several request forms ("talep türleri", e.g. Arıza
-- Bildirimi / Yazılım Talebi), each with its own questions. Questions move
-- from hanging off the project to hanging off a form; the requester picks
-- the form after the müdürlük. Also adds a per-question layout width.

CREATE TABLE request_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_request_forms_project ON request_forms(project_id, sort_order);

-- Existing questions (one form per project until now) become that project's
-- "Genel Talep" form.
INSERT INTO request_forms (project_id, name)
SELECT DISTINCT project_id, 'Genel Talep' FROM request_questions;

ALTER TABLE request_questions ADD COLUMN form_id UUID REFERENCES request_forms(id) ON DELETE CASCADE;
UPDATE request_questions q SET form_id = f.id FROM request_forms f WHERE f.project_id = q.project_id;
ALTER TABLE request_questions ALTER COLUMN form_id SET NOT NULL;

DROP INDEX IF EXISTS idx_request_questions_project;
ALTER TABLE request_questions DROP COLUMN project_id;
CREATE INDEX idx_request_questions_form ON request_questions(form_id, sort_order);

-- Share of a 12-column row: 12 full, 6 half, 4 third, 3 quarter (max 4 per row).
ALTER TABLE request_questions
  ADD COLUMN width INT NOT NULL DEFAULT 12 CHECK (width IN (3, 4, 6, 12));

-- Which form a request was opened with; the name is a snapshot so the
-- request still reads correctly after the form is renamed or deleted.
ALTER TABLE issues
  ADD COLUMN request_form_id UUID REFERENCES request_forms(id) ON DELETE SET NULL,
  ADD COLUMN request_form_name TEXT;
