-- When work on a request first started (first move to "In Progress"). With
-- created_at and resolved_at it gives:
--   bekleme süresi = started_at - created_at
--   çözüm süresi   = resolved_at - started_at
--   toplam süre    = resolved_at - created_at
ALTER TABLE issues ADD COLUMN started_at TIMESTAMPTZ;

-- Backfill from the activity log: the earliest status change that moved the
-- issue into progress (or straight to done). Issues with no such record stay
-- NULL and show "—" for the waiting/resolution split.
UPDATE issues i SET started_at = s.first_start
FROM (
  SELECT issue_id, min(created_at) AS first_start
  FROM activities
  WHERE type = 'status_change'
    AND (description LIKE '%→ "In Progress"%'
      OR description LIKE '%→ "In Review"%'
      OR description LIKE '%→ "Done"%'
      OR description LIKE 'Durum "Done" olarak%')
  GROUP BY issue_id
) s
WHERE s.issue_id = i.id AND i.status <> 'To Do';

-- A started time can't be after the resolution time (edited dates, old data).
UPDATE issues SET started_at = resolved_at
WHERE resolved_at IS NOT NULL AND started_at IS NOT NULL AND started_at > resolved_at;
