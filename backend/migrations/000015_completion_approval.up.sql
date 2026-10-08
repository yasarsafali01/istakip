-- Completion approval: a user without issue.approve (e.g. Çalışan) can no
-- longer close work directly — completing it moves it to "Onay Bekliyor"
-- with the resolution kept in pending_completion, and a manager approves
-- (→ Done) or rejects (→ In Progress).

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('To Do','In Progress','Onay Bekliyor','Done','Geri Çevrildi','Yönlendirildi','İptal Edildi'));

-- {"resolutionNote","equipmentId","quantity","submittedBy","submittedAt"} while
-- awaiting approval; NULL otherwise. Inventory is only deducted on approval.
ALTER TABLE issues ADD COLUMN pending_completion JSONB;

INSERT INTO role_permissions (role_key, permission)
SELECT r.key, 'issue.approve' FROM roles r
WHERE r.key IN ('System_Admin', 'Department_Head', 'Project_Manager')
ON CONFLICT DO NOTHING;
