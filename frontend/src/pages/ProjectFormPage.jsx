import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { canAccessProject } from '../utils/permissionUtils';
import ProjectForm from '../components/project/ProjectForm';
import EmptyState from '../components/common/EmptyState';

/**
 * Müdürlükler → Yeni Müdürlük (/projects/new) and each müdürlük's
 * "Müdürlük Bilgileri" (/projects/:projectId/settings). These used to live on
 * the Daire Başkanlıkları page, which the Daire Başkanı no longer sees.
 */
export default function ProjectFormPage() {
  const { projectId } = useParams();
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const project = projectId ? state.projects.find((p) => p.id === projectId) : null;
  const isEdit = Boolean(projectId);

  if (isEdit && !project) {
    return <EmptyState title="Müdürlük bulunamadı" description="Bu müdürlük silinmiş ya da erişiminiz yok." />;
  }
  if (isEdit ? !can('project.edit') || !canAccessProject(project, currentUser) : !can('project.create')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h4 className="fw-bold mb-1">{isEdit ? 'Müdürlük Bilgileri' : 'Yeni Müdürlük'}</h4>
      <p className="text-muted small mb-4">
        {isEdit
          ? `${project.name} müdürlüğünün adını, müdürünü, açıklamasını ve stok takibini düzenleyin.`
          : 'Daire başkanlığınıza yeni bir müdürlük ekleyin ve müdürünü atayın.'}
      </p>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <ProjectForm
            project={project || undefined}
            defaultUnitId={currentUser?.unitId}
            onSuccess={(saved) => navigate(`/projects/${saved.id}?tab=board`)}
            onCancel={() => navigate(-1)}
          />
        </div>
      </div>
    </div>
  );
}
