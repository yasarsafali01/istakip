CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── units ──────────────────────────────────────────────────────────────────
-- department_head_id FK to users is added later (circular dependency).
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_code TEXT NOT NULL UNIQUE,
  department_head_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── users ──────────────────────────────────────────────────────────────────
-- project_id FK to projects is added later (projects doesn't exist yet).
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('System_Admin','Department_Head','Project_Manager','Worker','External_User')),
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  project_id UUID,
  avatar_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_unit ON users(unit_id);

ALTER TABLE units
  ADD CONSTRAINT fk_units_department_head
  FOREIGN KEY (department_head_id) REFERENCES users(id) ON DELETE SET NULL;

-- ─── projects ───────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  has_inventory BOOLEAN NOT NULL DEFAULT false,
  next_issue_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_unit ON projects(unit_id);
CREATE INDEX idx_projects_manager ON projects(manager_id);

ALTER TABLE users
  ADD CONSTRAINT fk_users_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX idx_users_project ON users(project_id);

-- ─── refresh_tokens ─────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ─── sprints ────────────────────────────────────────────────────────────────
CREATE TABLE sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Planned','Active','Completed')),
  UNIQUE (project_id, month, year)
);
-- At most one Active sprint per project.
CREATE UNIQUE INDEX uq_one_active_sprint_per_project
  ON sprints(project_id) WHERE status = 'Active';

-- ─── issues (normal issues and Requests share this table) ──────────────────
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('Task','Bug','Story','Epic','Request')),
  priority TEXT NOT NULL CHECK (priority IN ('Highest','High','Medium','Low','Lowest')),
  status TEXT NOT NULL CHECK (status IN ('To Do','In Progress','In Review','Done','Geri Çevrildi')),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_request BOOLEAN NOT NULL DEFAULT false,
  time_spent INT NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (project_id, number)
);
CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_sprint ON issues(sprint_id);
CREATE INDEX idx_issues_assignee ON issues(assignee_id);
CREATE INDEX idx_issues_reporter ON issues(reporter_id);
CREATE INDEX idx_issues_is_request ON issues(is_request) WHERE is_request = true;

-- ─── issue_visible_users (visibleTo[] for External_User visibility) ────────
CREATE TABLE issue_visible_users (
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, user_id)
);

-- ─── comments ───────────────────────────────────────────────────────────────
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_issue ON comments(issue_id);

-- ─── activities ─────────────────────────────────────────────────────────────
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('created','status_change','assignment','comment','field_update')),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_issue_created ON activities(issue_id, created_at DESC);

-- ─── inventory ──────────────────────────────────────────────────────────────
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit TEXT NOT NULL
);
CREATE INDEX idx_inventory_project ON inventory(project_id);
