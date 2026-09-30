-- Adds a numeric authority level to roles so role ASSIGNMENT (not role
-- definition editing) can be delegated down the org chart: a manager may
-- only hand a role to someone in their own organizational scope, and only a
-- role whose level is strictly lower than the manager's own role's level.
-- Higher number = more authority.

ALTER TABLE roles ADD COLUMN level INT NOT NULL DEFAULT 0;

UPDATE roles SET level = CASE key
  WHEN 'System_Admin'    THEN 100
  WHEN 'Department_Head' THEN 80
  WHEN 'Project_Manager' THEN 60
  WHEN 'Worker'          THEN 40
  WHEN 'External_User'   THEN 20
  ELSE level
END;

-- Sensible starting placements for the example custom roles seeded earlier
-- (000004) — the "Roller ve İzinler" screen lets an admin move these later.
UPDATE roles SET level = 70 WHERE key = 'role_unit_director';   -- Birim Müdürü: below Daire Başkanı, above Proje Yöneticisi
UPDATE roles SET level = 30 WHERE key = 'role_request_staff';   -- Talep Karşılama Personeli: below Çalışan
UPDATE roles SET level = 30 WHERE key = 'role_stock_keeper';    -- Envanter Sorumlusu: below Çalışan
UPDATE roles SET level = 10 WHERE key = 'role_viewer';          -- İzleyici: lowest, view-only

-- Delegated role assignment: granted by default to the three roles that
-- manage people (System_Admin already has it implicitly via role.manage,
-- but user.assign_role is what actually gates the "Kullanıcılar" screen).
INSERT INTO role_permissions (role_key, permission) VALUES
  ('System_Admin', 'user.assign_role'),
  ('Department_Head', 'user.assign_role'),
  ('Project_Manager', 'user.assign_role')
ON CONFLICT DO NOTHING;
