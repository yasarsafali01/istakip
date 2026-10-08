// @ts-nocheck — verbatim port of frontend/src/utils/slaUtils.js; keep the two in sync.
// Client-computed SLA (service level agreement) tracking for requests —
// mirrors the reference system's "kalan süre / risk" indicator. Nothing is
// stored on the backend: the deadline is derived from priority + createdAt,
// and frozen at resolvedAt once a request reaches a terminal status.

// Default response-time budget per priority, in hours.
const SLA_HOURS_BY_PRIORITY = {
  High: 8,
  Medium: 24,
  Low: 72,
};

const TERMINAL_STATUSES = new Set(['Done', 'Geri Çevrildi', 'İptal Edildi']);

/**
 * @param {Object} request - an issue/request with priority, createdAt, status, resolvedAt
 * @returns {null|{dueAt: Date, remainingMs: number, risk: 'ok'|'warning'|'breached'|'done', label: string}}
 *   null when the request has no SLA (not a request, or no priority/createdAt).
 */
export function getSlaInfo(request) {
  if (!request?.isRequest || !request.createdAt) return null;
  const hours = SLA_HOURS_BY_PRIORITY[request.priority] ?? SLA_HOURS_BY_PRIORITY.Medium;
  const createdAt = new Date(request.createdAt);
  const dueAt = new Date(createdAt.getTime() + hours * 3600 * 1000);

  const isTerminal = TERMINAL_STATUSES.has(request.status);
  const referenceTime = isTerminal ? new Date(request.resolvedAt || request.updatedAt || Date.now()) : new Date();
  const remainingMs = dueAt.getTime() - referenceTime.getTime();

  if (isTerminal) {
    const onTime = remainingMs >= 0;
    return { dueAt, remainingMs, risk: 'done', label: onTime ? 'Süresinde çözüldü' : 'Süre aşımıyla çözüldü' };
  }

  const totalMs = hours * 3600 * 1000;
  let risk = 'ok';
  if (remainingMs < 0) risk = 'breached';
  else if (remainingMs < totalMs * 0.2) risk = 'warning';

  return { dueAt, remainingMs, risk, label: formatRemaining(remainingMs) };
}

function formatRemaining(ms) {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const text = hours > 0 ? `${hours} sa ${mins} dk` : `${mins} dk`;
  return ms < 0 ? `${text} gecikti` : `${text} kaldı`;
}

export const SLA_RISK_COLORS = {
  ok: { bg: '#E3FCEF', text: '#006644' },
  warning: { bg: '#FFF4E5', text: '#B45309' },
  breached: { bg: '#FFEBE6', text: '#DE350B' },
  done: { bg: '#DFE1E6', text: '#42526E' },
};
