import React, { useState } from 'react';
import { TbShieldCheck } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { usePermissions } from '../../hooks/usePermissions';
import ApprovalPanel from '../issue/ApprovalPanel';
import EmptyState from '../common/EmptyState';
import IssueModal from '../issue/IssueModal';
import RequestDetailModal from '../request/RequestDetailModal';

/**
 * "Onay Bekleyenler" tab of a müdürlük: every completion submitted by staff
 * without issue.approve, oldest first, each approvable/rejectable in place.
 */
export default function ApprovalsList({ projectId }) {
  const { state } = useAppContext();
  const { can } = usePermissions();
  const [openIssueId, setOpenIssueId] = useState(null);
  const [openRequestId, setOpenRequestId] = useState(null);

  const pending = state.issues
    .filter((i) => i.projectId === projectId && i.status === 'Onay Bekliyor' && i.pendingCompletion)
    .sort((a, b) => new Date(a.pendingCompletion.submittedAt) - new Date(b.pendingCompletion.submittedAt));

  if (!can('issue.approve')) {
    return <EmptyState title="Yetkiniz yok" description="Tamamlanan işleri yalnızca onay yetkisi olan yöneticiler görebilir." />;
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <TbShieldCheck size={20} style={{ color: '#8B5CF6' }} />
        <h6 className="fw-semibold mb-0">Onay Bekleyen Tamamlanmış İşler</h6>
        <span className="badge rounded-pill" style={{ backgroundColor: '#8B5CF6' }}>{pending.length}</span>
      </div>
      <p className="text-muted small">
        Çalışanların tamamladığı işler onayınızdan sonra kapanır. Onayladığınızda çözüm notu işlenir ve varsa malzeme
        stoktan düşülür; reddettiğinizde iş gerekçenizle birlikte <strong>Devam Ediyor</strong> durumuna döner.
      </p>

      {pending.length === 0 ? (
        <EmptyState
          icon={<TbShieldCheck size={48} />}
          title="Onay bekleyen talep yok"
          description="Çalışanlar bir işi tamamladığında burada listelenir."
        />
      ) : (
        pending.map((issue) => (
          <ApprovalPanel
            key={issue.id}
            issue={issue}
            header
            onOpen={(i) => (i.isRequest ? setOpenRequestId(i.id) : setOpenIssueId(i.id))}
          />
        ))
      )}

      <IssueModal isOpen={Boolean(openIssueId)} onClose={() => setOpenIssueId(null)} issueId={openIssueId} />
      <RequestDetailModal isOpen={Boolean(openRequestId)} onClose={() => setOpenRequestId(null)} requestId={openRequestId} />
    </div>
  );
}
