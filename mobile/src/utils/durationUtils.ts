// @ts-nocheck — verbatim port of frontend/src/utils/durationUtils.js; keep the two in sync.
// Request timing, from three timestamps:
//   createdAt  — opened
//   startedAt  — first moved to "In Progress" (işleme alındı)
//   resolvedAt — completed
// bekleme = startedAt − createdAt, çözüm = resolvedAt − startedAt,
// toplam = resolvedAt − createdAt. Unfinished parts run until `now` and are
// flagged as ongoing; a part whose start point is unknown is null.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function diff(from, to) {
  if (!from || !to) return null;
  return Math.max(0, new Date(to) - new Date(from));
}

/**
 * @returns {{ total: {ms, ongoing}, waiting: {ms, ongoing}|null, resolution: {ms, ongoing}|null }}
 */
export function requestDurations(req, now = new Date()) {
  const resolved = req.status === 'Done' && req.resolvedAt ? req.resolvedAt : null;
  const started = req.startedAt || null;
  const end = resolved || now;

  return {
    total: { ms: diff(req.createdAt, end), ongoing: !resolved },
    // Not started yet → still waiting (until now); started → fixed.
    waiting: started
      ? { ms: diff(req.createdAt, started), ongoing: false }
      : resolved ? null : { ms: diff(req.createdAt, now), ongoing: true },
    resolution: started ? { ms: diff(started, end), ongoing: !resolved } : null,
  };
}

/** "2 gün 3 sa", "5 sa 20 dk", "12 dk", "1 dk'dan az". */
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < MIN) return "1 dk'dan az";
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  if (d > 0) return h > 0 ? `${d} gün ${h} sa` : `${d} gün`;
  if (h > 0) return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
  return `${m} dk`;
}

/** Average of the finished (non-ongoing) values; null when there are none. */
export function averageMs(parts) {
  const done = parts.filter((p) => p && !p.ongoing && p.ms !== null);
  if (done.length === 0) return null;
  return done.reduce((sum, p) => sum + p.ms, 0) / done.length;
}
