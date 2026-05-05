import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { TbPackage } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';

/**
 * Stok Durumu sayfası.
 * Yalnızca `hasInventory: true` olan projelerde sidebar üzerinden erişilebilir.
 * Proje bulunamazsa dashboard'a yönlendirir.
 */
function InventoryPage() {
  const { projectId } = useParams();
  const { state } = useAppContext();

  const project = state.projects.find((p) => p.id === projectId);

  if (!project) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      {/* Sayfa başlığı */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <span
            className="badge"
            style={{ backgroundColor: '#0052CC', color: '#fff', fontSize: '0.75rem' }}
          >
            {project.key}
          </span>
          <h4 className="fw-bold mb-0">{project.name}</h4>
          <span className="text-muted small">/ Stok Durumu</span>
        </div>
        {project.description && (
          <p className="text-muted small mb-0">{project.description}</p>
        )}
      </div>

      {/* İçerik kartı */}
      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <TbPackage size={48} className="text-primary mb-3 opacity-75" />
          <h5 className="fw-semibold mb-2">Stok Durumu</h5>
          <p className="text-muted mb-4">Bu özellik yakında gelecek.</p>
          <Link to={`/projects/${projectId}`} className="btn btn-outline-primary btn-sm">
            Projeye Dön
          </Link>
        </div>
      </div>
    </div>
  );
}

export default InventoryPage;
