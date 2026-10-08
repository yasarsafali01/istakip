import React, { useMemo, useState } from 'react';
import {
  TbUserCheck, TbCircleCheck, TbHourglass, TbShieldCheck, TbClock, TbStar, TbCalendar, TbTicket, TbPrinter, TbAlertTriangle,
} from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../constants';
import { formatDuration } from '../utils/durationUtils';
import {
  WEEKDAYS, summarize, personalMonthly, resolvedByYear, resolutionBuckets, timeHeatmap, countBy,
} from '../utils/reportUtils';
import { StatTile, ChartCard, BarList, ColumnChart, Heatmap } from '../components/reports/Charts';

const ALL = 'all';
const TASKS = '__tasks__';
const NO_FORM = '__none__';
const fmtNum = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('tr-TR'));
const fmtHours = (h) => (h >= 10 ? `${Math.round(h)} sa` : `${h.toFixed(1).replace('.', ',')} sa`);
const fmtRating = (r) => (r === null || r === undefined ? '—' : `${r.toFixed(1)} / 5`);
const HOUR_COLS = Array.from({ length: 24 }, (_, h) => ({
  key: String(h), label: String(h).padStart(2, '0'), full: `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59`,
}));

function Section({ title, hint }) {
  return (
    <div className="report-section">
      <h5>{title}</h5>
      {hint && <small>— {hint}</small>}
    </div>
  );
}

const heatRows = (heat) => WEEKDAYS.map((d, idx) => ({
  key: d, label: d, cells: Object.fromEntries(heat.grid[idx].map((v, h) => [String(h), v])),
}));

/**
 * Raporlar → Performansım: a person's own numbers — requests resolved per
 * month / year (switchable by talep türü), working time and when they work.
 * Managers can pick anyone whose work they can see.
 */
