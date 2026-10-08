-- Stored files on disk (UPLOAD_DIR) are not removed by this migration.
DROP TABLE IF EXISTS request_files;
DELETE FROM request_questions WHERE type = 'file';
ALTER TABLE request_questions DROP COLUMN IF EXISTS settings;
ALTER TABLE request_questions DROP CONSTRAINT IF EXISTS request_questions_type_check;
ALTER TABLE request_questions ADD CONSTRAINT request_questions_type_check
  CHECK (type IN ('text','textarea','number','date','select','radio','checkbox','boolean'));
