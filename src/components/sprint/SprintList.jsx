import React, { useState } from 'react';
import { TbPlayerPlay, TbCheck, TbPlus, TbCalendar, TbLock } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { ACTIONS } from '../../constants';
import { formatDate } from '../../utils/dateUtils';
import Modal from '../common/Modal';
import SprintForm from './SprintForm';
import EmptyState from '../common/EmptyState';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function SprintList({ projectId }) {
  const { state, dispatch } = useAppContext();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const sprints = state.sprints
    .filter(s => s.projectId === projectId)
    .sort((a, b) => {
      const aYear = a.year ?? new Date(a.startDate).getFullYear();
      const bYear = b.year ?? new Date(b.startDate).getFullYear();
      const aMonth = a.month ?? new Date(a.startDate).getMonth() + 1;
      const bMonth = b.month ?? new Date(b.startDate).getMonth() + 1;
      if (aYear !== bYear) return bYear - aYear;
      return bMonth - aMonth;
    });

  const hasActiveSprint = sprints.some(s => s.status === 'Active');

  function handleStart(sprintId) {
    if (hasActiveSprint) {
      alert('Zaten aktif bir ay var. Önce mevcut ayı kapatın.');
      return;
    }
    dispatch({ type: ACTIONS.START_SPRINT, payload: { sprintId } });
  }

  function handleComplete(sprintId) {
    if (!window.confirm('Bu ayı kapatmak istediğinizden emin misiniz? Tamamlanmamış işler backlog\'a taşınacak.')) return;
    dispatch({ type: ACTIONS.COMPLETE_SPRINT, payload: { sprintId } });
  }

  const statusBadge = {
    Planned: { bg: '#DFE1E6', color: '#42526E', label: 'Planlandı' },
    Active:  { bg: '#E3FCEF', color: '#006644', label: 'Aktif' },
    Completed: { bg: '#DEEBFF', color: '#0747A6', label: 'Kapatıldı' },
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="fw-semibold mb-0">Aylık Dönemler</h6>
        <button
          className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
          onClick={() => setShowCreateModal(true)}
        >
          <TbPlus size={14} />
          Ay Ekle
        </button>
      </div>

      {sprints.length === 0 ? (
        <EmptyState
          title="Henüz dönem yok"
          description="İlk aylık dönemi oluşturun."
          action={
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}>
              Ay Ekle
            </button>
          }
        />
      ) : (
        <ul className="list-unstyled mb-0">
          {sprints.map(sprint => {
            const badge = statusBadge[sprint.status] || statusBadge.Planned;
            const issueCount = state.issues.filter(i => i.sprintId === sprint.id).length;
            const doneCount = state.issues.filter(i => i.sprintId === sprint.id && i.status === 'Done').length;
            const sprintLabel = sprint.name ||
              (sprint.month ? `${MONTH_NAMES[sprint.month - 1]} ${sprint.year}` : sprint.id);

            return (
              <li key={sprint.id} className="card border-0 shadow-sm mb-2">
                <div className="card-body py-2 px-3 d-flex align-items-center gap-3 flex-wrap">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      {sprint.status === 'Completed' && <TbLock size={13} className="text-muted" />}
                      <span className="fw-semibold small">{sprintLabel}</span>
                      <span
                        className="badge"
                        style={{ backgroundColor: badge.bg, color: badge.color, fontSize: '0.65rem' }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="d-flex gap-3 text-muted" style={{ fontSize: '0.7rem' }}>
                      <span className="d-flex align-items-center gap-1">
                        <TbCalendar size={11} />
                        {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                      </span>
                      <span>{doneCount}/{issueCount} tamamlandı</span>
                    </div>
                  </div>

                  <div className="d-flex gap-2 flex-shrink-0">
                    {sprint.status === 'Planned' && (
                      <button
                        className="btn btn-sm btn-success d-flex align-items-center gap-1"
                        onClick={() => handleStart(sprint.id)}
                      >
                        <TbPlayerPlay size={14} />
                        Başlat
                      </button>
                    )}
                    {sprint.status === 'Active' && (
                      <button
                        className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                        onClick={() => handleComplete(sprint.id)}
                      >
                        <TbCheck size={14} />
                        Ayı Kapat
                      </button>
                    )}
                    {sprint.status === 'Completed' && (
                      <span className="text-muted small d-flex align-items-center gap-1">
                        <TbLock size={13} /> Kapalı
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Yeni Aylık Dönem Ekle"
      >
        <SprintForm
          projectId={projectId}
          onSuccess={() => setShowCreateModal(false)}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </div>
  );
}

export default SprintList;
