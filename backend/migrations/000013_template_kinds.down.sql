-- Resolution templates are removed with the column (they'd otherwise turn into replies).
DELETE FROM reply_templates WHERE kind = 'resolution';
ALTER TABLE reply_templates DROP COLUMN IF EXISTS kind;
