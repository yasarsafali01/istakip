import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TbPlus, TbInbox, TbProgress, TbCircleCheck, TbStar, TbList, TbMapPin, TbHistory, TbChevronRight,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { STATUS_COLORS, STATUS_LABELS } from '../../constants';
import { getVisibleRequests } from '../../utils/permissionUtils';
import { timeAgo } from '../../utils/dateUtils';
import Modal from '../common/Modal';
import RequestForm from '../request/RequestForm';
import RequestDetailModal from '../request/RequestDetailModal';
import { Hero, Kpi, Panel, SlaPill, OPEN_STATUSES } from './DashboardKit';

const STEPS = ['Alındı', 'İşlemde', 'Onayda', 'Tamamlandı'];
const STEP_INDEX = { 'To Do': 0, 'In Progress': 1, 'Onay Bekliyor': 2, Done: 4 };

/** Where a request stands, as four small segments (filled = passed, orange = now). */
function MiniSteps({ status }) {
  const at = STEP_INDEX[status];
  if (at === undefined) return null;
  return (
    <div className="d-flex gap-1 mt-2" aria-label={`Aşama: ${STATUS_LABELS[status]}`}>
      {STEPS.map((label, i) => {
        const done = i < at || at === 4;
        const current = i === at;
        return (
          <div key={label} className="flex-grow-1" title={label}>
            <div style={{
              height: 5, borderRadius: 999,
              background: done ? 'var(--navy)' : current ? 'var(--orange)' : '#e2e8f0',
            }} />
            <div style={{ fontSize: '0.64rem', marginTop: 3, color: current ? 'var(--orange)' : done ? 'var(--navy)' : '#94a3b8', fontWeight: 600 }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A request as its owner sees it: what it is, where it went and how far along it is. */
function TrackRow({ request, projectName, onOpen }) {
  return (
    <div className="ds-row align-items-start" role="button" tabIndex={0} onClick={() => onOpen(request.id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(request.id)}>
      <span className="ds-row__bar" style={{ background: STATUS_COLORS[request.status] || '#cbd5e1' }} />
      <div className="ds-row__main">
        <div className="d-flex align-items-center gap-2">
          <span className="kb-card__key">{request.number}</span>
          <span className="ds-row__title">{request.title}</span>
        </div>
        <div className="ds-row__meta mt-1">
          <TbMapPin size={12} /> {projectName || '—'} · {timeAgo(request.createdAt)} açıldı
        </div>
        <MiniSteps status={request.status} />
      </div>
      <div className="ds-row__side">
        <span className="ds-pill" style={{ background: '#f1f5f9', color: 'var(--ink)' }}>
          <span className="ds-dot" style={{ background: STATUS_COLORS[request.status] }} /> {STATUS_LABELS[request.status]}
        </span>
        <SlaPill issue={request} />
        <TbChevronRight size={16} className="text-muted" />
      </div>
    </div>
  );
}

/**
 * Ana sayfa for requesters (Üniversite Personeli / Öğrenci): open a request in
 * one click, follow where each one stands, and rate the solved ones.
 */
export default function RequesterHome({ currentUser }) {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState(null);

  const mine = useMemo(
    () => getVisibleRequests(state.issues, currentUser)
      .filter((r) => r.reporterId === currentUser.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [state.issues, currentUser]
  );
  const projectsById = Object.fromEntries(state.projects.map((p) => [p.id, p]));
  const open = mine.filter((r) => OPEN_STATUSES.includes(r.status));
  const inProgress = mine.filter((r) => r.status === 'In Progress');
  const done = mine.filter((r) => r.status === 'Done');
  const toRate = done.filter((r) => r.allowedActions?.rate);
  const closed = mine.filter((r) => !OPEN_STATUSES.includes(r.status))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const roleName = state.roles.find((r) => r.key === currentUser.roleKey)?.name || 'Talep Sahibi';

  return (
    <div>
      <Hero
        name={currentUser.name}
        eyebrow={roleName}
        sub="Bir birimden destek mi gerekiyor? Talebinizi açın, nerede olduğunu buradan takip edin."
        chips={[
          { label: `${open.length} açık talep`, icon: <TbInbox size={14} /> },
          ...(toRate.length ? [{ label: `${toRate.length} talep puanınızı bekliyor`, icon: <TbStar size={14} /> }] : []),
        ]}
        actions={(
          <>
            <button className="btn btn-light d-flex align-items-center gap-1" onClick={() => setShowCreate(true)}>
              <TbPlus size={18} /> Yeni Talep Oluştur
            </button>
            <button className="btn btn-outline-light d-flex align-items-center gap-1" onClick={() => navigate('/requests')}>
              <TbList size={17} /> Tüm taleplerim
            </button>
          </>
        )}
      />

      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3"><Kpi label="Açık talep" value={open.length} icon={<TbInbox size={17} />} tone="navy" sub="Sonuçlanmayı bekliyor" /></div>
        <div className="col-6 col-lg-3"><Kpi label="İşlemde" value={inProgress.length} icon={<TbProgress size={17} />} tone="orange" sub="Üzerinde çalışılıyor" /></div>
        <div className="col-6 col-lg-3"><Kpi label="Tamamlanan" value={done.length} icon={<TbCircleCheck size={17} />} tone="ok" sub={`Toplam ${mine.length} talepten`} /></div>
        <div className="col-6 col-lg-3"><Kpi label="Puan bekleyen" value={toRate.length} icon={<TbStar size={17} />} tone="warn" sub="Çözülen talebi değerlendirin" /></div>
      </div>

      {toRate.length > 0 && (
        <div className="mb-3" style={{ border: '1px solid var(--orange)', borderRadius: 14, background: 'var(--orange-soft)' }}>
          <div className="ds-panel__head">
            <h6 className="ds-panel__title"><TbStar size={17} style={{ color: 'var(--orange)' }} /> Puanlamanızı bekleyenler <span className="ds-count">{toRate.length}</span></h6>
            <span className="ds-panel__hint">Açıp 1–5 yıldız verin</span>
          </div>
          <div className="ds-panel__body">
            {toRate.slice(0, 4).map((r) => (
              <TrackRow key={r.id} request={r} projectName={projectsById[r.projectId]?.name} onOpen={setOpenId} />
            ))}
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <Panel title="Açık taleplerim" icon={<TbInbox size={17} className="text-primary" />} count={open.length} hint="Talebinize tıklayıp detayını görün">
            {open.length === 0 ? (
              <div className="ds-panel__empty">
                Açık talebiniz yok.
                <div className="mt-2">
                  <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}><TbPlus size={14} /> Yeni talep oluştur</button>
                </div>
              </div>
            ) : open.map((r) => (
              <TrackRow key={r.id} request={r} projectName={projectsById[r.projectId]?.name} onOpen={setOpenId} />
            ))}
          </Panel>
        </div>
        <div className="col-12 col-xl-5">
          <Panel title="Son sonuçlananlar" icon={<TbHistory size={17} className="text-primary" />} hint="Tamamlanan, geri çevrilen, iptal edilen">
            {closed.length === 0 ? <div className="ds-panel__empty">Henüz sonuçlanan talebiniz yok.</div> : closed.slice(0, 6).map((r) => (
              <TrackRow key={r.id} request={r} projectName={projectsById[r.projectId]?.name} onOpen={setOpenId} />
            ))}
          </Panel>
        </div>
      </div>

      <Modal isOpen={showCreate} title="Yeni Talep Oluştur" onClose={() => setShowCreate(false)} size="lg">
        {showCreate && <RequestForm onClose={() => setShowCreate(false)} />}
      </Modal>
      <RequestDetailModal isOpen={!!openId} requestId={openId} onClose={() => setOpenId(null)} onCloneSuccess={(id) => setOpenId(id)} />
    </div>
  );
}
