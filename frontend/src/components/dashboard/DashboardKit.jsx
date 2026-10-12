import React from 'react';
import { Link } from 'react-router-dom';
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from '../../constants';
import { getSlaInfo, SLA_RISK_COLORS } from '../../utils/slaUtils';
import { timeAgo } from '../../utils/dateUtils';
import Avatar from '../common/Avatar';

/* Building blocks shared by the Daire Başkanı and Müdür home pages (ds-* styles). */

const TONES = {
  navy: ['var(--navy-soft)', 'var(--navy)'],
  orange: ['var(--orange-soft)', 'var(--orange)'],
  ok: ['var(--ok-soft)', 'var(--ok)'],
  warn: ['var(--warn-soft)', 'var(--warn)'],
  danger: ['var(--danger-soft)', 'var(--danger)'],
  violet: ['var(--violet-soft)', 'var(--violet)'],
};

export const OPEN_STATUSES = ['To Do', 'In Progress', 'Onay Bekliyor'];
const isOpen = (i) => OPEN_STATUSES.includes(i.status);
const isUnassigned = (i) => !i.assigneeId && !i.assigneeTeamId;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

export function Hero({ name, eyebrow, sub, chips = [], actions }) {
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="ds-hero mb-3">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div className="ds-hero__eyebrow">{eyebrow} · {today}</div>
          <div className="ds-hero__title">{greeting()}, {name}</div>
          {sub && <div className="ds-hero__sub">{sub}</div>}
        </div>
        {actions && <div className="ds-hero__actions d-flex flex-wrap gap-2">{actions}</div>}
      </div>
      {chips.length > 0 && (
        <div className="ds-hero__chips">
          {chips.map((c) => <span key={c.key || c.label} className="ds-hero__chip">{c.icon}{c.label}</span>)}
        </div>
      )}
    </div>
  );
}

