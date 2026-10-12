import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TbInbox, TbUserQuestion, TbShieldCheck, TbAlarm, TbCircleCheck, TbStar, TbBuilding, TbUsers,
  TbCalendar, TbChartBar, TbLayoutKanban, TbAlertTriangle, TbActivity, TbChartDonut, TbUsersGroup,
  TbFolder, TbList, TbChecklist, TbUserCheck,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { ROLES } from '../../constants';
import { inProject } from '../../utils/permissionUtils';
import { summarize } from '../../utils/reportUtils';
import { formatDuration } from '../../utils/durationUtils';
import RequestDetailModal from '../request/RequestDetailModal';
import IssueModal from '../issue/IssueModal';
import {
  Hero, Kpi, Panel, RequestList, StatusStack, Workload, requestMetrics, attentionOrder, OPEN_STATUSES,
} from './DashboardKit';

/* Sistem Yöneticisi and Personel home pages — same layout language as ManagerDashboards. */

const fmtRating = (r) => (r === null ? '—' : r.toFixed(1).replace('.', ','));
const byNewest = (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
const isRequester = (u) => u.role === ROLES.EXTERNAL_USER;

// Requests open in the request view, internal tasks in the issue view.
function useItemModal() {
  const { state } = useAppContext();
  const [openId, setOpenId] = useState(null);
  const item = state.issues.find((i) => i.id === openId);
  const modal = item?.isRequest ? (
    <RequestDetailModal isOpen requestId={openId} onClose={() => setOpenId(null)} onCloneSuccess={(id) => setOpenId(id)} />
  ) : (
    <IssueModal isOpen={!!item} issueId={openId} onClose={() => setOpenId(null)} />
  );
  return [setOpenId, modal];
}

/* ── Sistem Yöneticisi ─────────────────────────────────────────────────────── */
export function AdminHome({ currentUser }) {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [openItem, modal] = useItemModal();

  const projectsById = useMemo(() => Object.fromEntries(state.projects.map((p) => [p.id, p])), [state.projects]);
  const requests = useMemo(() => state.issues.filter((i) => i.isRequest), [state.issues]);
  const m = useMemo(() => requestMetrics(requests), [requests]);
  const staff = state.users.filter((u) => u.isActive !== false && !isRequester(u));
  const activeSprints = state.sprints.filter((s) => s.status === 'Active').length;

  const rows = state.units.map((u) => {
    const pids = new Set(state.projects.filter((p) => p.unitId === u.id).map((p) => p.id));
    const list = requests.filter((r) => pids.has(r.projectId));
    const sum = summarize(list);
    return { u, projectCount: pids.size, pm: requestMetrics(list), rate: sum.completionRate, avg: sum.avgResolution };
  });

  return (
    <div>
      {modal}
      <Hero
        name={currentUser.name}
        eyebrow="Sistem Yöneticisi"
        sub="Mersin Üniversitesi · tüm daire başkanlıkları"
        chips={[
          { label: `${state.units.length} daire başkanlığı`, icon: <TbBuilding size={14} /> },
          { label: `${state.projects.length} müdürlük`, icon: <TbFolder size={14} /> },
          { label: `${staff.length} personel`, icon: <TbUsers size={14} /> },
          { label: `${m.today.length} talep bugün geldi`, icon: <TbInbox size={14} /> },
          ...(activeSprints ? [{ label: `${activeSprints} aktif dönem`, icon: <TbCalendar size={14} /> }] : []),
        ]}
        actions={(
          <>
            <button className="btn btn-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/reports')}>
              <TbChartBar size={16} /> İstatistikler
            </button>
            <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/units')}>
              <TbBuilding size={16} /> Daire Başkanlıkları
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
          <Panel title="Daire başkanlıklarının durumu" icon={<TbBuilding size={17} className="text-primary" />} hint="Satıra tıklayınca müdürlükleri açılır">
            {rows.length === 0 ? <div className="ds-panel__empty">Henüz daire başkanlığı yok.</div> : (
              <div className="table-responsive">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Daire Başkanlığı</th>
                      <th className="text-end">Açık</th>
                      <th className="text-end">Atanmamış</th>
                      <th className="text-end">Onayda</th>
                      <th className="text-end">Süresi aşan</th>
                      <th className="text-end">Bu ay çözülen</th>
                      <th style={{ minWidth: 130 }}>Tamamlanma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ u, projectCount, pm, rate, avg }) => (
                      <tr key={u.id} onClick={() => navigate(`/units?unit=${u.id}`)}>
                        <td>
                          <div className="fw-semibold">{u.name}</div>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>{projectCount} müdürlük · Ort. çözüm: {formatDuration(avg)}</div>
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
            <RequestList issues={attentionOrder(requests)} projectsById={projectsById} onOpen={openItem}
              empty="Açık talep yok, her şey yolunda." />
          </Panel>
        </div>
        <div className="col-12 col-xl-5">
          <Panel title="Personel iş yükü" icon={<TbUsersGroup size={17} className="text-primary" />} hint="Üzerindeki açık işler">
            <Workload issues={state.issues} users={state.users} />
          </Panel>
        </div>
      </div>

      <Panel title="Son hareketler" icon={<TbActivity size={17} className="text-primary" />} hint="En son güncellenen talepler">
        <RequestList issues={[...requests].sort(byNewest)} projectsById={projectsById} onOpen={openItem} limit={6}
          empty="Henüz talep yok." />
      </Panel>
    </div>
  );
}

/* ── Personel ──────────────────────────────────────────────────────────────── */
export function WorkerHome({ currentUser }) {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [openItem, modal] = useItemModal();

  const projects = useMemo(() => state.projects.filter((p) => inProject(currentUser, p.id)), [state.projects, currentUser]);
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const projectsById = useMemo(() => (projects.length > 1 ? Object.fromEntries(projects.map((p) => [p.id, p])) : {}), [projects]);
  const teams = currentUser.teams || [];
  const teamIds = new Set(teams.map((t) => t.teamId));
  const teamName = (id) => teams.find((t) => t.teamId === id)?.teamName || 'Ekip';

  const mine = useMemo(() => state.issues.filter((i) => i.assigneeId === currentUser.id), [state.issues, currentUser.id]);
  const m = useMemo(() => requestMetrics(mine), [mine]);
  const sum = useMemo(() => summarize(mine), [mine]);
  const teamQueue = state.issues.filter((i) => !i.assigneeId && teamIds.has(i.assigneeTeamId) && OPEN_STATUSES.includes(i.status));
  const backlog = mine.filter((i) => !i.isRequest && !i.sprintId && OPEN_STATUSES.includes(i.status));
  const done = mine.filter((i) => i.status === 'Done').sort((a, b) => new Date(b.resolvedAt || b.updatedAt) - new Date(a.resolvedAt || a.updatedAt));
  const main = projects[0];
  const activeSprint = state.sprints.find((s) => s.status === 'Active' && projectIds.has(s.projectId));

  return (
    <div>
      {modal}
      <Hero
        name={currentUser.name}
        eyebrow="Personel"
        sub={projects.length ? projects.map((p) => p.name).join(' · ') : 'Henüz bir müdürlüğe bağlı değilsiniz.'}
        chips={[
          { label: `${m.open.length} açık işiniz var`, icon: <TbChecklist size={14} /> },
          ...(teams.length ? [{ label: `${teams.length} ekip`, icon: <TbUsersGroup size={14} /> }] : []),
          ...(activeSprint ? [{ label: `Aktif dönem: ${activeSprint.name}`, icon: <TbCalendar size={14} /> }] : []),
        ]}
        actions={main && (
          <>
            <button className="btn btn-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate(`/projects/${main.id}?tab=board`)}>
              <TbLayoutKanban size={16} /> Aktif Talepler
            </button>
            <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate(`/projects/${main.id}?tab=backlog`)}>
              <TbList size={16} /> Bekleyen Talepler
            </button>
            <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/performance')}>
              <TbChartBar size={16} /> Performansım
            </button>
          </>
        )}
      />

      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Üzerimdeki açık" value={m.open.length} icon={<TbChecklist size={17} />} tone="navy" sub="Talepler + iç işler" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Ekibime gelen" value={teamQueue.length} icon={<TbUsersGroup size={17} />} tone="orange" sub="Ekibe atanmış, sahipsiz" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Onayda" value={m.pending.length} icon={<TbShieldCheck size={17} />} tone="violet" sub="Müdür onayı bekliyor" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Süresi aşan" value={m.breached.length} icon={<TbAlarm size={17} />} tone="danger" sub="Hedef süreyi geçen" /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Bu ay çözdüğüm" value={m.resolvedThisMonth.length} icon={<TbCircleCheck size={17} />} tone="ok" sub={`Ort. çözüm: ${formatDuration(sum.avgResolution)}`} /></div>
        <div className="col-6 col-md-4 col-xl-2"><Kpi label="Memnuniyet" value={fmtRating(m.avgRating)} icon={<TbStar size={17} />} tone="warn" sub={`${m.ratingCount} değerlendirme · 5 üzerinden`} /></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-7">
          <Panel title="Üzerimdeki işler" icon={<TbUserCheck size={17} className="text-primary" />} count={m.open.length}
            hint="Süresi aşan ve dolmak üzere olanlar önce">
            <RequestList issues={attentionOrder(mine)} projectsById={projectsById} onOpen={openItem} limit={8}
              empty="Üzerinizde açık iş yok." extra={(i) => (i.isRequest ? null : 'İç iş')} />
          </Panel>
        </div>
        <div className="col-12 col-xl-5">
          <Panel title="Ekibime gelen talepler" icon={<TbUsersGroup size={17} style={{ color: 'var(--orange)' }} />} count={teamQueue.length}
            hint="Açıp üzerinize alın">
            <RequestList issues={attentionOrder(teamQueue)} projectsById={projectsById} onOpen={openItem}
              empty={teams.length ? 'Ekibinizi bekleyen talep yok.' : 'Herhangi bir ekipte değilsiniz.'}
              extra={(i) => teamName(i.assigneeTeamId)} />
          </Panel>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <Panel title="İşlerimin durumu" icon={<TbChartDonut size={17} className="text-primary" />} hint={`${mine.length} kayıt`}>
            <StatusStack issues={mine} />
          </Panel>
        </div>
        <div className="col-12 col-xl-4">
          <Panel title="Aya atanmamış işlerim" icon={<TbList size={17} className="text-primary" />} count={backlog.length}
            hint="Bekleyen iç işler">
            <RequestList issues={backlog} projectsById={projectsById} onOpen={openItem} empty="Bekleyen işiniz yok." />
          </Panel>
        </div>
        <div className="col-12 col-xl-4">
          <Panel title="Son tamamladıklarım" icon={<TbActivity size={17} className="text-primary" />}>
            <RequestList issues={done} projectsById={projectsById} onOpen={openItem} limit={5} empty="Henüz tamamlanan iş yok." />
          </Panel>
        </div>
      </div>
    </div>
  );
}
