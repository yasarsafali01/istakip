import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { getVisibleProjects } from '../utils/permissionUtils';
import TeamsAndTemplates from '../components/project/TeamsAndTemplates';
import EmptyState from '../components/common/EmptyState';

/**
 * Yönetim → Ekipler ve Şablonlar: one müdürlük's teams and canned reply
 * templates. Users with several müdürlükler pick one from the sidebar
 * (each müdürlük lists its own link), which sets ?project=.
 */
export default function TeamsTemplatesPage() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();

  const projects = useMemo(
    () => (currentUser ? getVisibleProjects(state.projects, currentUser) : []),
    [state.projects, currentUser]
  );
  const projectId = searchParams.get('project') || (projects.length === 1 ? projects[0].id : '');
  const project = projects.find((p) => p.id === projectId);

  return (
    <div>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
        <div>
          <h4 className="fw-bold mb-1">Ekipler ve Şablonlar</h4>
          <p className="text-muted small mb-0" style={{ maxWidth: 620 }}>
            Müdürlüğünüzün ekiplerini (talebi tek kişi yerine bir gruba atamak için) ve yorumlarda kullanılan hazır
            cevap şablonlarını yönetin.
          </p>
        </div>
      </div>

      {!project ? (
        <EmptyState
          title={projects.length ? 'Bir müdürlük seçin' : 'Yönettiğiniz müdürlük yok'}
          description={projects.length
            ? 'Ekiplerini ve şablonlarını düzenlemek istediğiniz müdürlüğün altından seçin (sol menü → Müdürlükler).'
            : 'Ekip ve şablon yönetmek için bir müdürlüğün yöneticisi olmalısınız.'}
        />
      ) : (
        <>
          <div className="d-flex align-items-center gap-2 mb-3">
            <span className="badge bg-primary bg-opacity-10 text-primary">{project.key}</span>
            <span className="fw-semibold">{project.name}</span>
          </div>
          {/* key: remount so the panel reloads when the müdürlük changes */}
          <TeamsAndTemplates key={project.id} projectId={project.id} />
        </>
      )}
    </div>
  );
}
