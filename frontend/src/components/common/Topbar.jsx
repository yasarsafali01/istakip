import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TbPlus, TbLogout } from 'react-icons/tb';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';

// Route prefix → page title shown in the top bar. First match wins.
const PAGE_TITLES = [
  ['/dashboard', 'Ana Sayfa'],
  ['/units', 'Daire Başkanlıkları'],
  ['/projects/new', 'Yeni Müdürlük'],
  ['/projects', 'Müdürlükler'],
  ['/request-forms', 'Talep Formları'],
  ['/teams-templates', 'Ekipler ve Şablonlar'],
  ['/reports', 'İstatistikler'],
  ['/performance', 'Performansım'],
  ['/personnel', 'Personel Profili'],
  ['/requests', 'Talepler'],
  ['/users', 'Kullanıcılar'],
  ['/roles', 'Roller ve İzinler'],
  ['/profile', 'Profilim'],
];

function titleFor(pathname) {
  const hit = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix));
  return hit ? hit[1] : 'Talep Takip Sistemi';
}

export default function Topbar() {
  const { currentUser, logout } = useAuth();
  const { can } = usePermissions();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="topbar">
      {/* Left padding on small screens leaves room for the sidebar toggle */}
      <div className="d-flex align-items-center gap-2 ps-5 ps-md-0" style={{ minWidth: 0 }}>
        <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" aria-hidden="true" className="d-none d-sm-inline" style={{ height: 22 }} />
        <span className="topbar-crumb d-none d-sm-inline">Talep Takip Sistemi</span>
        <span className="topbar-crumb d-none d-sm-inline" aria-hidden="true">/</span>
        <span className="topbar-title text-truncate">{titleFor(pathname)}</span>
      </div>

      <div className="d-flex align-items-center gap-2">
        {/* The requests page already has its own "Yeni Talep" button */}
        {can('request.create') && !pathname.startsWith('/requests') && (
          <Link to="/requests?yeni=1" className="topbar-cta" title="Yeni talep oluştur">
            <TbPlus size={16} aria-hidden="true" />
            <span className="d-none d-sm-inline">Yeni Talep</span>
          </Link>
        )}

        <NotificationBell />

        {currentUser && (
          <Link to="/profile" className="topbar-user d-none d-md-flex text-decoration-none" title="Profilim">
            <Avatar name={currentUser.name} color={currentUser.avatarColor} size={28} />
            <span className="fw-medium text-truncate" style={{ fontSize: 13, maxWidth: 140, color: '#172B4D' }}>
              {currentUser.name}
            </span>
          </Link>
        )}

        <button
          type="button"
          className="icon-btn icon-btn--danger"
          onClick={handleLogout}
          title="Çıkış yap"
          aria-label="Çıkış yap"
        >
          <TbLogout aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
