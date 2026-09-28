DELETE FROM role_permissions WHERE permission IN ('helpdesk.create','team.manage','template.manage','issue.forward');

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reply_templates;

ALTER TABLE issues DROP COLUMN IF EXISTS assignee_team_id;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;

ALTER TABLE users
  DROP COLUMN IF EXISTS building,
  DROP COLUMN IF EXISTS floor,
  DROP COLUMN IF EXISTS room,
  DROP COLUMN IF EXISTS notify_email,
  DROP COLUMN IF EXISTS notify_sms,
  DROP COLUMN IF EXISTS notify_push;

ALTER TABLE issues
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS rating_comment,
  DROP COLUMN IF EXISTS rated_at,
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS forwarded_from_project_id;

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('To Do','In Progress','In Review','Done','Geri Çevrildi'));
