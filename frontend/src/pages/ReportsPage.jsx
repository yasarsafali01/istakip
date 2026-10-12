import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TbTicket, TbHourglass, TbCircleCheck, TbClock, TbStar, TbShieldCheck, TbChartBar, TbFilterOff,
  TbPrinter, TbCalendar, TbBuildingCommunity, TbX, TbAlertTriangle, TbInfoCircle,
} from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { getVisibleProjects } from '../utils/permissionUtils';
import { STATUS_LABELS, PRIORITY_LABELS } from '../constants';
import { teamsApi } from '../api/resources';
import { formatDuration } from '../utils/durationUtils';
import {
  MONTHS, WEEKDAYS, applyFilters, summarize, monthlyTrend, countBy, groupStats, userPeriodMatrix,
  openingHeatmap, answerDistribution, percent, monthlyResolution, monthlySla, ratingDistribution,
  outcomeBy, resolutionBy,
} from '../utils/reportUtils';
import {
  StatTile, ChartCard, BarList, TrendChart, Heatmap, DataTable, ColumnChart, StackedBarList,
} from '../components/reports/Charts';

const ALL = 'all';
const TREND_SERIES = [
  { key: 'opened', label: 'Açılan', color: 'var(--viz-series-1)' },
  { key: 'completed', label: 'Tamamlanan', color: 'var(--viz-series-2)' },
];
// Outcome split used by every "… göre talepler" stacked bar
const OUTCOME_SERIES = [
  { key: 'done', label: 'Tamamlanan', color: 'var(--viz-series-1)' },
  { key: 'open', label: 'Açık', color: 'var(--viz-series-2)' },
  { key: 'closed', label: 'Geri çevrilen / iptal', color: 'var(--viz-series-3)' },
];
const SLA_SERIES = [
  { key: 'onTime', label: 'Süresinde', color: 'var(--viz-series-1)' },
  { key: 'late', label: 'Gecikmeli', color: 'var(--viz-series-2)' },
];
const STATUS_ORDER = ['To Do', 'In Progress', 'Onay Bekliyor', 'Done', 'Geri Çevrildi', 'İptal Edildi', 'Yönlendirildi'];
const PRIORITY_ORDER = ['High', 'Medium', 'Low'];
const fmtNum = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('tr-TR'));
const fmtRating = (r) => (r === null || r === undefined ? '—' : `${r.toFixed(1)} / 5`);
const fmtHours = (h) => (h >= 10 ? `${Math.round(h)} sa` : `${h.toFixed(1).replace('.', ',')} sa`);

function Section({ title, hint }) {
  return (
    <div className="report-section">
      <h5>{title}</h5>
      {hint && <small>— {hint}</small>}
    </div>
  );
}

/**
 * Raporlar → İstatistikler. Every number is computed from the issues the
 * user can see (fetched from the API, scoped by the backend); filters apply
 * to every section at once. "Yazdır / PDF" uses the browser's print dialog
 * (choose "PDF olarak kaydet") with print styles that hide the app chrome.
 */
