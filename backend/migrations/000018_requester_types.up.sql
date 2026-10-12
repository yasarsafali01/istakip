-- "Dış Kullanıcı" is split into two requester types. Both keep the old
-- role's scope, level and permissions for now; they can diverge later.
INSERT INTO roles (key, name, description, scope, is_system, level) VALUES
  ('University_Staff', 'Üniversite Personeli', 'Talep açar ve kendi taleplerini takip eder', 'own', TRUE, 20),
  ('Student',          'Öğrenci',              'Talep açar ve kendi taleplerini takip eder', 'own', TRUE, 20);

INSERT INTO role_permissions (role_key, permission)
SELECT t.key, rp.permission
FROM role_permissions rp CROSS JOIN (VALUES ('University_Staff'), ('Student')) AS t(key)
WHERE rp.role_key = 'External_User';

-- Existing external users become university staff.
UPDATE users SET role = 'University_Staff' WHERE role = 'External_User';
UPDATE user_extra_roles SET role_key = 'University_Staff' WHERE role_key = 'External_User';

DELETE FROM roles WHERE key = 'External_User';
