// @ts-nocheck — verbatim port of frontend/src/utils/reportUtils.js; keep the two in sync.
// Aggregations for the Raporlar page. Everything is computed client-side from
// the issues the current user can already see (the backend scopes the list),
// so a Müdür's report covers their müdürlük and a Daire Başkanı's their unit.
import { requestDurations, averageMs } from './durationUtils';
import { getSlaInfo } from './slaUtils';

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const OPEN_STATUSES = ['To Do', 'In Progress', 'Onay Bekliyor'];
export const CLOSED_OTHER = ['Geri Çevrildi', 'İptal Edildi', 'Yönlendirildi'];

const isDone = (i) => i.status === 'Done';
const resolvedDate = (i) => (isDone(i) && i.resolvedAt ? new Date(i.resolvedAt) : null);

/** Issues matching the page filters. Period applies to the opening date. */
export function applyFilters(issues, f, projectsById) {
  return issues.filter((i) => {
    if (f.kind === 'request' && !i.isRequest) return false;
    if (f.kind === 'task' && i.isRequest) return false;
    if (f.projectId && i.projectId !== f.projectId) return false;
    if (f.unitId && projectsById[i.projectId]?.unitId !== f.unitId) return false;
    if (f.formName && (i.requestFormName || '') !== (f.formName === '__none__' ? '' : f.formName)) return false;
    if (f.assigneeId && i.assigneeId !== f.assigneeId) return false;
    if (f.year !== 'all' || f.month !== 'all') {
      if (!i.createdAt) return false;
      const d = new Date(i.createdAt);
      if (f.year !== 'all' && d.getFullYear() !== Number(f.year)) return false;
      if (f.month !== 'all' && d.getMonth() + 1 !== Number(f.month)) return false;
    }
    return true;
  });
}

/** Headline numbers for a set of issues. */
export function summarize(issues) {
  const durations = issues.filter(isDone).map((i) => requestDurations(i));
  const rated = issues.filter((i) => i.rating);
  const slaDone = issues.filter((i) => i.isRequest && isDone(i)).map(getSlaInfo).filter(Boolean);
  const onTime = slaDone.filter((s) => s.remainingMs >= 0).length;
  const done = issues.filter(isDone).length;
  const closedOther = issues.filter((i) => CLOSED_OTHER.includes(i.status)).length;
  return {
    total: issues.length,
    open: issues.filter((i) => OPEN_STATUSES.includes(i.status)).length,
    todo: issues.filter((i) => i.status === 'To Do').length,
    inProgress: issues.filter((i) => i.status === 'In Progress').length,
    pendingApproval: issues.filter((i) => i.status === 'Onay Bekliyor').length,
    done,
    rejected: issues.filter((i) => i.status === 'Geri Çevrildi').length,
    cancelled: issues.filter((i) => i.status === 'İptal Edildi').length,
    forwarded: issues.filter((i) => i.status === 'Yönlendirildi').length,
    // Done over everything that reached an end state (open work isn't counted against it)
    completionRate: done + closedOther > 0 ? done / (done + closedOther) : null,
    avgWaiting: averageMs(durations.map((d) => d.waiting)),
    avgResolution: averageMs(durations.map((d) => d.resolution)),
    avgTotal: averageMs(durations.map((d) => d.total)),
    avgRating: rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : null,
    ratingCount: rated.length,
    slaRate: slaDone.length ? onTime / slaDone.length : null,
    slaCount: slaDone.length,
  };
}

/**
 * Opened vs completed per period. year === 'all' → one point per month over
 * the data's span (capped to the last 24 months); otherwise the 12 months of
 * that year. Opened counts by createdAt, completed by resolvedAt.
 */
