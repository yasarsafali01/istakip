UPDATE roles SET name = 'Proje Yöneticisi' WHERE key = 'Project_Manager' AND name = 'Müdür';
UPDATE roles SET name = 'Birim Müdürü' WHERE key = 'role_unit_director' AND name = 'Daire Başkan Yardımcısı';

UPDATE roles SET description = 'Tüm birim, proje ve talepleri yönetir'
  WHERE key = 'System_Admin' AND description = 'Tüm daire başkanlığı, müdürlük ve talepleri yönetir';
UPDATE roles SET description = 'Kendi biriminin tüm iş ve taleplerini yönetir'
  WHERE key = 'Department_Head' AND description = 'Kendi daire başkanlığının tüm iş ve taleplerini yönetir';
UPDATE roles SET description = 'Biriminin taleplerini çalışanlara atar, düzenler ve takip eder'
  WHERE key = 'role_unit_director' AND description = 'Daire başkanlığının taleplerini çalışanlara atar, düzenler ve takip eder';
UPDATE roles SET description = 'Yönettiği projenin iş ve taleplerini yönetir'
  WHERE key = 'Project_Manager' AND description = 'Yönettiği müdürlüğün iş ve taleplerini yönetir';
UPDATE roles SET description = 'Kendi projesindeki işlerin durumunu günceller'
  WHERE key = 'Worker' AND description = 'Kendi müdürlüğündeki işlerin durumunu günceller';
UPDATE roles SET description = 'Projesinin envanterini yönetir'
  WHERE key = 'role_stock_keeper' AND description = 'Müdürlüğünün envanterini yönetir';
UPDATE roles SET description = 'Kendi projesindeki talepleri karşılar ve durumunu günceller'
  WHERE key = 'role_request_staff' AND description = 'Kendi müdürlüğündeki talepleri karşılar ve durumunu günceller';
