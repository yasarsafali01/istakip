DELETE FROM role_permissions WHERE permission = 'user.assign_role';
ALTER TABLE roles DROP COLUMN IF EXISTS level;
