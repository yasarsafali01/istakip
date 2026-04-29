import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  TbLayoutDashboard,
  TbFolder,
  TbBuilding,
  TbTicket,
  TbMenu2,
  TbX,
  TbLogout,
} from 'react-icons/tb';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_NAV_ITEMS } from '../../constants';
import Avatar from './Avatar';

const NAV_CONFIG = {
  dashboard: { to: '/dashboard', label: 'Dashboard', Icon: TbLayoutDashboard },
  units:     { to: '/units',     label: 'Birimler',  Icon: TbBuilding },
  projects:  { to: '/projects',  label: 'Projeler',  Icon: TbFolder },
  requests:  { to: '/requests',  label: 'Talepler',  Icon: TbTicket },
};

const ROLE_LABELS = {
  System_Admin:    'Sistem Yöneticisi',
  Department_Head: 'Daire Başkanı',
  Project_Manager: 'Proje Yöneticisi',
  External_User:   'Dış Kullanıcı',
};

export default function Sidebar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMd, setIsMd] = useState(window.innerWidth >= 768);

  useEffect(() => {
    function handleResize() {
      const md = window.innerWidth >= 768;
      setIsMd(md);
      if (md) setIsOpen(false); // reset mobile state when going to desktop
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const navItems = currentUser
    ? (ROLE_NAV_ITEMS[currentUser.role] || []).map(key => NAV_CONFIG[key]).filter(Boolean)
    : [];

  const linkClass = ({ isActive }) =>
    `sidebar-link d-flex align-items-center gap-2 px-3 py-2 rounded text-decoration-none ${
      isActive ? 'sidebar-link--active' : ''
    }`;

  const sidebarVisible = isMd || isOpen;

  return (
    <>
      {/* Mobile toggle button */}
      {!isMd && (
        <button
          className="btn btn-light border-0 position-fixed d-flex align-items-center justify-content-center"
          style={{ top: 12, left: 12, zIndex: 1050, width: 40, height: 40, borderRadius: 8 }}
          onClick={() => setIsOpen(o => !o)}
          aria-label={isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={isOpen}
        >
          {isOpen ? <TbX size={20} /> : <TbMenu2 size={20} />}
        </button>
      )}

      {/* Backdrop for mobile */}
      {!isMd && isOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ background: 'rgba(0,0,0,0.4)', zIndex: 1040 }}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <nav
        className="sidebar d-flex flex-column"
        aria-label="Ana navigasyon"
        style={{
          width: 220,
          minHeight: '100vh',
          position: isMd ? 'relative' : 'fixed',
          top: 0,
          left: 0,
          zIndex: 1045,
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Brand */}
        <div className="sidebar-brand px-3 py-3 d-flex align-items-center gap-2">
          <span
            style={{
              background: '#0052CC',
              color: '#fff',
              borderRadius: 6,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            K
          </span>
          <span className="fw-bold fs-6">Kurum Yönetim</span>
        </div>

        <hr className="my-1 mx-3" />

        {/* Nav items */}
        <ul className="list-unstyled px-2 mb-0 flex-grow-1">
          {navItems.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={linkClass}
                end={to === '/dashboard'}
                onClick={() => !isMd && setIsOpen(false)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* User info + logout */}
        {currentUser && (
          <>
            <hr className="my-1 mx-3" />
            <div className="px-3 pb-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <Avatar user={currentUser} size={32} />
                <div style={{ minWidth: 0 }}>
                  <div className="fw-medium text-truncate" style={{ fontSize: '0.82rem' }}>
                    {currentUser.name}
                  </div>
                  <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
                    {ROLE_LABELS[currentUser.role] || currentUser.role}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                onClick={handleLogout}
              >
                <TbLogout size={15} />
                <span>Çıkış Yap</span>
              </button>
            </div>
          </>
        )}
      </nav>
    </>
  );
}
