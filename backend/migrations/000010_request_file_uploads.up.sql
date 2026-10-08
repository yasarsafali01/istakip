-- File-upload questions on request forms. A requester uploads files while
-- filling the form (they exist before the request does), and creating the
-- request attaches them. Files never attached stay with issue_id NULL.

ALTER TABLE request_questions DROP CONSTRAINT IF EXISTS request_questions_type_check;
ALTER TABLE request_questions ADD CONSTRAINT request_questions_type_check
  CHECK (type IN ('text','textarea','number','date','select','radio','checkbox','boolean','file'));

-- Type-specific settings; for 'file': {"maxFiles": 3, "accept": ["image","pdf"]}.
ALTER TABLE request_questions ADD COLUMN settings JSONB NOT NULL DEFAULT '{}';

CREATE TABLE request_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  -- file name inside UPLOAD_DIR (a random id — never the user-supplied name)
  storage_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_request_files_issue ON request_files(issue_id);
CREATE INDEX idx_request_files_unattached ON request_files(uploader_id) WHERE issue_id IS NULL;
