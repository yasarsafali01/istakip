-- "In Review" (İncelemede) is removed from the workflow and priorities are
-- reduced to three levels (Düşük / Orta / Yüksek). Existing rows are mapped
-- to the nearest remaining value before the constraints are tightened.

UPDATE issues SET status = 'In Progress' WHERE status = 'In Review';
UPDATE issues SET priority = 'High' WHERE priority = 'Highest';
UPDATE issues SET priority = 'Low' WHERE priority = 'Lowest';

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('To Do','In Progress','Done','Geri Çevrildi','Yönlendirildi','İptal Edildi'));

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_priority_check;
ALTER TABLE issues ADD CONSTRAINT issues_priority_check
  CHECK (priority IN ('High','Medium','Low'));
