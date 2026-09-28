-- Adds: request forwarding/cancellation, SLA-relevant timestamps already exist
-- (created_at/priority are enough — SLA is computed, not stored), resolution
-- rating, helpdesk walk-in/phone contact info, teams, canned reply templates,
-- and in-app notifications. Mirrors the gaps found reviewing a reference
-- service-desk system; the stock/inventory module was intentionally skipped.

-- ─── issues: status widened, rating, helpdesk contact, team assignment ──────
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('To Do','In Progress','In Review','Done','Geri Çevrildi','Yönlendirildi','İptal Edildi'));

ALTER TABLE issues
  ADD COLUMN rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN rating_comment TEXT,
  ADD COLUMN rated_at TIMESTAMPTZ,
  ADD COLUMN contact_name TEXT,
  ADD COLUMN contact_phone TEXT,
  ADD COLUMN forwarded_from_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- ─── users: profile location + notification channel preferences ───────────
ALTER TABLE users
  ADD COLUMN building TEXT,
  ADD COLUMN floor TEXT,
  ADD COLUMN room TEXT,
  ADD COLUMN notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_sms BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN notify_push BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── teams (assign a group instead of one person) ──────────────────────────
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teams_project ON teams(project_id);

CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE issues
  ADD COLUMN assignee_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX idx_issues_assignee_team ON issues(assignee_team_id);

-- ─── reply_templates (canned responses with {Placeholder} substitution) ────
CREATE TABLE reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reply_templates_project ON reply_templates(project_id);

-- ─── notifications (in-app bell) ───────────────────────────────────────────
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ─── new permissions ────────────────────────────────────────────────────────
INSERT INTO role_permissions (role_key, permission)
SELECT r.key, p.permission FROM roles r
JOIN (VALUES
  ('System_Admin','helpdesk.create'),('System_Admin','team.manage'),('System_Admin','template.manage'),('System_Admin','issue.forward'),
  ('Department_Head','helpdesk.create'),('Department_Head','team.manage'),('Department_Head','template.manage'),('Department_Head','issue.forward'),
  ('Project_Manager','helpdesk.create'),('Project_Manager','team.manage'),('Project_Manager','template.manage'),('Project_Manager','issue.forward')
) AS p(role_key, permission) ON p.role_key = r.key
ON CONFLICT DO NOTHING;
