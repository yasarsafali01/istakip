-- A person can serve in several müdürlükler of their daire başkanlığı.
-- users.project_id stays as the primary müdürlük (always one of these rows).
CREATE TABLE user_projects (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id)
);
CREATE INDEX idx_user_projects_project ON user_projects(project_id);

INSERT INTO user_projects (user_id, project_id)
SELECT id, project_id FROM users WHERE project_id IS NOT NULL;
