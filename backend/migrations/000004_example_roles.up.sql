-- Example custom roles, editable or removable from the "Roller ve İzinler" screen.
INSERT INTO roles (key, name, description, scope, is_system) VALUES
  ('role_unit_director',  'Birim Müdürü',             'Biriminin taleplerini çalışanlara atar, düzenler ve takip eder', 'unit',    FALSE),
  ('role_request_staff',  'Talep Karşılama Personeli', 'Kendi projesindeki talepleri karşılar ve durumunu günceller',   'project', FALSE),
  ('role_stock_keeper',   'Envanter Sorumlusu',        'Projesinin envanterini yönetir',                                'project', FALSE),
  ('role_viewer',         'İzleyici',                  'Yalnızca görüntüleyebilir, hiçbir işlem yapamaz',               'project', FALSE);

INSERT INTO role_permissions (role_key, permission) VALUES
  ('role_unit_director','request.create'),('role_unit_director','issue.create'),('role_unit_director','issue.edit'),
  ('role_unit_director','issue.status'),('role_unit_director','issue.assign'),('role_unit_director','issue.clone'),
  ('role_unit_director','issue.dates'),('role_unit_director','issue.sprint'),('role_unit_director','issue.share'),
  ('role_unit_director','sprint.manage'),('role_unit_director','inventory.use'),
  ('role_request_staff','request.create'),('role_request_staff','issue.edit'),('role_request_staff','issue.status'),
  ('role_request_staff','issue.share'),('role_request_staff','inventory.use'),
  ('role_stock_keeper','request.create'),('role_stock_keeper','issue.status'),('role_stock_keeper','inventory.manage'),('role_stock_keeper','inventory.use');
