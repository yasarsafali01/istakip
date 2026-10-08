-- Templates come in two kinds: 'reply' (canned comment answers, as before)
-- and 'resolution' (prefills the resolution note when completing a request).
-- Existing templates stay replies.
ALTER TABLE reply_templates
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'reply' CHECK (kind IN ('reply', 'resolution'));
