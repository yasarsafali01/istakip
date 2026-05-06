import React, { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { TbLock } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { canAccessProject } from '../utils/permissionUtils';
import Board from '../components/board/Board';
import EmptyState from '../components/common/EmptyState';
import HelpGuide from '../components/common/HelpGuide';
import { ROLES } from '../constants';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function BoardPage() {
  const { projectId } = useParams();
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const [selectedSprintId, setSelectedSprintId] = useState('active');

  const project = state.projects.find(p => p.id === projectId);

  if (!project) {
    return (
      <EmptyState
        title="Proje bulunamadı"
        description="Bu proje mevcut değil veya silinmiş olabilir."
        action={<Link to="/projects" className="btn btn-primary">Projelere Dön</Link>}
      />
    );
  }

  // Access control: redirect if user has no access to this project
  if (!canAccessProject(project, currentUser)) {
    return <Navigate to="/projects" replace />;
  }

  // All sprints for this project, sorted newest first
  const allSprints = state.sprints
    .filter(s => s.projectId === projectId)
    .sort((a, b) => {
      const aYear = a.year ?? new Date(a.startDate).getFullYear();
      const bYear = b.year ?? new Date(b.startDate).getFullYear();
      const aMonth = a.month ?? new Date(a.startDate).getMonth() + 1;
      const bMonth = b.month ?? new Date(b.startDate).getMonth() + 1;
      if (aYear !== bYear) return bYear - aYear;
      return bMonth - aMonth;
    });

  const activeSprint = allSprints.find(s => s.status === 'Active');

  // Resolve which sprint to show
  const resolvedSprint =
    selectedSprintId === 'active'
      ? activeSprint ?? null
      : selectedSprintId === 'all'
      ? null
      : allSprints.find(s => s.id === selectedSprintId) ?? null;

  const resolvedSprintId = resolvedSprint?.id ?? null;

  // If the selected sprint is Completed → readonly mode
  const isReadonly = resolvedSprint?.status === 'Completed';

  return (
    <div>
      {/* Page header */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h4 className="fw-bold mb-0">{project.name}</h4>
            <HelpGuide
              title="Board — Yardım Kılavuzu"
              sections={
                currentUser?.role === ROLES.PROJECT_MANAGER ? [
                  { icon: '📌', title: 'Board Görünümü', items: ['İşleri sütunlar arasında sürükleyerek durumlarını güncelleyebilirsiniz.', 'Ay seçici ile farklı dönemlerin board\'unu görüntüleyebilirsiniz.', '"Aktif Ay" seçeneği mevcut aktif dönemi gösterir.'] },
                  { icon: '➕', title: 'Issue Yönetimi', items: ['Sütun başlıklarındaki "+" butonuyla yeni issue oluşturabilirsiniz.', 'Issue kartına tıklayarak detayları görüntüleyebilir ve düzenleyebilirsiniz.'] },
                  { icon: '🔒', title: 'Kapalı Dönemler', items: ['Tamamlanan dönemler salt okunur modda görüntülenir, değişiklik yapılamaz.'] },
                ] : [
                  { icon: '📌', title: 'Board Görünümü', items: ['İşlerin durumlarını sütunlar arasında sürükleyerek güncelleyebilirsiniz.', 'Ay seçici ile farklı dönemlerin board\'unu görüntüleyebilirsiniz.'] },
                  { icon: '🔒', title: 'Kapalı Dönemler', items: ['Tamamlanan dönemler salt okunur modda görüntülenir.'] },
                ]
              }
            />
          </div>
          <p className="text-muted small mb-0">Board</p>
        </div>

        {/* Month / sprint selector */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <label htmlFor="sprint-select" className="form-label mb-0 small fw-semibold">
            Ay:
          </label>
          <select
            id="sprint-select"
            className="form-select form-select-sm"
            value={selectedSprintId}
            onChange={e => setSelectedSprintId(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="active">Aktif Ay</option>
            <option value="all">Tümü (Kanban)</option>
            {allSprints.map(sprint => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name || `${MONTH_NAMES[(sprint.month || 1) - 1]} ${sprint.year}`}
                {sprint.status === 'Active' ? ' ✓' : sprint.status === 'Completed' ? ' 🔒' : ''}
              </option>
            ))}
          </select>

          {isReadonly && (
            <span className="badge d-flex align-items-center gap-1"
              style={{ background: '#DEEBFF', color: '#0747A6', fontSize: '0.75rem', padding: '5px 10px' }}>
              <TbLock size={13} />
              Kapalı Ay — Salt Okunur
            </span>
          )}
        </div>
      </div>

      <Board
        projectId={projectId}
        sprintId={resolvedSprintId}
        readonly={isReadonly}
      />
    </div>
  );
}

export default BoardPage;