export default function PerformancePage() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const isManager = [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(currentUser?.role);
  const usersById = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);

  // People a manager can look at: everyone with work assigned in what they can see.
  const people = useMemo(() => {
    const ids = new Set(state.issues.map((i) => i.assigneeId).filter(Boolean));
    if (currentUser) ids.add(currentUser.id);
    return [...ids].map((id) => usersById[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [state.issues, usersById, currentUser]);

  const [personId, setPersonId] = useState(currentUser?.id || '');
  const person = usersById[personId] || currentUser;
  const mine = useMemo(() => state.issues.filter((i) => i.assigneeId === person?.id), [state.issues, person]);

  const years = useMemo(() => {
    const ys = new Set(mine.filter((i) => i.resolvedAt).map((i) => new Date(i.resolvedAt).getFullYear()));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [mine]);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  // Talep türü switch: every chart below follows it
  const formOptions = useMemo(
    () => [...new Set(mine.filter((i) => i.isRequest).map((i) => i.requestFormName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    [mine]
  );
  const [form, setForm] = useState(ALL);
  const scoped = useMemo(() => mine.filter((i) => {
    if (form === ALL) return true;
    if (form === TASKS) return !i.isRequest;
    if (form === NO_FORM) return i.isRequest && !i.requestFormName;
    return i.requestFormName === form;
  }), [mine, form]);

  const sum = useMemo(() => summarize(scoped), [scoped]);
  const monthly = useMemo(() => personalMonthly(scoped, year), [scoped, year]);
  const yearly = useMemo(() => resolvedByYear(scoped), [scoped]);
  const buckets = useMemo(() => resolutionBuckets(scoped), [scoped]);
  const startHeat = useMemo(() => timeHeatmap(scoped, 'startedAt'), [scoped]);
  const doneHeat = useMemo(() => timeHeatmap(scoped, 'resolvedAt'), [scoped]);
  const byForm = countBy(mine.filter((i) => i.status === 'Done'),
    (i) => (i.isRequest ? (i.requestFormName || '(Talep türü yok)') : 'İç işler'));

  const now = new Date();
  const thisMonth = monthly.find((m) => m.key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const yearResolved = monthly.reduce((s, m) => s + m.resolved, 0);
  const yearWork = monthly.reduce((s, m) => s + m.workHours, 0);
  const hasLogged = monthly.some((m) => m.loggedHours > 0);
  const formLabel = form === ALL ? 'Tüm türler' : form === TASKS ? 'İç işler' : form === NO_FORM ? 'Talep türü yok' : form;

  return (
    <div className="viz-root">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h4 className="fw-bold mb-0 d-flex align-items-center gap-2"><TbUserCheck size={24} className="text-primary" /> Performansım</h4>
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
            <div className="fw-semibold" style={{ color: '#EE7203' }}>Personel Performans Raporu</div>
          </div>
        </div>
        <div className="small text-muted">Oluşturulma: {new Date().toLocaleString('tr-TR')} · Hazırlayan: {currentUser?.name}</div>
      </div>

      {/* ── Summary banner + selectors ── */}
      <div className="report-banner mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="chip chip-strong"><TbUserCheck size={15} /> {person?.name}</span>
          <span className="chip chip-strong"><TbCalendar size={15} /> {year}</span>
          <span className="chip"><TbTicket size={15} /> {formLabel}</span>
          <span className="chip">Bu yıl {yearResolved} talep çözdü</span>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3 viz-card no-print">
        <div className="card-body py-2 d-flex flex-wrap align-items-center gap-2">
          {isManager && people.length > 1 && (
            <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 240 }} value={person?.id || ''}
              onChange={(e) => { setPersonId(e.target.value); setForm(ALL); }} aria-label="Personel">
              {people.map((u) => <option key={u.id} value={u.id}>{u.id === currentUser?.id ? `${u.name} (ben)` : u.name}</option>)}
            </select>
          )}
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(e.target.value)} aria-label="Yıl">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="btn-group btn-group-sm flex-wrap" role="group" aria-label="Talep türü">
            {[[ALL, 'Tümü'], ...formOptions.map((n) => [n, n]), [NO_FORM, 'Türsüz talepler'], [TASKS, 'İç işler']].map(([v, label]) => (
              <button key={v} type="button" className={`btn ${form === v ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setForm(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mine.length === 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2 border-warning border-2 fw-semibold" role="alert">
          <TbAlertTriangle size={22} /> {person?.name} adına atanmış talep yok.
        </div>
      )}

      {/* ── KPI tiles ── */}
      <div className="row g-3 mb-2">
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#16a34a" label="Bu ay çözdüğü" value={fmtNum(thisMonth?.resolved ?? 0)} icon={<TbCircleCheck size={17} />}
          sub={`${year} toplamı: ${yearResolved}`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#2563eb" label="Tüm zamanlar" value={fmtNum(sum.done)} icon={<TbTicket size={17} />}
          sub={`${sum.total} atanmış kayıttan`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#ea580c" label="Üzerindeki açık" value={fmtNum(sum.todo + sum.inProgress)} icon={<TbHourglass size={17} />}
          sub={`${sum.todo} yapılacak · ${sum.inProgress} devam`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#8b5cf6" label="Onay bekleyen" value={fmtNum(sum.pendingApproval)} icon={<TbShieldCheck size={17} />}
          sub="Yönetici onayında" /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#7c3aed" label="Ort. çözüm süresi" value={formatDuration(sum.avgResolution)} icon={<TbClock size={17} />}
          sub={`${year} çalışma: ${fmtHours(yearWork)}`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><StatTile accent="#ca8a04" label="Memnuniyet" value={fmtRating(sum.avgRating)} icon={<TbStar size={17} />}
          sub={`${sum.ratingCount} değerlendirme`} /></div>
      </div>

      {/* ── Çözülen talepler ── */}
      <Section title="Çözülen talepler" hint={formLabel} />
      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <ChartCard title={`Aylık çözülen talepler — ${year}`} subtitle="Kapanış ayına göre">
            <ColumnChart data={monthly} series={[{ key: 'resolved', label: 'Çözülen', color: 'var(--viz-series-1)' }]} />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-4">
          <ChartCard title="Yıllık çözülen talepler">
            <ColumnChart data={yearly} series={[{ key: 'value', label: 'Çözülen', color: 'var(--viz-series-1)' }]} />
          </ChartCard>
        </div>
        <div className="col-12">
          <ChartCard title="Talep türüne göre çözdükleri" subtitle="Tüm zamanlar — tür seçiminden bağımsız">
            <BarList data={byForm} empty="Henüz çözülmüş talep yok" />
          </ChartCard>
        </div>
      </div>

      {/* ── Çalışma süreleri ── */}
      <Section title="Çalışma süreleri" hint="işleme alındığı andan çözüldüğü ana kadar geçen süre" />
      <div className="row g-3">
        <div className="col-12 col-xl-6">
          <ChartCard title={`Aylık toplam çalışma süresi — ${year}`}
            subtitle={hasLogged ? 'Çözüm süreleri toplamı ve elle girilen harcanan zaman (saat)' : 'O ay çözülen taleplerin çözüm süreleri toplamı (saat)'}>
            <ColumnChart
              data={monthly}
              series={hasLogged
                ? [{ key: 'workHours', label: 'Çözüm süresi', color: 'var(--viz-series-1)' }, { key: 'loggedHours', label: 'Harcanan zaman (girilen)', color: 'var(--viz-series-2)' }]
                : [{ key: 'workHours', label: 'Çözüm süresi', color: 'var(--viz-series-1)' }]}
              format={fmtHours}
            />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-6">
          <ChartCard title={`Aylık ortalama çözüm süresi — ${year}`} subtitle="Talep başına (saat)">
            <ColumnChart data={monthly} series={[{ key: 'avgHours', label: 'Ort. çözüm', color: 'var(--viz-series-1)' }]} format={fmtHours} />
          </ChartCard>
        </div>
        <div className="col-12">
          <ChartCard title="Çözüm süresi dağılımı" subtitle="Talepler ne kadar sürede çözülüyor (tüm zamanlar)">
            <ColumnChart data={buckets} series={[{ key: 'value', label: 'Talep', color: 'var(--viz-series-1)' }]} height={200} />
          </ChartCard>
        </div>
      </div>

      {/* ── Çalışma zamanları ── */}
      <Section title="Çalışma zamanları" hint="haftanın günü × saat — koyu hücreler yoğun saatler" />
      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-6">
          <ChartCard title="Talepleri işleme aldığı saatler">
            <Heatmap columns={HOUR_COLS} rows={heatRows(startHeat)} max={startHeat.max} valueLabel="talep" />
          </ChartCard>
        </div>
        <div className="col-12 col-xl-6">
          <ChartCard title="Talepleri kapattığı saatler">
            <Heatmap columns={HOUR_COLS} rows={heatRows(doneHeat)} max={doneHeat.max} valueLabel="talep" />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
