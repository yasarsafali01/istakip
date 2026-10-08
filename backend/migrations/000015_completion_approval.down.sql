DELETE FROM role_permissions WHERE permission = 'issue.approve';
-- Anything still awaiting approval goes back to In Progress.
UPDATE issues SET status = 'In Progress' WHERE status = 'Onay Bekliyor';
ALTER TABLE issues DROP COLUMN IF EXISTS pending_completion;
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('To Do','In Progress','Done','Geri Çevrildi','Yönlendirildi','İptal Edildi'));
