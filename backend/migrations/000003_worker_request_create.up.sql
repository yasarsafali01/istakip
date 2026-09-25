-- Workers could already open requests from the web UI; make it an explicit permission.
INSERT INTO role_permissions (role_key, permission) VALUES ('Worker', 'request.create') ON CONFLICT DO NOTHING;
