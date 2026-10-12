import React, { useState, useEffect } from 'react';
import {
  TbCalendar,
  TbClock,
  TbFlag,
  TbTag,
  TbCircleCheck,
  TbEdit,
  TbCheck,
  TbX,
  TbUserPlus,
  TbTrash,
  TbCopy,
  TbArrowForwardUp,
  TbBan,
  TbPhone,
  TbPaperclip,
  TbBuildingSkyscraper,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { ACTIONS, MANUAL_STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS } from '../../constants';
import { issuesApi, commentsApi, activitiesApi, filesApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';
import { formatDate, timeAgo, formatTimeSpent } from '../../utils/dateUtils';
import { formatAnswer, formatBytes } from '../../utils/requestForm';
import { requestDurations, formatDuration } from '../../utils/durationUtils';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import SlaBadge from '../common/SlaBadge';
import StarRating from '../common/StarRating';
import CommentSection from '../issue/CommentSection';
import ActivityFeed from '../issue/ActivityFeed';
import ConfirmDialog from '../common/ConfirmDialog';
import TaskDoneModal from '../common/TaskDoneModal';
import ApprovalPanel from '../issue/ApprovalPanel';

/**
 * Full Jira-style request detail content.
 * Rendered inside RequestDetailModal.
 */
function RequestDetailContent({ request, onClose, onCloneSuccess }) {
  const { state, dispatch } = useAppContext();

  // ── Edit mode state ───────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editProjectId, setEditProjectId] = useState('');

  // ── Inline field edit state ───────────────────────────────────────────────
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [editingTimeSpent, setEditingTimeSpent] = useState(false);
  const [editingResolvedAt, setEditingResolvedAt] = useState(false);
  const [timeSpentInput, setTimeSpentInput] = useState('');
  const [resolvedAtInput, setResolvedAtInput] = useState('');
  const [timeSpentError, setTimeSpentError] = useState('');
  const [activeTab, setActiveTab] = useState('comments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTargetId, setForwardTargetId] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState({ users: [], teams: [] });

  // ── Derived data ──────────────────────────────────────────────────────────
  const assignee = state.users.find((u) => u.id === request.assigneeId);
  const reporter = state.users.find((u) => u.id === request.reporterId);

  // Current project (may change during edit)
  const currentProjectId = editMode ? editProjectId : request.projectId;
  const project = state.projects.find((p) => p.id === currentProjectId) ||
                  state.projects.find((p) => p.id === request.projectId);
  const unit = state.units?.find((u) => u.unitCode === request.unitCode);

  // Ne yapılabileceğine backend karar verir (allowedActions); web ve mobil aynı
  // bayrakları kullanır, kurallar istemcide tekrar yazılmaz.
  const actions = request.allowedActions || {};
  const canAssign = !!actions.assign;
  const canEdit = !!actions.edit;
  const canDelete = !!actions.delete;
  const canEditDates = !!actions.editDates;
  const canChangeStatus = !!actions.changeStatus;

  // Projects available for reassignment (same unit as the request)
  const unitProjects = state.projects.filter((p) => {
    if (!unit) return false;
    const projectUnit = state.units?.find((u) => u.id === p.unitId);
    return projectUnit?.unitCode === request.unitCode;
  });

  // Atanabilecek kişi ve ekipler backend'den gelir (aynı kuralla atama doğrulanır).
  useEffect(() => {
    let cancelled = false;
    issuesApi.assignees(request.id)
      .then((opts) => { if (!cancelled) setAssigneeOptions(opts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [request.id, request.projectId]);
  const assignableUsers = assigneeOptions.users;
  const teams = assigneeOptions.teams;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);

  async function refreshRequest() {
    const [fresh, activities] = await Promise.all([
      issuesApi.get(request.id),
      activitiesApi.listByIssue(request.id),
    ]);
    dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(fresh, unitCodeByProjectId) });
    dispatch({ type: ACTIONS.SET_ACTIVITIES_FOR_ISSUE, payload: { issueId: request.id, activities } });
  }

  // ── Enter edit mode ───────────────────────────────────────────────────────
  function handleStartEdit() {
    setEditTitle(request.title);
    setEditDescription(request.description || '');
    setEditPriority(request.priority);
    setEditProjectId(request.projectId);
    setEditMode(true);
  }

  function handleCancelEdit() {
    setEditMode(false);
  }

  // ── Save full edit ────────────────────────────────────────────────────────
  async function handleSaveEdit() {
    if (!editTitle.trim()) return;
    try {
      await issuesApi.update(request.id, {
        title: editTitle.trim(),
        description: editDescription,
        priority: editPriority,
        projectId: editProjectId,
      });
      await refreshRequest();
      setEditMode(false);
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Status change ─────────────────────────────────────────────────────────
  async function handleStatusChange(newStatus) {
    if (newStatus === request.status) { setEditingStatus(false); return; }
    if (newStatus === 'Done') {
      setShowDoneModal(true);
      setEditingStatus(false);
      return;
    }
    try {
      await issuesApi.updateStatus(request.id, newStatus);
      await refreshRequest();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setEditingStatus(false);
    }
  }

  // ── Assignee change ───────────────────────────────────────────────────────
  // value is either "" (unassign), "u:<userId>" or "t:<teamId>"
  async function handleAssigneeChange(value) {
    if (!canAssign) return;
    try {
      if (value.startsWith('t:')) {
        await issuesApi.assignTeam(request.id, value.slice(2));
      } else {
        await issuesApi.updateAssignee(request.id, value.startsWith('u:') ? value.slice(2) : null);
      }
      await refreshRequest();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setEditingAssignee(false);
    }
  }

  // ── Time spent ────────────────────────────────────────────────────────────
  async function handleTimeSpentSave() {
    const val = parseInt(timeSpentInput, 10);
    if (isNaN(val) || val < 0) { setTimeSpentError('Harcanan zaman negatif olamaz'); return; }
    setTimeSpentError('');
    try {
      await issuesApi.updateDates(request.id, request.resolvedAt || null, val);
      await refreshRequest();
      setEditingTimeSpent(false);
    } catch (err) {
      setTimeSpentError(err.message);
    }
  }

  // ── Resolved at ───────────────────────────────────────────────────────────
  async function handleResolvedAtSave() {
    const iso = resolvedAtInput ? new Date(resolvedAtInput).toISOString() : null;
    try {
      await issuesApi.updateDates(request.id, iso, request.timeSpent || 0);
      await refreshRequest();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setEditingResolvedAt(false);
    }
  }

  // ── Klonla ────────────────────────────────────────────────────────────────
  // Requirement 18: yetkili kullanıcılar (ve External_User kendi talebini)
  // "Klonla" ile aynı içerikte yeni bir talep oluşturabilir.
  const canClone = !!actions.clone;
  async function handleClone() {
    try {
      const cloned = await issuesApi.clone(request.id);
      dispatch({ type: ACTIONS.ADD_ISSUE, payload: mapIssue(cloned, unitCodeByProjectId) });
      onCloneSuccess?.(cloned.id);
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    try {
      await issuesApi.delete(request.id);
      dispatch({ type: ACTIONS.DELETE_ISSUE, payload: { issueId: request.id } });
      onClose();
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Geri çevir ────────────────────────────────────────────────────────────
  async function handleReject() {
    if (!canReject || !rejectReason.trim()) return;
    try {
      await issuesApi.updateStatus(request.id, 'Geri Çevrildi');
      await issuesApi.updateAssignee(request.id, reporter?.id || null);
      await commentsApi.create(request.id, `🚫 **Talep Geri Çevrildi**\n\n${rejectReason.trim()}`);
      await refreshRequest();
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      window.alert(err.message);
    }
  }

  const canReject = !!actions.reject;

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ── Yönlendir (Forward to another project) ───────────────────────────────
  const canForward = !!actions.forward;
  const forwardTargets = state.projects.filter((p) => p.id !== request.projectId);

  async function handleForward() {
    if (!forwardTargetId) return;
    try {
      await issuesApi.forward(request.id, forwardTargetId, forwardNote.trim());
      await refreshRequest();
      setShowForwardModal(false);
      setForwardTargetId('');
      setForwardNote('');
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── İptal Et (requester withdraws their own open request) ────────────────
  const canCancel = !!actions.cancel;
  async function handleCancel() {
    try {
      await issuesApi.cancel(request.id);
      await refreshRequest();
      setShowCancelConfirm(false);
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Puanla (requester rates a completed request once) ────────────────────
  const canRate = !!actions.rate;
  async function handleRate() {
    if (!rating) return;
    setRatingSubmitting(true);
    try {
      await issuesApi.rate(request.id, rating, ratingComment.trim());
      await refreshRequest();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setRatingSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const STEPS = ['Açıldı', 'İşlemde', 'Onayda', 'Tamamlandı'];
  const STEP_INDEX = { 'To Do': 0, 'In Progress': 1, 'Onay Bekliyor': 2, Done: 4 };
  const CLOSED_BANNERS = {
    'Geri Çevrildi': { text: 'Bu talep geri çevrildi. Nedeni yorumlarda yer alıyor.', bg: 'var(--danger-soft)', fg: 'var(--danger)' },
    'İptal Edildi': { text: 'Talep sahibi bu talebi iptal etti.', bg: '#f1f5f9', fg: '#475569' },
    Yönlendirildi: { text: 'Bu talep başka bir müdürlüğe yönlendirildi.', bg: 'var(--violet-soft)', fg: 'var(--violet)' },
  };
  const stepIndex = STEP_INDEX[request.status];
  const closedBanner = CLOSED_BANNERS[request.status];
  const durations = requestDurations(request);
  const hasAnswers = request.requestAnswers?.length > 0;
  const statusTargets = MANUAL_STATUSES.filter((s) => s !== request.status && s !== 'Geri Çevrildi');
  const hasToolbar = editMode || (canChangeStatus && statusTargets.length > 0) || canEdit || canAssign
    || canClone || canForward || canCancel || canReject || canDelete;

  const editableProps = (enabled, onActivate, title) => (enabled ? {
    className: 'rd-editable',
    role: 'button',
    tabIndex: 0,
    title,
    onClick: onActivate,
    onKeyDown: (e) => e.key === 'Enter' && onActivate(),
  } : {});

  return (
    <div>
      {/* ── Başlık alanı ── */}
      <div className="rd-head mb-3">
        <div className="rd-crumbs">
          <span className="rd-key">{request.number}</span>
          {unit && <span>{unit.name}</span>}
          {unit && project && <span>/</span>}
          {project && <span className="fw-semibold" style={{ color: 'var(--ink)' }}>{project.name}</span>}
          <span className="ms-auto"><SlaBadge request={request} /></span>
        </div>

        {editMode ? (
          <input
            className="form-control fw-semibold fs-5 my-2"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Talep başlığı"
            autoFocus
          />
        ) : (
          <h4 className="rd-title">{request.title}</h4>
        )}

        <div className="rd-meta">
          <Badge label={request.status} type="status" />
          <PriorityIcon priority={request.priority} showLabel size={13} />
          {request.requestFormName && (
            <span className="ds-pill" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
              <TbTag size={12} /> {request.requestFormName}
            </span>
          )}
          {reporter && (
            <span className="d-inline-flex align-items-center gap-1">
              <Avatar name={reporter.name} color={reporter.avatarColor} size={18} />
              <strong className="fw-semibold" style={{ color: 'var(--ink)' }}>{reporter.name}</strong> açtı
            </span>
          )}
          <span title={formatDate(request.createdAt)}><TbCalendar size={13} /> {timeAgo(request.createdAt)}</span>
        </div>

        {stepIndex !== undefined ? (
          <div className="rd-steps" aria-label="Talep aşaması">
            {STEPS.map((label, i) => {
              const state_ = i < stepIndex || stepIndex === 4 ? 'done' : i === stepIndex ? 'current' : '';
              return (
                <div key={label} className={`rd-step ${state_ ? `rd-step--${state_}` : ''}`}>
                  <div className="rd-step__dot">{state_ === 'done' ? <TbCheck size={14} /> : i + 1}</div>
                  <div className="rd-step__label">{label}</div>
                </div>
              );
            })}
          </div>
        ) : closedBanner && (
          <div className="rd-banner" style={{ background: closedBanner.bg, color: closedBanner.fg }}>
            <TbBan size={18} /> {closedBanner.text}
          </div>
        )}
      </div>

      {/* ── İşlem çubuğu ── */}
      {hasToolbar && (
        <div className="rd-toolbar mb-3">
          {!editMode && canChangeStatus && statusTargets.length > 0 && (
            <>
              <span className="rd-toolbar__label">Durum</span>
              {editingStatus ? (
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  defaultValue={request.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  onBlur={() => setEditingStatus(false)}
                  autoFocus
                >
                  {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              ) : (
                statusTargets.map((s) => (
                  <button key={s} className={`btn btn-sm ${s === 'Done' ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => handleStatusChange(s)}>
                    {s === 'Done' && <TbCircleCheck size={14} className="me-1" />}
                    {STATUS_LABELS[s]}
                  </button>
                ))
              )}
            </>
          )}

          <div className="ms-auto d-flex flex-wrap gap-2">
            {editMode ? (
              <>
                <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={handleSaveEdit} disabled={!editTitle.trim()}>
                  <TbCheck size={14} /> Kaydet
                </button>
                <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={handleCancelEdit}>
                  <TbX size={14} /> Vazgeç
                </button>
              </>
            ) : (
              <>
                {canAssign && (
                  <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={() => setEditingAssignee(true)}>
                    <TbUserPlus size={14} /> Ata
                  </button>
                )}
                {canEdit && (
                  <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" onClick={handleStartEdit}>
                    <TbEdit size={14} /> Düzenle
                  </button>
                )}
                {canForward && (
                  <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => setShowForwardModal(true)}
                    title="Talebi başka bir müdürlüğe yönlendir">
                    <TbArrowForwardUp size={14} /> Yönlendir
                  </button>
                )}
                {canClone && (
                  <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={handleClone} title="Aynı içerikle yeni talep aç">
                    <TbCopy size={14} /> Klonla
                  </button>
                )}
                {(canReject || canCancel || canDelete) && <span className="rd-toolbar__sep" />}
                {canReject && (
                  <button className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1" onClick={() => setShowRejectModal(true)}>
                    <TbX size={14} /> Geri Çevir
                  </button>
                )}
                {canCancel && (
                  <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => setShowCancelConfirm(true)}>
                    <TbBan size={14} /> İptal Et
                  </button>
                )}
                {canDelete && (
                  <button className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1" onClick={() => setShowDeleteConfirm(true)} title="Talebi sil">
                    <TbTrash size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Onay bekleyen tamamlama — yönetici onaylar/reddeder */}
      <ApprovalPanel issue={request} />

      <div className="row g-3">
        {/* ── Ana sütun ── */}
        <div className="col-12 col-lg-8">
          {hasAnswers && (
            <div className="mb-4">
              <h6 className="rd-section-title">Talep Bilgileri</h6>
              <div className="rd-answers">
                {request.requestAnswers.map((a) => (
                  <div key={a.questionId} className={`rd-answer ${a.type === 'textarea' || a.type === 'file' ? 'rd-answer--wide' : ''}`}>
                    <div className="rd-answer__q">{a.label}</div>
                    <div className="rd-answer__a">
                      {a.type === 'file' ? (
                        <div className="d-flex flex-wrap gap-2">
                          {(a.value || []).map((file) => (
                            <button key={file.id} type="button"
                              className="btn btn-sm btn-light border d-flex align-items-center gap-1"
                              title="İndir"
                              onClick={() => filesApi.download(file.id, file.name).catch((err) => alert(err.message || 'Dosya indirilemedi'))}>
                              <TbPaperclip size={14} /> {file.name}
                              <span className="text-muted">({formatBytes(file.size)})</span>
                            </button>
                          ))}
                        </div>
                      ) : (formatAnswer(a) || <span className="text-muted">—</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(editMode || request.description || !hasAnswers) && (
            <div className="mb-4">
              <h6 className="rd-section-title">Açıklama</h6>
              {editMode ? (
                <textarea
                  className="form-control"
                  rows={5}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Talep açıklaması..."
                />
              ) : request.description ? (
                <div className="rd-answer" style={{ background: '#fff' }}>
                  <div className="rd-answer__a" style={{ fontWeight: 400 }}>{request.description}</div>
                </div>
              ) : (
                <p className="text-muted fst-italic mb-0" style={{ fontSize: '0.875rem' }}>Açıklama eklenmemiş.</p>
              )}
            </div>
          )}

          {/* Süreler: bekleme (açılış → işleme alınma), çözüm (işleme alınma → çözülme), toplam */}
          <div className="mb-4">
            <h6 className="rd-section-title">Süreler</h6>
            <div className="rd-durations">
              {[
                { label: 'Bekleme', part: durations.waiting, hint: 'Açılıştan işleme alınana kadar', color: 'var(--warn)' },
                { label: 'Çözüm', part: durations.resolution, hint: 'İşleme alınmadan çözülene kadar', color: 'var(--orange)' },
                { label: 'Toplam', part: durations.total, hint: 'Açılıştan çözülene kadar', color: 'var(--ok)' },
              ].map(({ label, part, hint, color }) => (
                <div key={label} className="rd-duration" title={hint} style={{ borderLeft: `3px solid ${color}` }}>
                  <div className="rd-duration__label">{label}</div>
                  <div className="rd-duration__value" style={{ color }}>{formatDuration(part?.ms ?? null)}</div>
                  <div className="rd-duration__hint">{!part ? 'Kayıt yok' : part.ongoing ? 'Devam ediyor' : hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Aktivite */}
          <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h6 className="rd-section-title mb-0">Aktivite</h6>
              <div className="rd-tabs" role="tablist">
                {[['comments', 'Yorumlar'], ['history', 'Geçmiş'], ['all', 'Tümü']].map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={activeTab === key}
                    className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {(activeTab === 'comments' || activeTab === 'all') && (
              <div className="mb-3"><CommentSection issueId={request.id} /></div>
            )}
            {(activeTab === 'history' || activeTab === 'all') && (
              <ActivityFeed issueId={request.id} />
            )}
          </div>
        </div>

        {/* ── Sağ panel ── */}
        <div className="col-12 col-lg-4">
          <div className="rd-side-card">
            <h6 className="rd-section-title">Kişiler</h6>

            <div className="rd-person">
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="rd-person__role">Atanan</div>
                {canAssign && editingAssignee ? (
                  <select
                    className="form-select form-select-sm mt-1"
                    defaultValue={request.assigneeTeamId ? `t:${request.assigneeTeamId}` : request.assigneeId ? `u:${request.assigneeId}` : ''}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                    onBlur={() => setEditingAssignee(false)}
                    autoFocus
                  >
                    <option value="">— Atanmamış —</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={`u:${u.id}`}>{u.name}</option>
                    ))}
                    {teams.length > 0 && (
                      <optgroup label="Ekipler">
                        {teams.map((t) => (
                          <option key={t.id} value={`t:${t.id}`}>{t.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                ) : (
                  <div className="d-flex align-items-center gap-2 mt-1"
                    {...editableProps(canAssign, () => setEditingAssignee(true), 'Atanan kişiyi değiştir')}>
                    {assignee ? (
                      <>
                        <Avatar name={assignee.name} color={assignee.avatarColor} size={28} />
                        <span className="fw-semibold">{assignee.name}</span>
                      </>
                    ) : request.assigneeTeamId ? (
                      <>
                        <span className="ds-kpi__icon" style={{ background: 'var(--navy-soft)', color: 'var(--navy)', width: 28, height: 28 }}>
                          <TbUserPlus size={15} />
                        </span>
                        <span className="fw-semibold">{teams.find((t) => t.id === request.assigneeTeamId)?.name || 'Ekip'}</span>
                        <span className="ds-pill" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>Ekip</span>
                      </>
                    ) : (
                      <span className="ds-pill" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>Atanmamış</span>
                    )}
                    {canAssign && <span className="ms-auto text-primary" style={{ fontSize: '0.75rem' }}>Değiştir</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="rd-person">
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="rd-person__role">Talep sahibi</div>
                <div className="d-flex align-items-center gap-2 mt-1">
                  {reporter ? (
                    <>
                      <Avatar name={reporter.name} color={reporter.avatarColor} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold text-truncate">{reporter.name}</div>
                        <div className="text-muted text-truncate" style={{ fontSize: '0.74rem' }}>{reporter.email}</div>
                      </div>
                    </>
                  ) : <span className="text-muted">—</span>}
                </div>
              </div>
            </div>

            {/* Yardım masası: bu talep, başka biri adına telefonla/yüz yüze açıldıysa */}
            {request.contactName && (
              <div className="rd-person">
                <div className="flex-grow-1">
                  <div className="rd-person__role d-flex align-items-center gap-1"><TbPhone size={12} /> Adına açılan kişi</div>
                  <div className="fw-semibold mt-1">{request.contactName}</div>
                  {request.contactPhone && <div className="text-muted" style={{ fontSize: '0.78rem' }}>{request.contactPhone}</div>}
                </div>
              </div>
            )}
          </div>

          <div className="rd-side-card">
            <h6 className="rd-section-title">Detaylar</h6>
            <div className="rd-field">
              <span className="rd-field__label"><TbFlag size={14} /> Öncelik</span>
              <span className="rd-field__value">
                {editMode ? (
                  <select className="form-select form-select-sm" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                ) : <PriorityIcon priority={request.priority} showLabel size={13} />}
              </span>
            </div>
            <div className="rd-field">
              <span className="rd-field__label"><TbBuildingSkyscraper size={14} /> Müdürlük</span>
              <span className="rd-field__value text-truncate">
                {editMode ? (
                  <select className="form-select form-select-sm" value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)}>
                    {unitProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ) : (project?.name || '—')}
              </span>
            </div>
            <div className="rd-field">
              <span className="rd-field__label"><TbCalendar size={14} /> Çözülüş</span>
              <span className="rd-field__value">
                {canEditDates && !editMode && editingResolvedAt ? (
                  <span className="d-flex gap-1 justify-content-end">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      style={{ width: 'auto' }}
                      defaultValue={request.resolvedAt ? request.resolvedAt.substring(0, 10) : ''}
                      onChange={(e) => setResolvedAtInput(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleResolvedAtSave}><TbCheck size={14} /></button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingResolvedAt(false)}><TbX size={14} /></button>
                  </span>
                ) : (
                  <span {...editableProps(canEditDates && !editMode, () => {
                    setResolvedAtInput(request.resolvedAt ? request.resolvedAt.substring(0, 10) : '');
                    setEditingResolvedAt(true);
                  }, 'Çözülüş tarihini düzenle')}>
                    {request.resolvedAt ? formatDate(request.resolvedAt) : <span className="text-muted fw-normal">—</span>}
                  </span>
                )}
              </span>
            </div>
            <div className="rd-field">
              <span className="rd-field__label"><TbClock size={14} /> Harcanan zaman</span>
              <span className="rd-field__value">
                {canEditDates && !editMode && editingTimeSpent ? (
                  <span className="d-block">
                    <span className="d-flex gap-1 justify-content-end">
                      <input
                        type="number"
                        className={`form-control form-control-sm ${timeSpentError ? 'is-invalid' : ''}`}
                        placeholder="Dakika"
                        style={{ width: 90 }}
                        defaultValue={request.timeSpent || ''}
                        onChange={(e) => { setTimeSpentInput(e.target.value); setTimeSpentError(''); }}
                        min={0}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-primary" onClick={handleTimeSpentSave}><TbCheck size={14} /></button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => { setEditingTimeSpent(false); setTimeSpentError(''); }}><TbX size={14} /></button>
                    </span>
                    {timeSpentError && <span className="invalid-feedback d-block mt-1">{timeSpentError}</span>}
                  </span>
                ) : (
                  <span {...editableProps(canEditDates && !editMode, () => {
                    setTimeSpentInput(String(request.timeSpent || ''));
                    setEditingTimeSpent(true);
                  }, 'Harcanan zamanı düzenle')}>
                    {formatTimeSpent(request.timeSpent)}
                  </span>
                )}
              </span>
            </div>
            <div className="rd-field">
              <span className="rd-field__label">Oluşturulma</span>
              <span className="rd-field__value" title={formatDate(request.createdAt)}>{timeAgo(request.createdAt) || '—'}</span>
            </div>
            <div className="rd-field">
              <span className="rd-field__label">Son güncelleme</span>
              <span className="rd-field__value" title={formatDate(request.updatedAt)}>
                {timeAgo(request.updatedAt) || timeAgo(request.createdAt) || '—'}
              </span>
            </div>
          </div>

          {/* Puanlama */}
          {(canRate || request.ratedAt) && (
            <div className="rd-side-card" style={canRate ? { borderColor: 'var(--orange)', background: 'var(--orange-soft)' } : undefined}>
              <h6 className="rd-section-title">Çözüm değerlendirmesi</h6>
              {request.ratedAt ? (
                <>
                  <StarRating value={request.rating} size={18} />
                  {request.ratingComment && <p className="text-muted small mt-2 mb-0 fst-italic">"{request.ratingComment}"</p>}
                </>
              ) : (
                <>
                  <p className="small mb-2">Talebiniz çözüldü. Hizmeti puanlar mısınız?</p>
                  <StarRating value={rating} onRate={setRating} size={22} />
                  <textarea
                    className="form-control form-control-sm mt-2"
                    rows={2}
                    placeholder="İsteğe bağlı yorum..."
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                  />
                  <button className="btn btn-sm btn-primary mt-2" disabled={!rating || ratingSubmitting} onClick={handleRate}>
                    {ratingSubmitting ? 'Gönderiliyor…' : 'Puanı Gönder'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Talebi Sil"
        message={`"${request.title}" talebini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
      />

      {/* Geri Çevir Modalı */}
      {showRejectModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
        >
          <div className="bg-white rounded-3 shadow-lg p-4" style={{ width: '100%', maxWidth: 500 }}>
            <h6 className="fw-semibold mb-3">Talebi Geri Çevir</h6>
            <p className="text-muted small mb-3">
              Bu talep <strong>{reporter?.name || 'açan kişiye'}</strong> geri gönderilecek ve durumu <strong>"Geri Çevrildi"</strong> olarak ayarlanacak.
            </p>
            <div className="mb-4">
              <label className="form-label small fw-semibold">
                Geri Çevirme Nedeni <span className="text-danger">*</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Geri çevirme nedenini açıklayın..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                İptal
              </button>
              <button
                className="btn btn-warning btn-sm"
                onClick={handleReject}
                disabled={!rejectReason.trim()}
              >
                Geri Çevir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Done Modal */}
      <TaskDoneModal
        isOpen={showDoneModal}
        issue={request}
        onConfirm={() => setShowDoneModal(false)}
        onCancel={() => setShowDoneModal(false)}
      />

      {/* Yönlendir Modalı */}
      {showForwardModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
        >
          <div className="bg-white rounded-3 shadow-lg p-4" style={{ width: '100%', maxWidth: 500 }}>
            <h6 className="fw-semibold mb-3">Talebi Yönlendir</h6>
            <p className="text-muted small mb-3">Talep seçtiğiniz müdürlüğe taşınır, ataması kaldırılır ve durumu "Yönlendirildi" olur.</p>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Hedef Müdürlük <span className="text-danger">*</span></label>
              <select className="form-select" value={forwardTargetId} onChange={(e) => setForwardTargetId(e.target.value)} autoFocus>
                <option value="">— Müdürlük seçin —</option>
                {forwardTargets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Not (isteğe bağlı)</label>
              <textarea className="form-control" rows={2} value={forwardNote} onChange={(e) => setForwardNote(e.target.value)} />
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => { setShowForwardModal(false); setForwardTargetId(''); setForwardNote(''); }}>İptal</button>
              <button className="btn btn-primary btn-sm" onClick={handleForward} disabled={!forwardTargetId}>Yönlendir</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        title="Talebi İptal Et"
        message="Bu talebi iptal etmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        confirmText="İptal Et"
      />
    </div>
  );
}

export default RequestDetailContent;
