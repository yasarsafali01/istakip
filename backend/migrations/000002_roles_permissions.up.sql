-- Configurable roles: a role is a named set of permissions plus a data-visibility
-- scope. The five original roles are seeded as system roles with the permissions
-- they previously had hardcoded, so behaviour is unchanged until an admin edits them.

CREATE TABLE roles (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- what data the role can see: all | unit | manager | project | own
  scope       TEXT NOT NULL CHECK (scope IN ('all','unit','manager','project','own')),
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_key   TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE ON UPDATE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (role_key, permission)
);

INSERT INTO roles (key, name, description, scope, is_system) VALUES
  ('System_Admin',    'Sistem Yöneticisi', 'Tüm birim, proje ve talepleri yönetir', 'all',     TRUE),
  ('Department_Head', 'Daire Başkanı',     'Kendi biriminin tüm iş ve taleplerini yönetir', 'unit', TRUE),
  ('Project_Manager', 'Proje Yöneticisi',  'Yönettiği projenin iş ve taleplerini yönetir', 'manager', TRUE),
  ('Worker',          'Çalışan',           'Kendi projesindeki işlerin durumunu günceller', 'project', TRUE),
  ('External_User',   'Dış Kullanıcı',     'Talep açar ve kendi taleplerini takip eder', 'own', TRUE);

INSERT INTO role_permissions (role_key, permission)
SELECT r.key, p.permission FROM roles r
JOIN (VALUES
  ('System_Admin','issue.create'),('System_Admin','request.create'),('System_Admin','issue.edit'),('System_Admin','issue.delete'),
  ('System_Admin','issue.status'),('System_Admin','issue.assign'),('System_Admin','issue.clone'),('System_Admin','issue.sprint'),
  ('System_Admin','issue.dates'),('System_Admin','issue.share'),('System_Admin','sprint.manage'),('System_Admin','inventory.manage'),
  ('System_Admin','inventory.use'),('System_Admin','project.create'),('System_Admin','project.edit'),('System_Admin','unit.manage'),
  ('System_Admin','role.manage'),
  ('Department_Head','issue.create'),('Department_Head','request.create'),('Department_Head','issue.edit'),('Department_Head','issue.delete'),
  ('Department_Head','issue.status'),('Department_Head','issue.assign'),('Department_Head','issue.clone'),('Department_Head','issue.sprint'),
  ('Department_Head','issue.dates'),('Department_Head','issue.share'),('Department_Head','sprint.manage'),('Department_Head','inventory.manage'),
  ('Department_Head','inventory.use'),('Department_Head','project.create'),('Department_Head','project.edit'),
  ('Project_Manager','issue.create'),('Project_Manager','request.create'),('Project_Manager','issue.edit'),('Project_Manager','issue.delete'),
  ('Project_Manager','issue.status'),('Project_Manager','issue.assign'),('Project_Manager','issue.clone'),('Project_Manager','issue.sprint'),
  ('Project_Manager','issue.dates'),('Project_Manager','issue.share'),('Project_Manager','sprint.manage'),('Project_Manager','inventory.manage'),
  ('Project_Manager','inventory.use'),
  ('Worker','issue.status'),('Worker','issue.share'),('Worker','inventory.use'),
  ('External_User','request.create'),('External_User','issue.edit'),('External_User','issue.delete'),('External_User','issue.clone')
) AS p(role_key, permission) ON p.role_key = r.key;

-- users.role becomes a foreign key to roles so custom roles can be assigned
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES roles(key) ON UPDATE CASCADE;
