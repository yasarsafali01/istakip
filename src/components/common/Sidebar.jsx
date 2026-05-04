import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  TbLayoutDashboard,
  TbBuilding,
  TbTicket,
  TbMenu2,
  TbX,
  TbLogout,
  TbLayoutKanban,
  TbList,
} from 'react-icons/tb';
import { useAuth } from '../../hooks/useAuth';
import { useAppContext } from '../../context/AppContext';
import { ROLE_NAV_ITEMS, ROLES } from '../../constants';
import { getVisibleProjects } from '../../utils/permissionUtils';
import Avatar from './Avatar';

// "projects" key'i artık sidebar nav'dan çıkarıldı — Aktif İşler + Backlog direkt ekleniyor
const NAV_CONFIG = {
  dashboard: { to: '/dashboard', label: 'Ana Sayfa',        Icon: TbLayoutDashboard },
  units:     { to: '/units',     label: 'Birimler',         Icon: TbBuilding },
  requests:  { to: '/requests',  label: 'Talepler',         Icon: TbTicket },
};

const ROLE_LABELS = {
  System_Admin:    'Sistem Yöneticisi',
  Department_Head: 'Daire Başkanı',
  Project_Manager: 'Proje Yöneticisi',
  Worker:          'Çalışan',
  External_User:   'Dış Kullanıcı',
};

export default function Sidebar() {
  const { currentUser, logout } = useAuth();
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMd, setIsMd] = useState(window.innerWidth >= 768);

  useEffect(() => {
    function handleResize() {
      const md = window.innerWidth >= 768;
      setIsMd(md);
      if (md) setIsOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  // "projects" key'ini filtrele — artık NAV_CONFIG'de yok, direkt proje linkleri ekleniyor
  const navItems = currentUser
    ? (ROLE_NAV_ITEMS[currentUser.role] || [])
        .filter((key) => key !== 'projects')
        .map((key) => {
          const item = NAV_CONFIG[key];
          if (!item) return null;
          // Dış kullanıcı için "Talepler" → "Açtığım Talepler"
          if (key === 'requests' && currentUser.role === ROLES.EXTERNAL_USER) {
            return { ...item, label: 'Açtığım Talepler' };
          }
          // Çalışan için "Talepler" → "Açtığım Talepler"
          if (key === 'requests' && currentUser.role === ROLES.WORKER) {
            return { ...item, label: 'Açtığım Talepler' };
          }
          return item;
        })
        .filter(Boolean)
    : [];

  const visibleProjects = currentUser
    ? getVisibleProjects(state.projects, currentUser)
    : [];

  const linkClass = ({ isActive }) =>
    `sidebar-link d-flex align-items-center gap-2 px-3 py-2 rounded text-decoration-none ${
      isActive ? 'sidebar-link--active' : ''
    }`;

  const subLinkStyle = ({ isActive }) => ({
    fontSize: '0.83rem',
    color: isActive ? '#0052CC' : 'inherit',
    fontWeight: isActive ? 600 : 400,
    background: isActive ? 'rgba(0,82,204,0.08)' : 'transparent',
  });

  const sidebarVisible = isMd || isOpen;

  // Brand: proje adı(ları) göster, yoksa varsayılan metin
  const brandLabel = visibleProjects.length === 1
    ? visibleProjects[0].name
    : visibleProjects.length > 1
    ? 'Projeler'
    : 'Kurum Yönetim';

  const brandKey = visibleProjects.length === 1
    ? visibleProjects[0].key
    : 'K';

  return (
    <>
      {/* Mobile toggle */}
      {!isMd && (
        <button
          className="btn btn-light border-0 position-fixed d-flex align-items-center justify-content-center"
          style={{ top: 12, left: 12, zIndex: 1050, width: 40, height: 40, borderRadius: 8 }}
          onClick={() => setIsOpen((o) => !o)}
          aria-label={isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={isOpen}
        >
          {isOpen ? <TbX size={20} /> : <TbMenu2 size={20} />}
        </button>
      )}

      {/* Backdrop */}
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
        {/* Brand — proje adı göster */}
        <div className="sidebar-brand px-3 py-3 d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
          <span
            style={{
              background: '#0052CC',
              color: '#fff',
              borderRadius: 6,
              minWidth: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12,
              padding: '0 6px',
              flexShrink: 0,
            }}
          >
            {brandKey}
          </span>
          <span
            className="fw-bold text-truncate"
            style={{ fontSize: '0.9rem', minWidth: 0 }}
            title={brandLabel}
          >
            {brandLabel}
          </span>
        </div>

        <hr className="my-1 mx-3" />

        {/* Nav items */}
        <ul className="list-unstyled px-2 mb-0 flex-grow-1" style={{ overflowY: 'auto' }}>
          {/* Dashboard, Birimler, Talepler */}
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

          {/* Proje linkleri — Aktif İşler + Backlog (Worker hariç) */}
          {visibleProjects.length > 0 && currentUser?.role !== ROLES.WORKER && (
            <>
              <li>
                <div
                  className="px-3 pt-3 pb-1"
                  style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B778C', letterSpacing: '0.06em', textTransform: 'uppercase', userSelect: 'none' }}
                >
                  {visibleProjects.length === 1 ? visibleProjects[0].name : 'Projeler'}
                </div>
              </li>

              {visibleProjects.map((project) => (
                <React.Fragment key={project.id}>
                  {/* Birden fazla proje varsa proje adı ayırıcı */}
                  {visibleProjects.length > 1 && (
                    <li>
                      <div
                        className="d-flex align-items-center gap-2 px-3 py-1"
                        style={{ fontSize: '0.75rem', color: '#6B778C', userSelect: 'none' }}
                      >
                        <span
                          className="badge"
                          style={{ backgroundColor: '#0052CC', color: '#fff', fontSize: '0.58rem', padding: '2px 4px' }}
                        >
                          {project.key}
                        </span>
                        <span className="text-truncate" style={{ maxWidth: 130 }} title={project.name}>
                          {project.name}
                        </span>
                      </div>
                    </li>
                  )}

                  {/* Aktif İşler */}
                  <li>
                    <NavLink
                      to={`/projects/${project.id}?tab=board`}
                      className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 rounded text-decoration-none"
                      style={subLinkStyle}
                      onClick={() => !isMd && setIsOpen(false)}
                    >
                      <TbLayoutKanban size={16} />
                      Aktif İşler
                    </NavLink>
                  </li>

                  {/* Backlog */}
                  <li>
                    <NavLink
                      to={`/projects/${project.id}?tab=backlog`}
                      className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 rounded text-decoration-none"
                      style={subLinkStyle}
                      onClick={() => !isMd && setIsOpen(false)}
                    >
                      <TbList size={16} />
                      Backlog
                    </NavLink>
                  </li>
                </React.Fragment>
              ))}
            </>
          )}
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