export function Kpi({ label, value, sub, icon, tone = 'navy', onClick }) {
  const [bg, fg] = TONES[tone] || TONES.navy;
  return (
    <div
      className={`ds-kpi ${onClick ? 'ds-kpi--link' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="ds-kpi__head">
        <span className="ds-kpi__label">{label}</span>
        <span className="ds-kpi__icon" style={{ background: bg, color: fg }}>{icon}</span>
      </div>
      <div className="ds-kpi__value" style={tone === 'danger' && value > 0 ? { color: 'var(--danger)' } : undefined}>{value}</div>
      {sub && <div className="ds-kpi__sub">{sub}</div>}
    </div>
  );
}

export function Panel({ title, icon, count, hint, action, children }) {
  return (
    <div className="ds-panel">
      <div className="ds-panel__head">
        <h6 className="ds-panel__title">
          {icon}{title}{count !== undefined && <span className="ds-count">{count}</span>}
        </h6>
        {action || (hint && <span className="ds-panel__hint">{hint}</span>)}
      </div>
      <div className="ds-panel__body">{children}</div>
    </div>
  );
}

export function SlaPill({ issue }) {
  const sla = getSlaInfo(issue);
  if (!sla || sla.risk === 'done') return null;
  const c = SLA_RISK_COLORS[sla.risk];
  return <span className="ds-pill" style={{ background: c.bg, color: c.text }}>{sla.label}</span>;
}

/** One request in a list: status bar, title, number · müdürlük · age, SLA and priority. */
export function RequestRow({ issue, projectName, onOpen, extra }) {
  return (
    <div className="ds-row" role="button" tabIndex={0} onClick={() => onOpen(issue.id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(issue.id)}>
      <span className="ds-row__bar" style={{ background: STATUS_COLORS[issue.status] || '#cbd5e1' }} />
      <div className="ds-row__main">
        <div className="ds-row__title">{issue.title}</div>
        <div className="ds-row__meta">
          {issue.number}{projectName ? ` · ${projectName}` : ''} · {timeAgo(issue.createdAt)}
          {extra ? ` · ${extra}` : ''}
        </div>
      </div>
      <div className="ds-row__side">
        <SlaPill issue={issue} />
        <span className="d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
          <span className="ds-dot" style={{ background: PRIORITY_COLORS[issue.priority] }} />
          {PRIORITY_LABELS[issue.priority]} · {STATUS_LABELS[issue.status]}
        </span>
      </div>
    </div>
  );
}

export function RequestList({ issues, projectsById, onOpen, empty, limit = 6, extra }) {
  if (issues.length === 0) return <div className="ds-panel__empty">{empty}</div>;
  return issues.slice(0, limit).map((i) => (
    <RequestRow key={i.id} issue={i} projectName={projectsById[i.projectId]?.name} onOpen={onOpen} extra={extra?.(i)} />
  ));
}

/** Stacked bar of request statuses with a legend. */
export function StatusStack({ issues }) {
  const order = ['To Do', 'In Progress', 'Onay Bekliyor', 'Done', 'Geri Çevrildi', 'Yönlendirildi', 'İptal Edildi'];
  const counts = order.map((s) => [s, issues.filter((i) => i.status === s).length]).filter(([, n]) => n > 0);
  const total = issues.length;
  if (total === 0) return <div className="ds-panel__empty">Henüz talep yok.</div>;
  return (
    <>
      <div className="ds-stack mb-3">
        {counts.map(([s, n]) => (
          <span key={s} title={`${STATUS_LABELS[s]}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: STATUS_COLORS[s] }} />
        ))}
      </div>
      <div className="row g-2">
        {counts.map(([s, n]) => (
          <div key={s} className="col-6 d-flex align-items-center justify-content-between" style={{ fontSize: '0.8rem' }}>
            <span className="d-flex align-items-center gap-2 text-muted">
              <span className="ds-dot" style={{ background: STATUS_COLORS[s] }} />{STATUS_LABELS[s]}
            </span>
            <span className="fw-semibold">{n} <span className="text-muted fw-normal">· %{Math.round((n / total) * 100)}</span></span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Open work per person (requests and internal tasks), busiest first, linked to their profile. */
export function Workload({ issues, users, limit = 7 }) {
  const counts = {};
  issues.filter((i) => isOpen(i) && i.assigneeId).forEach((i) => {
    counts[i.assigneeId] = (counts[i.assigneeId] || 0) + 1;
  });
  const rows = Object.entries(counts)
    .map(([id, n]) => ({ user: users.find((u) => u.id === id), n }))
    .filter((r) => r.user)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
  if (rows.length === 0) return <div className="ds-panel__empty">Üzerinde açık iş olan personel yok.</div>;
  const max = rows[0].n;
  return rows.map(({ user, n }) => (
    <div key={user.id} className="d-flex align-items-center gap-2 py-2" style={{ borderTop: '1px solid #f1f5f9' }}>
      <Avatar name={user.name} color={user.avatarColor} size={28} />
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="d-flex justify-content-between align-items-center" style={{ fontSize: '0.83rem' }}>
          <Link to={`/personnel/${user.id}`} className="fw-semibold text-decoration-none text-truncate" style={{ color: 'var(--ink)' }}>
            {user.name}
          </Link>
          <span className="fw-semibold ms-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{n} iş</span>
        </div>
        <div className="ds-meter mt-1">
          <span style={{ width: `${(n / max) * 100}%`, background: n === max ? 'var(--orange)' : 'var(--navy)' }} />
        </div>
      </div>
    </div>
  ));
}

/** Request counts used by both home pages. */
export function requestMetrics(requests) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const open = requests.filter(isOpen);
  const rated = requests.filter((r) => r.rating);
  return {
    open,
    unassigned: open.filter((r) => isUnassigned(r) && r.status !== 'Onay Bekliyor'),
    pending: requests.filter((r) => r.status === 'Onay Bekliyor'),
    breached: open.filter((r) => getSlaInfo(r)?.risk === 'breached'),
    atRisk: open.filter((r) => ['breached', 'warning'].includes(getSlaInfo(r)?.risk)),
    today: requests.filter((r) => new Date(r.createdAt) >= todayStart),
    resolvedThisMonth: requests.filter((r) => r.status === 'Done' && r.resolvedAt && new Date(r.resolvedAt) >= monthStart),
    avgRating: rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null,
    ratingCount: rated.length,
  };
}

/** Open requests that most need a look: overdue first, then closest to their deadline, then oldest. */
export function attentionOrder(requests) {
  const rank = { breached: 0, warning: 1, ok: 2 };
  return requests.filter(isOpen).sort((a, b) => {
    const sa = getSlaInfo(a);
    const sb = getSlaInfo(b);
    const r = (rank[sa?.risk] ?? 3) - (rank[sb?.risk] ?? 3);
    if (r !== 0) return r;
    return (sa?.remainingMs ?? Infinity) - (sb?.remainingMs ?? Infinity);
  });
}