export default function ReportsPage() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();

  const projects = useMemo(
    () => (currentUser ? getVisibleProjects(state.projects, currentUser) : []),
    [state.projects, currentUser]
  );
  const projectsById = useMemo(() => Object.fromEntries(state.projects.map((p) => [p.id, p])), [state.projects]);
  const unitsById = useMemo(() => Object.fromEntries(state.units.map((u) => [u.id, u])), [state.units]);
  const usersById = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);

  const scopeIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const scoped = useMemo(() => state.issues.filter((i) => scopeIds.has(i.projectId)), [state.issues, scopeIds]);

  const years = useMemo(() => {
    const ys = new Set(scoped.filter((i) => i.createdAt).map((i) => new Date(i.createdAt).getFullYear()));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [scoped]);

  const [f, setF] = useState({
    year: String(new Date().getFullYear()), month: ALL, unitId: '', projectId: '', kind: ALL, formName: '', assigneeId: '',
  });
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const clearFilters = () => setF((s) => ({ ...s, month: ALL, unitId: '', projectId: '', kind: ALL, formName: '', assigneeId: '' }));

  const [teams, setTeams] = useState([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(projects.map((p) => teamsApi.listByProject(p.id).catch(() => [])))
      .then((lists) => { if (!cancelled) setTeams(lists.flat()); });
    return () => { cancelled = true; };
  }, [projects]);
  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  const filtered = useMemo(() => applyFilters(scoped, f, projectsById), [scoped, f, projectsById]);
  // Monthly charts span the selected year themselves, so they ignore the period filter.
  const yearless = useMemo(() => applyFilters(scoped, { ...f, month: ALL, year: ALL }, projectsById), [scoped, f, projectsById]);
  const trend = useMemo(() => monthlyTrend(yearless, f.year), [yearless, f.year]);
  const resolutionTrend = useMemo(() => monthlyResolution(yearless, f.year), [yearless, f.year]);
  const slaTrend = useMemo(() => monthlySla(yearless, f.year), [yearless, f.year]);
  const sum = useMemo(() => summarize(filtered), [filtered]);

  const formNames = useMemo(
    () => [...new Set(scoped.map((i) => i.requestFormName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    [scoped]
  );
  const assignees = useMemo(
    () => [...new Set(scoped.map((i) => i.assigneeId).filter(Boolean))]
      .map((id) => usersById[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [scoped, usersById]
  );
  const visibleUnits = useMemo(
    () => [...new Set(projects.map((p) => p.unitId))].map((id) => unitsById[id]).filter(Boolean),
    [projects, unitsById]
  );

  // ── Breakdowns ────────────────────────────────────────────────────────
  const statusData = STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABELS[s] || s, value: filtered.filter((i) => i.status === s).length }))
    .filter((d) => d.value > 0);
  const priorityData = PRIORITY_ORDER.map((p) => ({ key: p, label: PRIORITY_LABELS[p], value: filtered.filter((i) => i.priority === p).length }));
  const ratingData = ratingDistribution(filtered);
  const requesterData = countBy(filtered.filter((i) => i.isRequest), (i) => i.reporterId, (id) => usersById[id]?.name || 'Bilinmeyen');

  const projectName = (id) => projectsById[id]?.name || '—';
  const userName = (id) => usersById[id]?.name || 'Bilinmeyen';
  const projectOutcome = outcomeBy(filtered, (i) => i.projectId, projectName);
  const projectResolution = resolutionBy(filtered, (i) => i.projectId, projectName);
  const userOutcome = outcomeBy(filtered, (i) => i.assigneeId, userName);
  const userResolution = resolutionBy(filtered, (i) => i.assigneeId, userName);

  // ── Talep türleri (forms) ─────────────────────────────────────────────
  const NO_FORM = '(Talep türü seçilmeden açılanlar)';
  const requests = filtered.filter((i) => i.isRequest);
  const formOutcome = outcomeBy(requests, (i) => i.requestFormName || NO_FORM, (k) => k);
  const [selectedForm, setSelectedForm] = useState('');
  const activeForm = formOutcome.some((r) => r.key === selectedForm) ? selectedForm
    : (formOutcome.find((r) => r.key !== NO_FORM)?.key || '');
  const formRequests = requests.filter((i) => (i.requestFormName || NO_FORM) === activeForm);
  // Seçmeli sorular (cevap dağılımı çıkarılabilenler), form cevap kopyalarından
  const formQuestions = [...new Set(formRequests.flatMap((i) => (i.requestAnswers || [])
    .filter((a) => ['select', 'radio', 'checkbox', 'boolean'].includes(a.type)).map((a) => a.label)))];

  // ── Tables ────────────────────────────────────────────────────────────
  const projectRows = groupStats(filtered, (i) => i.projectId).map((r) => ({
    ...r, name: projectName(r.key), unit: unitsById[projectsById[r.key]?.unitId]?.name || '—',
  }));
  const unitRows = groupStats(filtered, (i) => projectsById[i.projectId]?.unitId).map((r) => ({ ...r, name: unitsById[r.key]?.name || '—' }));
  const userRows = groupStats(filtered, (i) => i.assigneeId).map((r) => ({ ...r, name: userName(r.key) }));
  const formRows = groupStats(requests, (i) => i.requestFormName || NO_FORM).map((r) => ({ ...r, name: r.key }));
  const teamRows = groupStats(filtered, (i) => i.assigneeTeamId).map((r) => ({ ...r, name: teamsById[r.key]?.name || 'Silinmiş ekip' }));

  // ── Person × period matrix ────────────────────────────────────────────
  const [matrixMetric, setMatrixMetric] = useState('completed');
  const [matrixPeriod, setMatrixPeriod] = useState('month');
  const matrix = useMemo(
    () => userPeriodMatrix(yearless, { metric: matrixMetric, period: matrixPeriod, year: f.year }),
    [yearless, matrixMetric, matrixPeriod, f.year]
  );
  const matrixRows = [...matrix.rows.entries()]
    .map(([id, cells]) => ({ key: id, label: userName(id), cells }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));

  const heat = useMemo(() => openingHeatmap(filtered), [filtered]);
  const hourCols = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: String(h).padStart(2, '0'), full: `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59` }));
  const heatRows = WEEKDAYS.map((d, idx) => ({ key: d, label: d, cells: Object.fromEntries(heat.grid[idx].map((v, h) => [String(h), v])) }));

  const statCols = [
    { key: 'total', label: 'Toplam', num: true, value: (r) => r.total },
    { key: 'open', label: 'Açık', num: true, value: (r) => r.open },
    { key: 'pendingApproval', label: 'Onay Bek.', num: true, value: (r) => r.pendingApproval },
    { key: 'done', label: 'Tamamlanan', num: true, value: (r) => r.done },
    { key: 'rejected', label: 'Geri Çevrilen', num: true, value: (r) => r.rejected },
    { key: 'completionRate', label: 'Tamamlanma', num: true, value: (r) => r.completionRate, render: (r) => percent(r.completionRate), csv: (r) => percent(r.completionRate) },
    { key: 'avgWaiting', label: 'Ort. Bekleme', num: true, value: (r) => r.avgWaiting, render: (r) => formatDuration(r.avgWaiting), csv: (r) => formatDuration(r.avgWaiting) },
    { key: 'avgResolution', label: 'Ort. Çözüm', num: true, value: (r) => r.avgResolution, render: (r) => formatDuration(r.avgResolution), csv: (r) => formatDuration(r.avgResolution) },
    { key: 'avgTotal', label: 'Ort. Toplam', num: true, value: (r) => r.avgTotal, render: (r) => formatDuration(r.avgTotal), csv: (r) => formatDuration(r.avgTotal) },
    { key: 'avgRating', label: 'Memnuniyet', num: true, value: (r) => r.avgRating, render: (r) => fmtRating(r.avgRating), csv: (r) => (r.avgRating ? r.avgRating.toFixed(2) : '') },
  ];
  const nameCol = (label) => ({ key: 'name', label, value: (r) => r.name, render: (r) => <span className="fw-medium">{r.name}</span> });
  const personCol = {
    ...nameCol('Personel'),
    render: (r) => (usersById[r.key]
      ? <Link to={`/personnel/${r.key}`} className="fw-medium text-decoration-none">{r.name}</Link>
      : <span className="fw-medium">{r.name}</span>),
  };

  // ── Summary banner chips ──────────────────────────────────────────────
  const periodText = `${f.month !== ALL ? `${MONTHS[Number(f.month) - 1]} ` : ''}${f.year === ALL ? 'Tüm zamanlar' : f.year}`;
  const csvSuffix = `${f.year}${f.month !== ALL ? `-${f.month}` : ''}`;
  const activeChips = [
    f.unitId && { key: 'unitId', label: unitsById[f.unitId]?.name, clear: { unitId: '', projectId: '' } },
    f.projectId && { key: 'projectId', label: projectName(f.projectId), clear: { projectId: '' } },
    f.kind !== ALL && { key: 'kind', label: f.kind === 'request' ? 'Yalnızca talepler' : 'Yalnızca iç işler', clear: { kind: ALL } },
    f.formName && { key: 'formName', label: f.formName === '__none__' ? 'Talep türü yok' : f.formName, clear: { formName: '' } },
    f.assigneeId && { key: 'assigneeId', label: userName(f.assigneeId), clear: { assigneeId: '' } },
  ].filter(Boolean);
  const isEmpty = filtered.length === 0;

  return (
    <div className="viz-root">
      {/* ── Header ── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h4 className="fw-bold mb-0 d-flex align-items-center gap-2"><TbChartBar size={24} className="text-primary" /> İstatistikler</h4>
        <button type="button" className="btn btn-primary d-flex align-items-center gap-2 no-print" onClick={() => window.print()}
          title="Yazdırma penceresinde hedef olarak “PDF olarak kaydet” seçin">
          <TbPrinter size={18} /> Yazdır / PDF
        </button>
      </div>

      {/* Print header (only on paper / PDF) */}
      <div className="print-only mb-3">
        <div className="d-flex align-items-center gap-3 pb-2 mb-2" style={{ borderBottom: '2px solid #EE7203' }}>
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" style={{ height: 52 }} />
          <div>
            <div className="fw-bold" style={{ color: '#1F2855', fontSize: '1.1rem' }}>Mersin Üniversitesi — Talep Takip Sistemi</div>
            <div className="fw-semibold" style={{ color: '#EE7203' }}>İstatistik Raporu</div>
          </div>
        </div>
      </div>
      <div className="print-only mb-2 small text-muted">
        Oluşturulma: {new Date().toLocaleString('tr-TR')} · Hazırlayan: {currentUser?.name}
      </div>

      {/* ── Summary banner ── */}
      <div className="report-banner mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="chip chip-strong"><TbCalendar size={15} /> {periodText}</span>
          <span className="chip chip-strong"><TbTicket size={15} /> {fmtNum(filtered.length)} kayıt</span>
          <span className="chip"><TbBuildingCommunity size={15} /> Yetki alanınız: {projects.length} müdürlük</span>
          {activeChips.map((c) => (
            <span key={c.key} className="chip">
              {c.label}
              <button type="button" className="no-print" aria-label={`${c.label} filtresini kaldır`} onClick={() => set(c.clear)}><TbX size={13} /></button>
            </span>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card border-0 shadow-sm mb-3 viz-card no-print">
        <div className="card-body py-2 d-flex flex-wrap align-items-center gap-2">
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={f.year} onChange={(e) => set({ year: e.target.value })} aria-label="Yıl">
            <option value={ALL}>Tüm yıllar</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={f.month} onChange={(e) => set({ month: e.target.value })} aria-label="Ay">
            <option value={ALL}>Tüm aylar</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          {visibleUnits.length > 1 && (
            <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 220 }} value={f.unitId}
              onChange={(e) => set({ unitId: e.target.value, projectId: '' })} aria-label="Daire başkanlığı">
              <option value="">Tüm daire başkanlıkları</option>
              {visibleUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          {projects.length > 1 && (
            <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 220 }} value={f.projectId}
              onChange={(e) => set({ projectId: e.target.value })} aria-label="Müdürlük">
              <option value="">Tüm müdürlükler</option>
              {projects.filter((p) => !f.unitId || p.unitId === f.unitId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={f.kind} onChange={(e) => set({ kind: e.target.value })} aria-label="Kayıt türü">
            <option value={ALL}>Talepler ve işler</option>
            <option value="request">Yalnızca talepler</option>
            <option value="task">Yalnızca iç işler</option>
          </select>
          {formNames.length > 0 && (
            <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 220 }} value={f.formName}
              onChange={(e) => set({ formName: e.target.value })} aria-label="Talep türü">
              <option value="">Tüm talep türleri</option>
              {formNames.map((n) => <option key={n} value={n}>{n}</option>)}
              <option value="__none__">(Talep türü yok)</option>
            </select>
          )}
          <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 200 }} value={f.assigneeId}
            onChange={(e) => set({ assigneeId: e.target.value })} aria-label="Personel">
            <option value="">Tüm personel</option>
            {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {activeChips.length > 0 || f.month !== ALL ? (
            <button type="button" className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1" onClick={clearFilters}>
              <TbFilterOff size={15} /> Filtreleri temizle
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Empty warning ── */}
      {isEmpty && (
        <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2 border-warning border-2 fw-semibold no-print" role="alert">
          <TbAlertTriangle size={22} className="flex-shrink-0" />
          <span>Seçilen dönemde ({periodText}) ve filtrelerde hiç kayıt yok.</span>
          <span className="ms-auto d-flex gap-2">
            {f.month !== ALL && <button type="button" className="btn btn-sm btn-warning" onClick={() => set({ month: ALL })}>Tüm ayları göster</button>}
            {f.year !== ALL && <button type="button" className="btn btn-sm btn-warning" onClick={() => set({ year: ALL, month: ALL })}>Tüm yılları göster</button>}
            {activeChips.length > 0 && <button type="button" className="btn btn-sm btn-outline-dark" onClick={clearFilters}>Filtreleri temizle</button>}
          </span>
        </div>
      )}

      {/* ── KPI tiles ── */}
      <div className="row g-3 mb-2">
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#2563eb" label="Toplam kayıt" value={fmtNum(sum.total)} icon={<TbTicket size={17} />}
          sub={`${fmtNum(requests.length)} talep · ${fmtNum(filtered.length - requests.length)} iş`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#ea580c" label="Açık" value={fmtNum(sum.open)} icon={<TbHourglass size={17} />}
          sub={`${sum.todo} yapılacak · ${sum.inProgress} devam · ${sum.pendingApproval} onay`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#16a34a" label="Tamamlanan" value={fmtNum(sum.done)} icon={<TbCircleCheck size={17} />}
          sub={`Tamamlanma oranı ${percent(sum.completionRate)}`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#7c3aed" label="Ort. çözüm süresi" value={formatDuration(sum.avgResolution)} icon={<TbClock size={17} />}
          sub={`Bekleme ${formatDuration(sum.avgWaiting)} · Toplam ${formatDuration(sum.avgTotal)}`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#0891b2" label="SLA uyumu" value={percent(sum.slaRate)} icon={<TbShieldCheck size={17} />}
          sub={`${sum.slaCount} çözülmüş talep üzerinden`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#ca8a04" label="Memnuniyet" value={fmtRating(sum.avgRating)} icon={<TbStar size={17} />}
          sub={`${sum.ratingCount} değerlendirme`} /></div>
      </div>

      {/* ── 1. Genel eğilim ── */}
      <Section title="Genel eğilim" hint={f.year === ALL ? 'son 24 ay' : `${f.year} yılı, aylara göre`} />
      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <ChartCard title="Açılan ve tamamlanan talepler" subtitle="Açılanlar açılış, tamamlananlar kapanış ayına göre">
            <TrendChart data={trend} series={TREND_SERIES} />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-5">
          <ChartCard title="Aylık ortalama çözüm süresi" subtitle="O ay kapanan taleplerin işleme alınmasından çözülmesine kadar (saat)">
            <ColumnChart data={resolutionTrend.map((d) => ({ ...d, hint: `${d.count} talep` }))} series={[{ key: 'value', label: 'Ort. çözüm', color: 'var(--viz-series-1)' }]} format={fmtHours} />
          </ChartCard>
        </div>
      </div>

      {/* ── 2. Durum, öncelik, memnuniyet ── */}
      <Section title="Durum, öncelik ve memnuniyet" hint={periodText} />
      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <ChartCard title="Duruma göre">
            <BarList data={statusData} />
          </ChartCard>
        </div>
        <div className="col-12 col-md-6 col-lg-4">
          <ChartCard title="Önceliğe göre">
            <ColumnChart data={priorityData} series={[{ key: 'value', label: 'Kayıt', color: 'var(--viz-series-1)' }]} height={200} />
          </ChartCard>
        </div>
        <div className="col-12 col-md-6 col-lg-4">
          <ChartCard title="Memnuniyet puanları" subtitle={`${sum.ratingCount} değerlendirme · ortalama ${fmtRating(sum.avgRating)}`}>
            <ColumnChart data={ratingData} series={[{ key: 'value', label: 'Değerlendirme', color: 'var(--viz-series-1)' }]} height={200} />
          </ChartCard>
        </div>
      </div>

      {/* ── 3. SLA ── */}
      <Section title="Hizmet süresi (SLA)" hint="talepler önceliğine göre hedef sürede çözüldü mü" />
      <div className="row g-3">
        <div className="col-12">
          <ChartCard title="Aylık süresinde / gecikmeli çözülen talepler" subtitle="Yüksek 8 sa · Orta 24 sa · Düşük 72 sa hedef">
            <ColumnChart data={slaTrend} series={SLA_SERIES} mode="stacked" height={220} />
          </ChartCard>
        </div>
      </div>

      {/* ── 4. Müdürlükler ── */}
      <Section title="Müdürlükler" hint="kayıt sayısı ve çözüm hızı" />
      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <ChartCard title="Müdürlüklere göre kayıtlar" subtitle="Çubuğun tamamı toplamı, renkler sonucu gösterir">
            <StackedBarList data={projectOutcome} series={OUTCOME_SERIES} limit={12} />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-5">
          <ChartCard title="Müdürlüklere göre ortalama çözüm süresi" subtitle="Uzundan kısaya">
            <BarList data={projectResolution} format={formatDuration} limit={12} color="var(--viz-series-1)" empty="Henüz çözülmüş talep yok" />
          </ChartCard>
        </div>
      </div>

      {/* ── 5. Personel ── */}
      <Section title="Personel" hint="atanan kişiye göre iş yükü ve hız" />
      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <ChartCard title="Personele göre kayıtlar">
            <StackedBarList data={userOutcome} series={OUTCOME_SERIES} limit={15} empty="Atanmış kayıt yok" />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-5">
          <ChartCard title="Personele göre ortalama çözüm süresi" subtitle="Uzundan kısaya">
            <BarList data={userResolution} format={formatDuration} limit={15} empty="Henüz çözülmüş talep yok" />
          </ChartCard>
        </div>
        <div className="col-12">
          <ChartCard
            title={`Personel × ${matrixPeriod === 'year' ? 'yıl' : 'ay'}`}
            subtitle={matrixPeriod === 'month'
              ? `${f.year === ALL ? new Date().getFullYear() : f.year} — her hücre o ay ${matrixMetric === 'completed' ? 'tamamladığı' : 'kendisine atanan'} kayıt sayısı; renk koyulaştıkça sayı artar`
              : `Yıllara göre ${matrixMetric === 'completed' ? 'tamamladığı' : 'kendisine atanan'} kayıt sayısı`}
            actions={(
              <div className="d-flex gap-2 no-print">
                <div className="btn-group btn-group-sm" role="group" aria-label="Ölçü">
                  <button type="button" className={`btn ${matrixMetric === 'completed' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMatrixMetric('completed')}>Tamamlanan</button>
                  <button type="button" className={`btn ${matrixMetric === 'assigned' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMatrixMetric('assigned')}>Atanan</button>
                </div>
                <div className="btn-group btn-group-sm" role="group" aria-label="Dönem">
                  <button type="button" className={`btn ${matrixPeriod === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMatrixPeriod('month')}>Ay</button>
                  <button type="button" className={`btn ${matrixPeriod === 'year' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMatrixPeriod('year')}>Yıl</button>
                </div>
              </div>
            )}
          >
            <Heatmap columns={matrix.columns} rows={matrixRows} max={matrix.max} rowHeader="Personel" valueLabel="kayıt" />
          </ChartCard>
        </div>
      </div>

      {/* ── 6. Talep türleri ve form cevapları ── */}
      <Section title="Talep türleri ve form cevapları" />
      <div className="report-help mb-3 d-flex gap-2">
        <TbInfoCircle size={20} className="flex-shrink-0" />
        <div>
          <strong>Talep türü</strong>, müdürlüğün <em>Yönetim → Talep Formları</em> sayfasında hazırladığı formdur (ör. “Arıza Bildirimi”,
          “Yazılım Talebi”). Soldaki grafik her türden kaç talep geldiğini gösterir; bir türe <strong>tıklayın</strong>, sağda o formdaki
          seçmeli sorulara talep sahiplerinin verdiği cevapların dağılımını görün (ör. “Cihaz tipi” sorusuna kaç kişi “Yazıcı” demiş).
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <ChartCard title="Talep türlerine göre talepler" subtitle="Tıklayarak bir tür seçin">
            <StackedBarList data={formOutcome} series={OUTCOME_SERIES} onSelect={setSelectedForm} selectedKey={activeForm}
              empty="Bu filtrelerde talep yok" />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-7">
          <ChartCard title={activeForm ? `“${activeForm}” formundaki cevaplar` : 'Form cevapları'}
            subtitle={activeForm ? `${formRequests.length} talep` : undefined}>
            {!activeForm || activeForm === NO_FORM ? (
              <p className="small fst-italic mb-0" style={{ color: 'var(--viz-text-muted)' }}>
                Cevapları görmek için soldan bir talep türü seçin.
              </p>
            ) : formQuestions.length === 0 ? (
              <p className="small fst-italic mb-0" style={{ color: 'var(--viz-text-muted)' }}>
                Bu formda seçmeli soru (açılır liste, tek/çoklu seçim, onay kutusu) yok; metin cevapları burada özetlenmez.
              </p>
            ) : (
              <div className="row g-3">
                {formQuestions.map((q) => (
                  <div className="col-12 col-md-6" key={q}>
                    <div className="small fw-semibold mb-2" style={{ color: 'var(--viz-text-primary)' }}>{q}</div>
                    <BarList data={answerDistribution(formRequests, q)} limit={8} />
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* ── 7. Talep sahipleri ve zamanlama ── */}
      <Section title="Talep sahipleri ve zamanlama" />
      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <ChartCard title="En çok talep açanlar" subtitle="İlk 10">
            <BarList data={requesterData} limit={10} empty="Talep yok" />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-8">
          <ChartCard title="Talepler ne zaman açılıyor?" subtitle="Haftanın günü × saat — koyu hücreler yoğun saatler">
            <Heatmap columns={hourCols} rows={heatRows} max={heat.max} valueLabel="kayıt" totals />
          </ChartCard>
        </div>
      </div>

      {/* ── 8. Detaylı tablolar ── */}
      <Section title="Detaylı tablolar" hint="sütun başlığına tıklayarak sıralayın, CSV olarak indirin" />
      <div className="row g-3 mb-4">
        <div className="col-12">
          <ChartCard title="Müdürlük bazında">
            <DataTable csvName={`mudurluk-raporu-${csvSuffix}.csv`} defaultSort={{ key: 'total', dir: 'desc' }}
              columns={[nameCol('Müdürlük'), { key: 'unit', label: 'Daire Başkanlığı', value: (r) => r.unit }, ...statCols]} rows={projectRows} />
          </ChartCard>
        </div>
        {unitRows.length > 1 && (
          <div className="col-12">
            <ChartCard title="Daire başkanlığı bazında">
              <DataTable csvName={`daire-baskanligi-raporu-${csvSuffix}.csv`} defaultSort={{ key: 'total', dir: 'desc' }}
                columns={[nameCol('Daire Başkanlığı'), ...statCols]} rows={unitRows} />
            </ChartCard>
          </div>
        )}
        <div className="col-12">
          <ChartCard title="Personel bazında" subtitle="Profilini açmak için personel adına tıklayın">
            <DataTable csvName={`personel-raporu-${csvSuffix}.csv`} defaultSort={{ key: 'done', dir: 'desc' }}
              columns={[personCol, ...statCols]} rows={userRows} empty="Atanmış kayıt yok" />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-6">
          <ChartCard title="Talep türlerinin karşılaştırması" subtitle="Her formun talep sayısı, sonuçları ve süreleri">
            <DataTable csvName={`talep-turu-raporu-${csvSuffix}.csv`} defaultSort={{ key: 'total', dir: 'desc' }}
              columns={[nameCol('Talep Türü'), ...statCols.slice(0, 4), statCols[7]]} rows={formRows} empty="Talep yok" maxHeight={300} />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-6">
          <ChartCard title="Ekip bazında" subtitle="Ekibe atanmış kayıtlar">
            <DataTable csvName={`ekip-raporu-${csvSuffix}.csv`} defaultSort={{ key: 'total', dir: 'desc' }}
              columns={[nameCol('Ekip'), ...statCols.slice(0, 4), statCols[7]]} rows={teamRows} empty="Ekibe atanmış kayıt yok" maxHeight={300} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
