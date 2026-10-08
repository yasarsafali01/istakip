import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { getVisibleProjects } from '../utils/permissionUtils';
import TeamsAndTemplates from '../components/project/TeamsAndTemplates';
import EmptyState from '../components/common/EmptyState';

/**
 * Yönetim → Ekipler ve Şablonlar: one place to manage each müdürlük's teams
 * and canned reply templates (previously a tab under every müdürlük).
 */
export default function TeamsTemplatesPage() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const projects = useMemo(
    () => (currentUser ? getVisibleProjects(state.projects, currentUser) : []),
    [state.projects, currentUser]
  );
  const projectId = searchParams.get('project') || (projects.length === 1 ? projects[0].id : '');
  const project = projects.find((p) => p.id === projectId);

  const unitsById = Object.fromEntries(state.units.map((u) => [u.id, u]));
  const projectsByUnit = projects.reduce((acc, p) => {
    (acc[p.unitId] = acc[p.unitId] || []).push(p);
    return acc;
  }, {});

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
        {projects.length > 1 && (
          <select
            className="form-select"
            style={{ maxWidth: 300 }}
            value={projectId}
            onChange={(e) => setSearchParams(e.target.value ? { project: e.target.value } : {})}
            aria-label="Müdürlük seçin"
          >
            <option value="">— Müdürlük seçin —</option>
            {Object.entries(projectsByUnit).map(([unitId, list]) => (
              <optgroup key={unitId} label={unitsById[unitId]?.name || 'Daire Başkanlığı'}>
                {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {!project ? (
        <EmptyState
          title={projects.length ? 'Bir müdürlük seçin' : 'Yönettiğiniz müdürlük yok'}
          description={projects.length
            ? 'Ekiplerini ve şablonlarını düzenlemek istediğiniz müdürlüğü sağ üstten seçin.'
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
