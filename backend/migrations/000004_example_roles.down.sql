DELETE FROM roles WHERE key IN ('role_unit_director','role_request_staff','role_stock_keeper','role_viewer') AND NOT EXISTS (SELECT 1 FROM users WHERE users.role = roles.key);
