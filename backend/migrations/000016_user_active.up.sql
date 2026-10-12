-- Users are deactivated instead of deleted: issues, comments and activities
-- reference them (ON DELETE RESTRICT) and must keep showing who did what.
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
