import React, { useState } from 'react';
import { TbShieldCheck, TbCheck, TbX, TbAlertCircle, TbPackage } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ACTIONS } from '../../constants';
import { issuesApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';
import { formatDate, timeAgo } from '../../utils/dateUtils';
import Avatar from '../common/Avatar';

/**
 * A completion waiting for manager approval ("Onay Bekliyor"): who finished
 * it, when, the resolution note and inventory use. Users with issue.approve
 * can approve (→ Done) or reject with a reason (→ In Progress); everyone else
 * just sees that it is waiting. Renders nothing for other statuses.
 *
 * `header` adds the issue number/title row (used in the approvals list).
 */
export default function ApprovalPanel({ issue, header = false, onOpen }) {
  const { state, dispatch } = useAppContext();
  const { can } = usePermissions();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const pc = issue?.pendingCompletion;
  if (!issue || issue.status !== 'Onay Bekliyor' || !pc) return null;

  const canDecide = can('issue.approve');
  const submitter = state.users.find((u) => u.id === pc.submittedBy);
  const item = pc.equipmentId && (state.inventory || []).find((i) => i.id === pc.equipmentId);

  function store(updated) {
    const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);
    dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(updated, unitCodeByProjectId) });
  }

  async function approve() {
    setBusy(true);
    setError('');
    try {
      const { issue: updated, stockWarning } = await issuesApi.approveCompletion(issue.id);
      if (stockWarning) setNotice('Onaylandı. Not: kullanılan malzeme stokta yetersizdi, stok eksiye düştü.');
      store(updated);
    } catch (err) {
      setError(err.message || 'Onaylanamadı');
    } finally {
      setBusy(false);
    }
  }

  async function reject(e) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setReasonError('Ret gerekçesi boş bırakılamaz (en az 5 karakter).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      store(await issuesApi.rejectCompletion(issue.id, reason.trim()));
    } catch (err) {
      setError(err.message || 'Reddedilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card border-0 shadow-sm mb-3" style={{ borderLeft: '4px solid #8B5CF6', background: '#FAF7FF' }}>
      <div className="card-body py-3">
        {header && (
          <button type="button" className="btn btn-link p-0 text-start text-decoration-none mb-2 d-block"
            onClick={() => onOpen?.(issue)}>
            <span className="text-muted small me-2">{issue.number}</span>
            <span className="fw-semibold text-body">{issue.title}</span>
            {issue.isRequest && <span className="badge ms-2" style={{ backgroundColor: '#6f42c1', color: '#fff', fontSize: '0.65rem' }}>Talep</span>}
          </button>
        )}

        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <TbShieldCheck size={18} style={{ color: '#8B5CF6' }} />
          <span className="fw-semibold small">Yönetici onayı bekleniyor</span>
          <span className="text-muted small">·</span>
          {submitter && <Avatar name={submitter.name} color={submitter.avatarColor} size={20} />}
          <span className="small">{submitter?.name || 'Bilinmeyen kullanıcı'}</span>
          <span className="text-muted small" title={formatDate(pc.submittedAt)}>{timeAgo(pc.submittedAt)} tamamladı</span>
        </div>

        <div className="small fw-semibold text-dark mb-1">Çözüm İçeriği</div>
        <p className="small mb-2 p-2 rounded bg-white border" style={{ whiteSpace: 'pre-wrap' }}>{pc.resolutionNote}</p>

        {pc.equipmentId && (
          <div className="small text-muted mb-2 d-flex align-items-center gap-1">
            <TbPackage size={14} /> Envanter: {item?.name || 'malzeme'} — {pc.quantity} adet (onaylanınca stoktan düşülecek)
          </div>
        )}

        {error && <div className="alert alert-danger py-1 px-2 small mb-2">{error}</div>}
        {notice && <div className="alert alert-warning py-1 px-2 small mb-2">{notice}</div>}

        {canDecide && !rejecting && (
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-success btn-sm d-flex align-items-center gap-1" onClick={approve} disabled={busy}>
              <TbCheck size={15} /> {busy ? 'İşleniyor…' : 'Onayla ve Kapat'}
            </button>
            <button type="button" className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
              onClick={() => { setRejecting(true); setReason(''); setReasonError(''); }} disabled={busy}>
              <TbX size={15} /> Reddet
            </button>
          </div>
        )}

        {canDecide && rejecting && (
          <form onSubmit={reject} noValidate>
            <label className="form-label fw-semibold small mb-1" htmlFor={`reject-${issue.id}`}>
              Ret gerekçesi <span className="text-danger">*</span>
            </label>
            <textarea
              id={`reject-${issue.id}`}
              className={`form-control form-control-sm ${reasonError ? 'is-invalid' : ''}`}
              rows={2}
              autoFocus
              placeholder="Çalışana neyin eksik olduğunu açıklayın; iş Devam Ediyor durumuna döner."
              value={reason}
              aria-invalid={!!reasonError}
              onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
            />
            {reasonError && (
              <div className="invalid-feedback d-flex align-items-center gap-1">
                <TbAlertCircle size={14} /> {reasonError}
              </div>
            )}
            <div className="d-flex gap-2 mt-2">
              <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
                {busy ? 'Gönderiliyor…' : 'Reddet ve Geri Gönder'}
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRejecting(false)} disabled={busy}>
                Vazgeç
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
