INSERT INTO roles (key, name, description, scope, is_system, level) VALUES
  ('External_User', 'Dış Kullanıcı', 'Talep açar ve kendi taleplerini takip eder', 'own', TRUE, 20);

INSERT INTO role_permissions (role_key, permission)
SELECT 'External_User', permission FROM role_permissions WHERE role_key = 'University_Staff';

UPDATE users SET role = 'External_User' WHERE role IN ('University_Staff', 'Student');
DELETE FROM user_extra_roles x WHERE x.role_key IN ('University_Staff', 'Student')
  AND EXISTS (SELECT 1 FROM user_extra_roles y WHERE y.user_id = x.user_id AND y.role_key = 'External_User');
UPDATE user_extra_roles SET role_key = 'External_User' WHERE role_key IN ('University_Staff', 'Student');

DELETE FROM roles WHERE key IN ('University_Staff', 'Student');
