import React from 'react';
import { Link } from 'react-router-dom';
import { TbError404 } from 'react-icons/tb';

/**
 * 404 Not Found page shown when the user navigates to an unknown route.
 */
function NotFoundPage() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5">
      <TbError404 size={96} className="text-secondary mb-3" aria-hidden="true" />
      <h2 className="fw-bold mb-2">Sayfa Bulunamadı</h2>
      <p className="text-muted mb-4">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </p>
      <Link to="/dashboard" className="btn btn-primary">
        Dashboard'a Dön
      </Link>
    </div>
  );
}

export default NotFoundPage;
