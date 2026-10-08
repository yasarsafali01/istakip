-- Only the constraints are restored; rows mapped by the up migration
-- (In Review → In Progress, Highest → High, Lowest → Low) stay mapped.
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('To Do','In Progress','In Review','Done','Geri Çevrildi','Yönlendirildi','İptal Edildi'));

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_priority_check;
ALTER TABLE issues ADD CONSTRAINT issues_priority_check
  CHECK (priority IN ('Highest','High','Medium','Low','Lowest'));
