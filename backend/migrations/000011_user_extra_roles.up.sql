-- A user keeps one primary role (users.role) and may hold any number of
-- additional roles (e.g. Çalışan + Envanter Sorumlusu). The effective access
-- is the union: all permissions, the widest data scope, the highest level.
CREATE TABLE user_extra_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES roles(key),
  PRIMARY KEY (user_id, role_key)
);
CREATE INDEX idx_user_extra_roles_role ON user_extra_roles(role_key);