export function monthlyTrend(issues, year) {
  let keys;
  if (year === 'all') {
    const all = issues.flatMap((i) => [i.createdAt, resolvedDate(i)?.toISOString()].filter(Boolean))
      .map((s) => s.slice(0, 7));
    const uniq = [...new Set(all)].sort();
    if (uniq.length === 0) return [];
    // fill gaps between first and last month
    keys = [];
    let [y, m] = uniq[0].split('-').map(Number);
    const [ly, lm] = uniq[uniq.length - 1].split('-').map(Number);
    while (y < ly || (y === ly && m <= lm)) {
      keys.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    keys = keys.slice(-24);
  } else {
    keys = MONTHS.map((_, idx) => `${year}-${String(idx + 1).padStart(2, '0')}`);
  }
  const opened = Object.fromEntries(keys.map((k) => [k, 0]));
  const completed = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const i of issues) {
    const ck = i.createdAt?.slice(0, 7);
    if (ck in opened) opened[ck] += 1;
    const r = resolvedDate(i);
    const rk = r && r.toISOString().slice(0, 7);
    if (rk && rk in completed) completed[rk] += 1;
  }
  return keys.map((k) => {
    const [y, m] = k.split('-').map(Number);
    return {
      key: k,
      label: year === 'all' ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : MONTHS_SHORT[m - 1],
      fullLabel: `${MONTHS[m - 1]} ${y}`,
      opened: opened[k],
      completed: completed[k],
    };
  });
}

