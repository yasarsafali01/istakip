-- Organizational terminology changed: "Birim" is now "Daire Başkanlığı" and
-- "Proje" is now "Müdürlük". Only display names/descriptions change; keys,
-- scopes and the units/projects schema stay as-is.
-- Each UPDATE is guarded by the old value so a role an admin already renamed
-- from the "Roller ve İzinler" screen is left untouched.

UPDATE roles SET name = 'Müdür' WHERE key = 'Project_Manager' AND name = 'Proje Yöneticisi';
UPDATE roles SET name = 'Daire Başkan Yardımcısı' WHERE key = 'role_unit_director' AND name = 'Birim Müdürü';

UPDATE roles SET description = 'Tüm daire başkanlığı, müdürlük ve talepleri yönetir'
  WHERE key = 'System_Admin' AND description = 'Tüm birim, proje ve talepleri yönetir';
UPDATE roles SET description = 'Kendi daire başkanlığının tüm iş ve taleplerini yönetir'
  WHERE key = 'Department_Head' AND description = 'Kendi biriminin tüm iş ve taleplerini yönetir';
UPDATE roles SET description = 'Daire başkanlığının taleplerini çalışanlara atar, düzenler ve takip eder'
  WHERE key = 'role_unit_director' AND description = 'Biriminin taleplerini çalışanlara atar, düzenler ve takip eder';
UPDATE roles SET description = 'Yönettiği müdürlüğün iş ve taleplerini yönetir'
  WHERE key = 'Project_Manager' AND description = 'Yönettiği projenin iş ve taleplerini yönetir';
UPDATE roles SET description = 'Kendi müdürlüğündeki işlerin durumunu günceller'
  WHERE key = 'Worker' AND description = 'Kendi projesindeki işlerin durumunu günceller';
UPDATE roles SET description = 'Müdürlüğünün envanterini yönetir'
  WHERE key = 'role_stock_keeper' AND description = 'Projesinin envanterini yönetir';
UPDATE roles SET description = 'Kendi müdürlüğündeki talepleri karşılar ve durumunu günceller'
  WHERE key = 'role_request_staff' AND description = 'Kendi projesindeki talepleri karşılar ve durumunu günceller';
