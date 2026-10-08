-- Lossy: all forms of a project collapse back into its single question list.
ALTER TABLE issues DROP COLUMN IF EXISTS request_form_name;
ALTER TABLE issues DROP COLUMN IF EXISTS request_form_id;

ALTER TABLE request_questions DROP COLUMN IF EXISTS width;

ALTER TABLE request_questions ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
UPDATE request_questions q SET project_id = f.project_id FROM request_forms f WHERE f.id = q.form_id;
ALTER TABLE request_questions ALTER COLUMN project_id SET NOT NULL;
DROP INDEX IF EXISTS idx_request_questions_form;
ALTER TABLE request_questions DROP COLUMN form_id;
CREATE INDEX idx_request_questions_project ON request_questions(project_id, sort_order);

DROP TABLE IF EXISTS request_forms;
