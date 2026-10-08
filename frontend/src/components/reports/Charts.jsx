import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TbArrowsSort, TbSortAscending, TbSortDescending, TbDownload } from 'react-icons/tb';
import { downloadTableCsv } from '../../utils/reportUtils';

// Sequential blue ramp (light → dark) for heatmaps; index 0 is the empty cell.
const SEQ = ['var(--viz-seq-0)', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const SEQ_DARK_FROM = 4; // from this step on, cell text switches to white

/* ── Tooltip ─────────────────────────────────────────────────────────────── */
function useTooltip() {
  const [tip, setTip] = useState(null); // { x, y, content }
  const show = (e, content) => setTip({ x: e.clientX, y: e.clientY, content });
  const hide = () => setTip(null);
  const node = tip && (
    <div className="viz-tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }} role="tooltip">
      {tip.content}
    </div>
  );
  return { show, hide, node };
}

/* ── Stat tile ───────────────────────────────────────────────────────────── */
export function StatTile({ label, value, sub, icon, accent = '#2563eb' }) {
  return (
    <div className="card border-0 shadow-sm h-100 viz-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="card-body py-3">
        <div className="d-flex align-items-center justify-content-between">
          <span className="small fw-semibold" style={{ color: 'var(--viz-text-secondary)' }}>{label}</span>
          {icon && (
            <span className="d-inline-flex align-items-center justify-content-center rounded-circle"
              style={{ width: 30, height: 30, background: `${accent}1a`, color: accent }}>
              {icon}
            </span>
          )}
        </div>
        <div className="fw-semibold mt-1" style={{ fontSize: '1.6rem', lineHeight: 1.1, color: 'var(--viz-text-primary)' }}>
          {value}
        </div>
        {sub && <div className="small mt-1" style={{ color: 'var(--viz-text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Chart card wrapper ──────────────────────────────────────────────────── */
export function ChartCard({ title, subtitle, actions, children }) {
  return (
    <div className="card border-0 shadow-sm h-100 viz-card">
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
          <div>
            <h6 className="fw-semibold mb-0" style={{ color: 'var(--viz-text-primary)' }}>{title}</h6>
            {subtitle && <div className="small" style={{ color: 'var(--viz-text-muted)' }}>{subtitle}</div>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Horizontal bar list (single series) ─────────────────────────────────── */
export function BarList({ data, format = (v) => v, color = 'var(--viz-series-1)', max: maxProp, empty = 'Veri yok', limit }) {
  const { show, hide, node } = useTooltip();
  const rows = limit ? data.slice(0, limit) : data;
  const max = maxProp ?? Math.max(1, ...rows.map((d) => d.value));
  if (rows.length === 0) return <p className="small fst-italic mb-0" style={{ color: 'var(--viz-text-muted)' }}>{empty}</p>;
  return (
    <div className="d-flex flex-column gap-2">
      {rows.map((d) => (
        <div
          key={d.key}
          className="d-flex align-items-center gap-2"
          onMouseMove={(e) => show(e, <><strong>{d.label}</strong><br />{format(d.value)}{d.hint ? <><br /><span style={{ color: 'var(--viz-text-muted)' }}>{d.hint}</span></> : null}</>)}
          onMouseLeave={hide}
        >
          <span className="small text-truncate" style={{ width: '38%', color: 'var(--viz-text-secondary)' }} title={d.label}>{d.label}</span>
          <div className="flex-grow-1 d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
            <div style={{
              height: 12, width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color || color,
              borderRadius: '0 4px 4px 0', transition: 'width .3s',
            }} />
            <span className="small fw-semibold" style={{ color: 'var(--viz-text-primary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {format(d.value)}
            </span>
          </div>
        </div>
      ))}
      {limit && data.length > limit && (
        <div className="small" style={{ color: 'var(--viz-text-muted)' }}>+{data.length - limit} diğer</div>
      )}
      {node}
    </div>
  );
}

/* ── Line chart (≥1 series over ordered x) with crosshair tooltip ────────── */
export function TrendChart({ data, series, height = 240 }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null); // index
  const [mouse, setMouse] = useState(null);

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 70, bottom: 26, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxY = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key])));
  // clean ticks: 4 steps on a nice round step size
  const step = useMemo(() => {
    const raw = maxY / 4;
    const mag = 10 ** Math.floor(Math.log10(raw || 1));
    return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 1;
  }, [maxY]);
  const top = Math.max(step, Math.ceil(maxY / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const x = (i) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - (v / top) * innerH;

  if (data.length === 0) return <p className="small fst-italic mb-0" style={{ color: 'var(--viz-text-muted)' }}>Veri yok</p>;

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = data.length <= 1 ? 0 : Math.round(((px - pad.left) / innerW) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, idx)));
    setMouse({ x: e.clientX, y: e.clientY });
  }

  const last = data.length - 1;
  // end labels: skip when two series end too close together (legend carries them)
  const endYs = series.map((s) => y(data[last][s.key]));
  const endLabelsFit = endYs.every((v, i) => endYs.every((w, j) => i === j || Math.abs(v - w) >= 14));
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 44)));

  return (
    <div ref={wrapRef}>
      {series.length > 1 && (
        <div className="d-flex flex-wrap gap-3 mb-2 small" style={{ color: 'var(--viz-text-secondary)' }}>
          {series.map((s) => (
            <span key={s.key} className="d-flex align-items-center gap-1">
              <span style={{ width: 14, height: 2, background: s.color, display: 'inline-block', borderRadius: 1 }} /> {s.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={series.map((s) => s.label).join(' ve ')}
        onMouseMove={onMove} onMouseLeave={() => { setHover(null); setMouse(null); }} style={{ display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth="1" />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--viz-text-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t.toLocaleString('tr-TR')}
            </text>
          </g>
        ))}
        {data.map((d, i) => (i % labelEvery === 0 || i === last) && (
          <text key={d.key} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--viz-text-muted)">{d.label}</text>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--viz-axis)" strokeWidth="1" />
        )}
        {series.map((s) => (
          <g key={s.key}>
            <path
              d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[s.key])}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            />
            {hover !== null && (
              <circle cx={x(hover)} cy={y(data[hover][s.key])} r="4.5" fill={s.color} stroke="var(--viz-surface)" strokeWidth="2" />
            )}
            {endLabelsFit && (
              <text x={x(last) + 8} y={y(data[last][s.key]) + 4} fontSize="11" fill="var(--viz-text-secondary)">
                {s.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && mouse && (
        <div className="viz-tooltip" style={{ left: mouse.x + 14, top: mouse.y + 14 }} role="tooltip">
          <strong>{data[hover].fullLabel || data[hover].label}</strong>
          {series.map((s) => (
            <div key={s.key}><span className="viz-key" style={{ background: s.color }} />{s.label}: <strong>{data[hover][s.key]}</strong></div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Column chart: one series, or 2–3 grouped / stacked ──────────────────── */
export function ColumnChart({ data, series, mode = 'grouped', height = 220, format = (v) => v, labelMax = true }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(600);
  const { show, hide, node } = useTooltip();

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0 || data.every((d) => series.every((s) => !d[s.key]))) {
    return <p className="small fst-italic mb-0" style={{ color: 'var(--viz-text-muted)' }}>Veri yok</p>;
  }

  const pad = { top: 18, right: 8, bottom: 26, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const stacked = mode === 'stacked' && series.length > 1;
  const totals = data.map((d) => (stacked ? series.reduce((s, x) => s + (d[x.key] || 0), 0) : Math.max(...series.map((x) => d[x.key] || 0))));
  const maxY = Math.max(1e-9, ...totals);
  const raw = maxY / 4;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 1;
  const top = Math.max(step, Math.ceil(maxY / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const y = (v) => pad.top + innerH - (v / top) * innerH;

  const band = innerW / data.length;
  const groupW = Math.min(stacked ? 24 : 24 * series.length + 2 * (series.length - 1), band * 0.7);
  const barW = stacked ? groupW : (groupW - 2 * (series.length - 1)) / series.length;
  const maxIdx = totals.indexOf(Math.max(...totals));
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 40)));
  // Rounded data-end only, square at the baseline.
  const colPath = (x, y0, w, h, round) => {
    if (h <= 0) return '';
    const r = round ? Math.min(4, w / 2, h) : 0;
    return `M${x},${y0} V${y0 - h + r} Q${x},${y0 - h} ${x + r},${y0 - h} H${x + w - r} Q${x + w},${y0 - h} ${x + w},${y0 - h + r} V${y0} Z`;
  };

  const tooltipFor = (d) => (
    <>
      <strong>{d.fullLabel || d.label}</strong>
      {series.map((s) => (
        <div key={s.key}><span className="viz-key" style={{ background: s.color }} />{s.label}: <strong>{format(d[s.key] || 0)}</strong></div>
      ))}
      {d.hint && <div style={{ color: 'var(--viz-text-muted)' }}>{d.hint}</div>}
    </>
  );

  return (
    <div ref={wrapRef}>
      {series.length > 1 && (
        <div className="d-flex flex-wrap gap-3 mb-2 small" style={{ color: 'var(--viz-text-secondary)' }}>
          {series.map((s) => (
            <span key={s.key} className="d-flex align-items-center gap-1">
              <span style={{ width: 10, height: 10, background: s.color, display: 'inline-block', borderRadius: 2 }} /> {s.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" style={{ display: 'block' }}
        aria-label={series.map((s) => s.label).join(', ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth="1" />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--viz-text-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = pad.left + band * i + (band - groupW) / 2;
          const base = y(0);
          let acc = 0;
          return (
            <g key={d.key} onMouseMove={(e) => show(e, tooltipFor(d))} onMouseLeave={hide}>
              {/* hit target: the whole band */}
              <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} fill="transparent" />
              {series.map((s, si) => {
                const v = d[s.key] || 0;
                if (stacked) {
                  const h = (v / top) * innerH;
                  const y0 = base - acc;
                  acc += h;
                  const isTop = series.slice(si + 1).every((x) => !(d[x.key] > 0));
                  // 2px surface gap between stacked segments
                  return <path key={s.key} d={colPath(gx, y0, barW, Math.max(0, h - (isTop ? 0 : 2)), isTop)} fill={s.color} />;
                }
                const x = gx + si * (barW + 2);
                return <path key={s.key} d={colPath(x, base, barW, (v / top) * innerH, true)} fill={s.color} />;
              })}
              {labelMax && i === maxIdx && totals[i] > 0 && (
                <text x={gx + groupW / 2} y={y(totals[i]) - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--viz-text-primary)">
                  {format(totals[i])}
                </text>
              )}
              {(i % labelEvery === 0 || i === data.length - 1) && (
                <text x={pad.left + band * i + band / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--viz-text-muted)">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}

/* ── Horizontal stacked bars (part-to-whole per category) ────────────────── */
export function StackedBarList({ data, series, limit, onSelect, selectedKey, empty = 'Veri yok' }) {
  const { show, hide, node } = useTooltip();
  const rows = limit ? data.slice(0, limit) : data;
  if (rows.length === 0) return <p className="small fst-italic mb-0" style={{ color: 'var(--viz-text-muted)' }}>{empty}</p>;
  const max = Math.max(1, ...rows.map((d) => series.reduce((s, x) => s + (d[x.key] || 0), 0)));
  return (
    <div>
      <div className="d-flex flex-wrap gap-3 mb-2 small" style={{ color: 'var(--viz-text-secondary)' }}>
        {series.map((s) => (
          <span key={s.key} className="d-flex align-items-center gap-1">
            <span style={{ width: 10, height: 10, background: s.color, display: 'inline-block', borderRadius: 2 }} /> {s.label}
          </span>
        ))}
      </div>
      <div className="d-flex flex-column gap-2">
        {rows.map((d) => {
          const total = series.reduce((s, x) => s + (d[x.key] || 0), 0);
          const visible = series.filter((s) => d[s.key] > 0);
          const selected = selectedKey === d.key;
          return (
            <div
              key={d.key}
              className={`d-flex align-items-center gap-2 rounded ${onSelect ? 'px-1' : ''}`}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={onSelect ? () => onSelect(d.key) : undefined}
              onKeyDown={onSelect ? (e) => e.key === 'Enter' && onSelect(d.key) : undefined}
              style={{ cursor: onSelect ? 'pointer' : 'default', background: selected ? '#eef4fd' : 'transparent', outline: selected ? '1px solid #b7d3f6' : 'none' }}
              onMouseMove={(e) => show(e, (
                <>
                  <strong>{d.label}</strong> — toplam {total}
                  {series.map((s) => <div key={s.key}><span className="viz-key" style={{ background: s.color }} />{s.label}: <strong>{d[s.key] || 0}</strong></div>)}
                  {onSelect && <div style={{ color: 'var(--viz-text-muted)' }}>Ayrıntı için tıklayın</div>}
                </>
              ))}
              onMouseLeave={hide}
            >
              <span className="small text-truncate" style={{ width: '34%', color: 'var(--viz-text-secondary)' }} title={d.label}>{d.label}</span>
              <div className="flex-grow-1 d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                <div className="d-flex" style={{ width: `${Math.max(2, (total / max) * 100)}%`, gap: 2 }}>
                  {visible.map((s, idx) => (
                    <div key={s.key} style={{
                      flexGrow: d[s.key], flexBasis: 0, height: 12, background: s.color,
                      borderRadius: idx === visible.length - 1 ? '0 4px 4px 0' : 0,
                    }} />
                  ))}
                </div>
                <span className="small fw-semibold" style={{ color: 'var(--viz-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
              </div>
            </div>
          );
        })}
        {limit && data.length > limit && (
          <div className="small" style={{ color: 'var(--viz-text-muted)' }}>+{data.length - limit} diğer (tabloda)</div>
        )}
      </div>
      {node}
    </div>
  );
}

/* ── Heatmap matrix (sequential ramp) ────────────────────────────────────── */
export function Heatmap({ columns, rows, max, rowHeader = '', valueLabel = 'adet', totals = true }) {
  const { show, hide, node } = useTooltip();
  const stepFor = (v) => (!v ? 0 : Math.min(SEQ.length - 1, 1 + Math.floor((v / Math.max(1, max)) * (SEQ.length - 2) - 1e-9)));
  if (rows.length === 0) return <p className="small fst-italic mb-0" style={{ color: 'var(--viz-text-muted)' }}>Veri yok</p>;
  return (
    <div className="table-responsive">
      <table className="viz-heat w-100" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="small fw-semibold text-start pe-2" style={{ color: 'var(--viz-text-secondary)' }}>{rowHeader}</th>
            {columns.map((c) => <th key={c.key} className="small fw-normal" style={{ color: 'var(--viz-text-muted)' }}>{c.label}</th>)}
            {totals && <th className="small fw-semibold" style={{ color: 'var(--viz-text-secondary)' }}>Toplam</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = columns.reduce((s, c) => s + (r.cells[c.key] || 0), 0);
            return (
              <tr key={r.key}>
                <td className="small text-start pe-2 text-truncate" style={{ maxWidth: 180, color: 'var(--viz-text-primary)' }} title={r.label}>{r.label}</td>
                {columns.map((c) => {
                  const v = r.cells[c.key] || 0;
                  const s = stepFor(v);
                  return (
                    <td key={c.key}
                      style={{ background: SEQ[s], color: s >= SEQ_DARK_FROM ? '#fff' : 'var(--viz-text-primary)', minWidth: 30, borderRadius: 4 }}
                      onMouseMove={(e) => show(e, <><strong>{r.label}</strong><br />{c.full || c.label}: <strong>{v}</strong> {valueLabel}</>)}
                      onMouseLeave={hide}>
                      {v || ''}
                    </td>
                  );
                })}
                {totals && <td className="small fw-semibold" style={{ color: 'var(--viz-text-primary)' }}>{total}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {node}
    </div>
  );
}

/* ── Sortable data table with CSV export ─────────────────────────────────── */
export function DataTable({ columns, rows, defaultSort, csvName, empty = 'Veri yok', maxHeight = 420 }) {
  const [sort, setSort] = useState(defaultSort || { key: columns[0].key, dir: 'desc' });
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const get = col.sortValue || col.value;
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb, 'tr') : va - vb;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, columns, sort]);

  function toggle(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  }

  if (rows.length === 0) return <p className="small fst-italic mb-0" style={{ color: 'var(--viz-text-muted)' }}>{empty}</p>;
  return (
    <div>
      {csvName && (
        <div className="d-flex justify-content-end mb-2">
          <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={() => downloadTableCsv(csvName, columns, sorted)}>
            <TbDownload size={14} /> CSV indir
          </button>
        </div>
      )}
      <div className="table-responsive" style={{ maxHeight, overflowY: 'auto' }}>
        <table className="table table-sm table-hover align-middle mb-0 viz-table small">
          <thead className="sticky-top" style={{ background: 'var(--viz-surface)' }}>
            <tr>
              {columns.map((c) => {
                const active = sort.key === c.key;
                const Icon = !active ? TbArrowsSort : sort.dir === 'asc' ? TbSortAscending : TbSortDescending;
                return (
                  <th key={c.key} className={c.num ? 'num' : ''}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => toggle(c.key)}
                      className="btn btn-link p-0 text-decoration-none small fw-semibold"
                      style={{ color: active ? 'var(--viz-text-primary)' : 'var(--viz-text-secondary)', whiteSpace: 'nowrap' }}>
                      {c.label} <Icon size={12} style={{ opacity: active ? 1 : 0.4 }} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.key}>
                {columns.map((c) => (
                  <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : c.value(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