/** Month buckets for a year (12) or the data's span (last 24) — shared by the monthly charts. */
function monthBuckets(dates, year) {
  if (year !== 'all') {
    return MONTHS.map((_, idx) => {
      const key = `${year}-${String(idx + 1).padStart(2, '0')}`;
      return { key, label: MONTHS_SHORT[idx], fullLabel: `${MONTHS[idx]} ${year}` };
    });
  }
  const uniq = [...new Set(dates.map((d) => d.toISOString().slice(0, 7)))].sort();
  if (uniq.length === 0) return [];
  const out = [];
  let [y, m] = uniq[0].split('-').map(Number);
  const [ly, lm] = uniq[uniq.length - 1].split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`, fullLabel: `${MONTHS[m - 1]} ${y}` });
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out.slice(-24);
}

/** Average resolution time (hours) of issues completed in each month. */
export function monthlyResolution(issues, year) {
  const done = issues.filter((i) => resolvedDate(i));
  const buckets = monthBuckets(done.map(resolvedDate), year);
  const sums = Object.fromEntries(buckets.map((b) => [b.key, []]));
  for (const i of done) {
    const k = resolvedDate(i).toISOString().slice(0, 7);
    const d = requestDurations(i);
    if (k in sums && d.resolution && !d.resolution.ongoing) sums[k].push(d.resolution.ms);
  }
  return buckets.map((b) => {
    const list = sums[b.key];
    return { ...b, value: list.length ? list.reduce((s, v) => s + v, 0) / list.length / 3600000 : 0, count: list.length };
  });
}

/** Resolved requests per month split into on-time / late against their SLA. */
export function monthlySla(issues, year) {
  const done = issues.filter((i) => i.isRequest && resolvedDate(i));
  const buckets = monthBuckets(done.map(resolvedDate), year);
  const acc = Object.fromEntries(buckets.map((b) => [b.key, { onTime: 0, late: 0 }]));
  for (const i of done) {
    const k = resolvedDate(i).toISOString().slice(0, 7);
    const sla = getSlaInfo(i);
    if (!(k in acc) || !sla) continue;
    acc[k][sla.remainingMs >= 0 ? 'onTime' : 'late'] += 1;
  }
  return buckets.map((b) => ({ ...b, ...acc[b.key] }));
}

/** 1–5 star rating counts. */
export function ratingDistribution(issues) {
  return [5, 4, 3, 2, 1].map((r) => ({ key: String(r), label: `${r} yıldız`, value: issues.filter((i) => i.rating === r).length }));
}

/**
 * Per-group outcome split for stacked bars: tamamlanan / açık (incl. onay
 * bekleyen) / kapatılan (geri çevrilen, iptal, yönlendirilen).
 */
export function outcomeBy(issues, keyFn, labelFn) {
  const m = new Map();
  for (const i of issues) {
    const k = keyFn(i);
    if (k === undefined || k === null) continue;
    if (!m.has(k)) m.set(k, { key: k, label: labelFn(k), done: 0, open: 0, closed: 0, total: 0 });
    const g = m.get(k);
    g.total += 1;
    if (isDone(i)) g.done += 1;
    else if (OPEN_STATUSES.includes(i.status)) g.open += 1;
    else g.closed += 1;
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Average resolution time (ms) per group, groups without a measured value dropped. */
export function resolutionBy(issues, keyFn, labelFn) {
  return groupStats(issues, keyFn)
    .filter((r) => r.avgResolution !== null)
    .map((r) => ({ key: r.key, label: labelFn(r.key), value: r.avgResolution }))
    .sort((a, b) => b.value - a.value);
}

/* ── Personal performance (Performansım) ──────────────────────────────── */

/**
 * Per month of `year`: requests resolved, total working time (sum of
 * çözüm süreleri, hours), average çözüm süresi (hours) and manually logged
 * "Harcanan Zaman" (timeSpent minutes → hours).
 */
export function personalMonthly(issues, year) {
  const done = issues.filter((i) => resolvedDate(i));
  const buckets = monthBuckets(done.map(resolvedDate), year);
  const acc = Object.fromEntries(buckets.map((b) => [b.key, { resolved: 0, workMs: 0, measured: 0, loggedMin: 0 }]));
  for (const i of done) {
    const k = resolvedDate(i).toISOString().slice(0, 7);
    if (!(k in acc)) continue;
    const a = acc[k];
    a.resolved += 1;
    const d = requestDurations(i);
    if (d.resolution && !d.resolution.ongoing) { a.workMs += d.resolution.ms; a.measured += 1; }
    a.loggedMin += i.timeSpent || 0;
  }
  return buckets.map((b) => {
    const a = acc[b.key];
    return {
      ...b,
      resolved: a.resolved,
      workHours: a.workMs / 3600000,
      avgHours: a.measured ? a.workMs / a.measured / 3600000 : 0,
      loggedHours: a.loggedMin / 60,
      hint: a.measured < a.resolved ? `${a.resolved - a.measured} talebin işleme alınma zamanı kayıtlı değil` : undefined,
    };
  });
}

/** Requests resolved per calendar year (all years in the data). */
export function resolvedByYear(issues) {
  const m = new Map();
  for (const i of issues) {
    const r = resolvedDate(i);
    if (!r) continue;
    const y = r.getFullYear();
    m.set(y, (m.get(y) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0])
    .map(([y, value]) => ({ key: String(y), label: String(y), fullLabel: `${y} yılı`, value }));
}

const DURATION_BUCKETS = [
  { key: 'h1', label: '< 1 sa', max: 1 },
  { key: 'h4', label: '1–4 sa', max: 4 },
  { key: 'h8', label: '4–8 sa', max: 8 },
  { key: 'd1', label: '8–24 sa', max: 24 },
  { key: 'd3', label: '1–3 gün', max: 72 },
  { key: 'd7', label: '3–7 gün', max: 168 },
  { key: 'more', label: '7+ gün', max: Infinity },
];

/** How long resolutions took, bucketed (only measured çözüm süreleri). */
export function resolutionBuckets(issues) {
  const counts = Object.fromEntries(DURATION_BUCKETS.map((b) => [b.key, 0]));
  for (const i of issues.filter((x) => resolvedDate(x))) {
    const d = requestDurations(i).resolution;
    if (!d || d.ongoing) continue;
    const h = d.ms / 3600000;
    counts[DURATION_BUCKETS.find((b) => h < b.max).key] += 1;
  }
  return DURATION_BUCKETS.map((b) => ({ key: b.key, label: b.label, fullLabel: `Çözüm süresi ${b.label}`, value: counts[b.key] }));
}

/** Weekday × hour of a timestamp field (e.g. when work was picked up / finished). */
export function timeHeatmap(issues, field) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const i of issues) {
    const v = field === 'resolvedAt' ? resolvedDate(i) : (i[field] ? new Date(i[field]) : null);
    if (!v) continue;
    grid[(v.getDay() + 6) % 7][v.getHours()] += 1;
  }
  return { grid, max: Math.max(0, ...grid.flat()) };
}

/** Counts by a key, as [{ key, label, value }] sorted by value desc. */
export function countBy(issues, keyFn, labelFn = (k) => k) {
  const m = new Map();
  for (const i of issues) {
    const k = keyFn(i);
    if (k === undefined || k === null) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([key, value]) => ({ key, label: labelFn(key), value }))
    .sort((a, b) => b.value - a.value);
}

/** Per-group statistics row (used by the müdürlük / kişi / tür / ekip tables). */
export function groupStats(issues, keyFn) {
  const groups = new Map();
  for (const i of issues) {
    const k = keyFn(i);
    if (k === undefined || k === null) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  }
  return [...groups.entries()].map(([key, list]) => ({ key, ...summarize(list) }));
}

/**
 * Person × period matrix. metric 'completed' counts resolutions in the
 * period, 'assigned' counts issues opened in the period and assigned to them.
 * period 'month' → 12 columns of `year`; 'year' → one column per year in data.
 */
export function userPeriodMatrix(issues, { metric, period, year }) {
  const dateOf = (i) => (metric === 'completed' ? resolvedDate(i) : (i.createdAt ? new Date(i.createdAt) : null));
  const relevant = issues.filter((i) => i.assigneeId && dateOf(i));

  let columns;
  if (period === 'year') {
    const years = [...new Set(relevant.map((i) => dateOf(i).getFullYear()))].sort();
    columns = years.map((y) => ({ key: String(y), label: String(y) }));
  } else {
    const y = year === 'all' ? new Date().getFullYear() : Number(year);
    columns = MONTHS_SHORT.map((label, idx) => ({ key: `${y}-${idx + 1}`, label, full: `${MONTHS[idx]} ${y}` }));
  }
  const colKey = (d) => (period === 'year' ? String(d.getFullYear()) : `${d.getFullYear()}-${d.getMonth() + 1}`);

  const rows = new Map();
  for (const i of relevant) {
    const ck = colKey(dateOf(i));
    if (!columns.some((c) => c.key === ck)) continue;
    if (!rows.has(i.assigneeId)) rows.set(i.assigneeId, {});
    const r = rows.get(i.assigneeId);
    r[ck] = (r[ck] || 0) + 1;
  }
  const max = Math.max(0, ...[...rows.values()].flatMap((r) => Object.values(r)));
  return { columns, rows, max };
}

/** Weekday (Mon=0) × hour-of-day counts of when issues are opened. */
export function openingHeatmap(issues) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const i of issues) {
    if (!i.createdAt) continue;
    const d = new Date(i.createdAt);
    grid[(d.getDay() + 6) % 7][d.getHours()] += 1;
  }
  const max = Math.max(0, ...grid.flat());
  return { grid, max };
}

/** Answer distribution of one form question (select/radio/checkbox/boolean). */
export function answerDistribution(issues, questionLabel) {
  const counts = new Map();
  for (const i of issues) {
    for (const a of i.requestAnswers || []) {
      if (a.label !== questionLabel) continue;
      const values = Array.isArray(a.value) ? a.value : [a.type === 'boolean' ? (a.value ? 'Evet' : 'Hayır') : String(a.value)];
      for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  return [...counts.entries()].map(([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value);
}

/** Questions with a categorical answer, across the given issues' snapshots. */
export function categoricalQuestions(issues) {
  const set = new Set();
  for (const i of issues) {
    for (const a of i.requestAnswers || []) {
      if (['select', 'radio', 'checkbox', 'boolean'].includes(a.type)) set.add(a.label);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
}

export function percent(x) {
  return x === null || x === undefined ? '—' : `%${Math.round(x * 100)}`;
}

