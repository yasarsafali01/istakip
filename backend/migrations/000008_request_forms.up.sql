-- Per-project (müdürlük) request forms: the manager designs a list of
-- questions; a requester answers them after picking the project. Answers are
-- stored on the issue as a JSON snapshot (label/type copied in), so editing
-- or deleting a question never changes what an existing request shows.

CREATE TABLE request_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  help_text TEXT NOT NULL DEFAULT '',
  placeholder TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('text','textarea','number','date','select','radio','checkbox','boolean')),
  options JSONB NOT NULL DEFAULT '[]',
  required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  -- {"questionId": "...", "value": "..."} or NULL (always shown)
  show_if JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_request_questions_project ON request_questions(project_id, sort_order);

ALTER TABLE issues ADD COLUMN request_answers JSONB NOT NULL DEFAULT '[]';

INSERT INTO role_permissions (role_key, permission)
SELECT r.key, 'request_form.manage' FROM roles r
WHERE r.key IN ('System_Admin', 'Department_Head', 'Project_Manager')
ON CONFLICT DO NOTHING;
