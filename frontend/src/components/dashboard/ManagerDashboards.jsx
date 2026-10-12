import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TbInbox, TbUserQuestion, TbShieldCheck, TbAlarm, TbCircleCheck, TbStar, TbClock,
  TbBuilding, TbUsers, TbCalendar, TbChartBar, TbLayoutKanban, TbForms, TbAlertTriangle,
  TbActivity, TbChartDonut, TbUsersGroup,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLES } from '../../constants';
import { inProject } from '../../utils/permissionUtils';
import { summarize } from '../../utils/reportUtils';
import { formatDuration } from '../../utils/durationUtils';
import RequestDetailModal from '../request/RequestDetailModal';
import {
  Hero, Kpi, Panel, RequestList, StatusStack, Workload, requestMetrics, attentionOrder, OPEN_STATUSES,
} from './DashboardKit';

const fmtRating = (r) => (r === null ? '—' : r.toFixed(1).replace('.', ','));
const byNewest = (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);

function useRequestModal() {
  const [openId, setOpenId] = useState(null);
  const modal = (
    <RequestDetailModal isOpen={!!openId} requestId={openId} onClose={() => setOpenId(null)}
      onCloneSuccess={(id) => setOpenId(id)} />
  );
  return [setOpenId, modal];
}

/* ── Daire Başkanı ─────────────────────────────────────────────────────────── */
export function DepartmentHeadHome({ currentUser }) {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [openRequest, modal] = useRequestModal();

  const unit = state.units.find((u) => u.id === currentUser.unitId);
  const projects = useMemo(() => state.projects.filter((p) => p.unitId === currentUser.unitId), [state.projects, currentUser.unitId]);
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const issues = useMemo(() => state.issues.filter((i) => projectIds.has(i.projectId)), [state.issues, projectIds]);
  const requests = useMemo(() => issues.filter((i) => i.isRequest), [issues]);
  const m = useMemo(() => requestMetrics(requests), [requests]);
  const staff = state.users.filter((u) => u.isActive !== false && u.unitId === currentUser.unitId && u.role !== ROLES.EXTERNAL_USER);
  const activeSprints = state.sprints.filter((s) => s.status === 'Active' && projectIds.has(s.projectId)).length;

  const rows = projects.map((p) => {
    const list = requests.filter((r) => r.projectId === p.id);
    const pm = requestMetrics(list);
    const sum = summarize(list);
    return { p, total: list.length, pm, rate: sum.completionRate, avg: sum.avgResolution };
  });

  return (
    <div>
      {modal}
      <Hero
        name={currentUser.name}
        eyebrow="Daire Başkanı"
        sub={unit?.name}
        chips={[
          { label: `${projects.length} müdürlük`, icon: <TbBuilding size={14} /> },
          { label: `${staff.length} personel`, icon: <TbUsers size={14} /> },
          { label: `${m.today.length} talep bugün geldi`, icon: <TbInbox size={14} /> },
          ...(activeSprints ? [{ label: `${activeSprints} aktif dönem`, icon: <TbCalendar size={14} /> }] : []),
        ]}
        actions={(
          <>
            <button className="btn btn-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/reports')}>
              <TbChartBar size={16} /> İstatistikler
            </button>
            <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/users')}>
              <TbUsers size={16} /> Kullanıcılar
            </button>
          </>
        )}
      />

      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Açık talep" value={m.open.length} icon={<TbInbox size={17} />} tone="navy" sub="Yapılacak + devam eden + onayda" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Atanmamış" value={m.unassigned.length} icon={<TbUserQuestion size={17} />} tone="orange" sub="Kimseye verilmemiş" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Onay bekleyen" value={m.pending.length} icon={<TbShieldCheck size={17} />} tone="violet" sub="Müdür onayında" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Süresi aşan" value={m.breached.length} icon={<TbAlarm size={17} />} tone="danger" sub="Hedef süreyi geçen açık talep" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Bu ay çözülen" value={m.resolvedThisMonth.length} icon={<TbCircleCheck size={17} />} tone="ok" sub={`Toplam ${requests.length} talepten`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Memnuniyet" value={fmtRating(m.avgRating)} icon={<TbStar size={17} />} tone="warn" sub={`${m.ratingCount} değerlendirme · 5 üzerinden`} /></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-8">
          <Panel title="Müdürlüklerin durumu" icon={<TbBuilding size={17} className="text-primary" />} hint="Satıra tıklayınca müdürlük açılır">
            {rows.length === 0 ? <div className="ds-panel__empty">Daire başkanlığınızda müdürlük yok.</div> : (
              <div className="table-responsive">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Müdürlük</th>
                      <th className="text-end">Açık</th>
                      <th className="text-end">Atanmamış</th>
                      <th className="text-end">Onayda</th>
                      <th className="text-end">Süresi aşan</th>
                      <th className="text-end">Bu ay çözülen</th>
                      <th style={{ minWidth: 130 }}>Tamamlanma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ p, pm, rate, avg }) => (
                      <tr key={p.id} onClick={() => navigate(`/projects/${p.id}?tab=board`)}>
                        <td>
                          <div className="fw-semibold">{p.name}</div>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>Ort. çözüm: {formatDuration(avg)}</div>
                        </td>
                        <td className="ds-num">{pm.open.length}</td>
                        <td className="ds-num" style={{ color: pm.unassigned.length ? 'var(--orange)' : undefined }}>{pm.unassigned.length}</td>
                        <td className="ds-num">{pm.pending.length}</td>
                        <td className="ds-num" style={{ color: pm.breached.length ? 'var(--danger)' : undefined }}>{pm.breached.length}</td>
                        <td className="ds-num">{pm.resolvedThisMonth.length}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="ds-meter flex-grow-1">
                              <span style={{ width: `${Math.round((rate ?? 0) * 100)}%`, background: 'var(--ok)' }} />
                            </div>
                            <span className="fw-semibold" style={{ fontSize: '0.76rem', minWidth: 34, textAlign: 'right' }}>
                              {rate === null ? '—' : `%${Math.round(rate * 100)}`}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
        <div className="col-12 col-xl-4">
          <Panel title="Talep durumları" icon={<TbChartDonut size={17} className="text-primary" />} hint={`${requests.length} talep`}>
            <StatusStack issues={requests} />
          </Panel>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-7">
          <Panel title="Dikkat gerektiren talepler" icon={<TbAlertTriangle size={17} style={{ color: 'var(--danger)' }} />}
            count={m.atRisk.length} hint="Süresi aşan ve dolmak üzere olanlar önce">
            <RequestList issues={attentionOrder(requests)} projectsById={projectsById} onOpen={openRequest}
              empty="Açık talep yok, her şey yolunda." />
          </Panel>
        </div>
        <div className="col-12 col-xl-5">
          <Panel title="Personel iş yükü" icon={<TbUsersGroup size={17} className="text-primary" />} hint="Üzerindeki açık işler">
            <Workload issues={issues} users={state.users} />
          </Panel>
        </div>
      </div>

      <Panel title="Son hareketler" icon={<TbActivity size={17} className="text-primary" />} hint="En son güncellenen talepler">
        <RequestList issues={[...requests].sort(byNewest)} projectsById={projectsById} onOpen={openRequest} limit={6}
          empty="Henüz talep yok." />
      </Panel>
    </div>
  );
}

/* ── Müdür ─────────────────────────────────────────────────────────────────── */
export function ProjectManagerHome({ currentUser }) {
  const { state } = useAppContext();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [openRequest, modal] = useRequestModal();

  const projects = useMemo(() => state.projects.filter((p) => p.managerId === currentUser.id), [state.projects, currentUser.id]);
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const issues = useMemo(() => state.issues.filter((i) => projectIds.has(i.projectId)), [state.issues, projectIds]);
  const requests = useMemo(() => issues.filter((i) => i.isRequest), [issues]);
  const m = useMemo(() => requestMetrics(requests), [requests]);
  const sum = useMemo(() => summarize(requests), [requests]);
  const main = projects[0];
  const activeSprint = state.sprints.find((s) => s.status === 'Active' && projectIds.has(s.projectId));
  const staff = state.users.filter((u) => u.isActive !== false && projects.some((p) => inProject(u, p.id)));
  const openTasks = issues.filter((i) => !i.isRequest && OPEN_STATUSES.includes(i.status)).length;
  // Approvals go to the müdürlük's own tab; with several müdürlükler, open the first that has any.
  const approvalsProject = projects.find((p) => m.pending.some((r) => r.projectId === p.id)) || main;

  if (!main) {
    return (
      <div>
        <Hero name={currentUser.name} eyebrow="Müdür" sub="Henüz yönettiğiniz bir müdürlük yok." />
      </div>
    );
  }

  return (
    <div>
      {modal}
      <Hero
        name={currentUser.name}
        eyebrow="Müdür"
        sub={projects.map((p) => p.name).join(' · ')}
        chips={[
          { label: `${staff.length} personel`, icon: <TbUsers size={14} /> },
          { label: `${m.today.length} talep bugün geldi`, icon: <TbInbox size={14} /> },
          { label: `${openTasks} açık iç iş`, icon: <TbLayoutKanban size={14} /> },
          ...(activeSprint ? [{ label: `Aktif dönem: ${activeSprint.name}`, icon: <TbCalendar size={14} /> }] : []),
        ]}
        actions={(
          <>
            <button className="btn btn-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate(`/projects/${main.id}?tab=board`)}>
              <TbLayoutKanban size={16} /> Aktif Talepler
            </button>
            {can('request_form.manage') && (
              <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate(`/request-forms?project=${main.id}`)}>
                <TbForms size={16} /> Talep Formları
              </button>
            )}
          </>
        )}
      />

      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Açık talep" value={m.open.length} icon={<TbInbox size={17} />} tone="navy" sub="Yapılacak + devam eden + onayda" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Atanmamış" value={m.unassigned.length} icon={<TbUserQuestion size={17} />} tone="orange" sub="Birine atanmayı bekliyor" /></div>
        <div className="col-6 col-md-4 col-xl-2">
          <Kpi label="Onayınızı bekleyen" value={m.pending.length} icon={<TbShieldCheck size={17} />} tone="violet" sub="Tıklayın: onay ekranı"
            onClick={() => navigate(`/projects/${approvalsProject.id}?tab=approvals`)} />
        </div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Süresi aşan" value={m.breached.length} icon={<TbAlarm size={17} />} tone="danger" sub="Hedef süreyi geçen açık talep" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Bu ay çözülen" value={m.resolvedThisMonth.length} icon={<TbCircleCheck size={17} />} tone="ok" sub={`Memnuniyet: ${fmtRating(m.avgRating)} / 5`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Ort. çözüm süresi" value={formatDuration(sum.avgResolution)} icon={<TbClock size={17} />} tone="warn" sub="İşleme alındıktan çözülene" /></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-6">
          <Panel title="Onayınızı bekleyenler" icon={<TbShieldCheck size={17} style={{ color: 'var(--violet)' }} />} count={m.pending.length}
            hint="Açıp onaylayın ya da geri gönderin">
            <RequestList issues={[...m.pending].sort(byNewest)} projectsById={projects.length > 1 ? projectsById : {}} onOpen={openRequest}
              empty="Onay bekleyen iş yok." />
          </Panel>
        </div>
        <div className="col-12 col-xl-6">
          <Panel title="Atanmamış talepler" icon={<TbUserQuestion size={17} style={{ color: 'var(--orange)' }} />} count={m.unassigned.length}
            hint="Açıp bir kişiye ya da ekibe atayın">
            <RequestList issues={attentionOrder(m.unassigned)} projectsById={projects.length > 1 ? projectsById : {}} onOpen={openRequest}
              empty="Atanmamış talep yok." />
          </Panel>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-7">
          <Panel title="Süresi dolmak üzere olanlar" icon={<TbAlarm size={17} style={{ color: 'var(--danger)' }} />} count={m.atRisk.length}
            hint="Süresi aşan ve dolmak üzere olanlar önce">
            <RequestList issues={attentionOrder(requests)} projectsById={projects.length > 1 ? projectsById : {}} onOpen={openRequest}
              empty="Açık talep yok, her şey yolunda."
              extra={(r) => (r.assigneeId ? state.users.find((u) => u.id === r.assigneeId)?.name : r.assigneeTeamId ? 'Ekibe atandı' : 'Atanmamış')} />
          </Panel>
        </div>
        <div className="col-12 col-xl-5">
          <Panel title="Ekip iş yükü" icon={<TbUsersGroup size={17} className="text-primary" />} hint="Üzerindeki açık işler">
            <Workload issues={issues} users={state.users} />
          </Panel>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <Panel title="Talep durumları" icon={<TbChartDonut size={17} className="text-primary" />} hint={`${requests.length} talep`}>
            <StatusStack issues={requests} />
          </Panel>
        </div>
        <div className="col-12 col-xl-8">
          <Panel title="Son hareketler" icon={<TbActivity size={17} className="text-primary" />} hint="En son güncellenen talepler">
            <RequestList issues={[...requests].sort(byNewest)} projectsById={projects.length > 1 ? projectsById : {}} onOpen={openRequest} limit={5}
              empty="Henüz talep yok." />
          </Panel>
        </div>
      </div>
    </div>
  );
}
