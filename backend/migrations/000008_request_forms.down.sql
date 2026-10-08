DELETE FROM role_permissions WHERE permission = 'request_form.manage';
ALTER TABLE issues DROP COLUMN IF EXISTS request_answers;
DROP TABLE IF EXISTS request_questions;
