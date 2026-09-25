ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_fkey;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('System_Admin','Department_Head','Project_Manager','Worker','External_User'));
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;
