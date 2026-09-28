import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  TbLayoutDashboard,
  TbBuilding,
  TbTicket,
  TbMenu2,
  TbX,
  TbLayoutKanban,
  TbList,
  TbPackage,
  TbShieldCheck,
  TbLogout,
  TbUsersGroup,
} from 'react-icons/tb';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
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
  const { can } = usePermissions();
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMd, setIsMd] = useState(window.innerWidth >= 768);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    function handleResize() {
      const md = window.innerWidth >= 768;
      setIsMd(md);
      if (md) setIsOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // "projects" key'ini filtrele — artık NAV_CONFIG'de yok, direkt proje linkleri ekleniyor
  const navItems = currentUser
    ? (ROLE_NAV_ITEMS[currentUser.role] || [])
        .filter((key) => key !== 'projects')
        .map((key) => {
          const item = NAV_CONFIG[key];
          if (!item) return null;
          // Dış kullanıcı, Çalışan, Proje Yöneticisi, Daire Başkanı için "Talepler" → "Açtığım Talepler"
          if (key === 'requests' && [
            ROLES.EXTERNAL_USER,
            ROLES.WORKER,
            ROLES.PROJECT_MANAGER,
            ROLES.DEPARTMENT_HEAD,
          ].includes(currentUser.role)) {
            return { ...item, label: 'Açtığım Talepler' };
          }
          return item;
        })
        .filter(Boolean)
    : [];

  const roleName =
    state.roles?.find((r) => r.key === currentUser?.roleKey)?.name ||
    ROLE_LABELS[currentUser?.roleKey || currentUser?.role] ||
    currentUser?.role;

  const visibleProjects = currentUser
    ? getVisibleProjects(state.projects, currentUser)
    : [];

  const linkClass = ({ isActive }) =>
    `sidebar-link d-flex align-items-center gap-2 px-3 py-2 text-decoration-none ${
      isActive ? 'sidebar-link--active' : ''
    }`;

  const subLinkStyle = ({ isActive }) => ({
    fontSize: '0.83rem',
    color: isActive ? '#2563eb' : undefined,
    fontWeight: isActive ? 600 : 500,
    background: isActive ? '#eff6ff' : 'transparent',
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
          width: 248,
          height: '100vh',
          position: isMd ? 'sticky' : 'fixed',
          top: 0,
          left: 0,
          zIndex: 1045,
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Brand — proje adı göster */}
        <div className="sidebar-brand px-3 py-3 d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
          <span className="sidebar-brand-mark">{brandKey}</span>
          <div style={{ minWidth: 0 }}>
            <div className="fw-bold text-truncate" style={{ fontSize: '0.9rem', lineHeight: 1.2 }} title={brandLabel}>
              {brandLabel}
            </div>
            <div className="text-muted" style={{ fontSize: 11 }}>İş Takip</div>
          </div>
        </div>

        {/* Nav items */}
        <ul className="list-unstyled px-3 mb-0 flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
          <li><div className="sidebar-section">Ana Menü</div></li>
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
                <div className="sidebar-section">
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
                          style={{ backgroundColor: '#2563eb', color: '#fff', fontSize: '0.58rem', padding: '2px 4px' }}
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
                      className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
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
                      className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                      style={subLinkStyle}
                      onClick={() => !isMd && setIsOpen(false)}
                    >
                      <TbList size={16} />
                      Backlog
                    </NavLink>
                  </li>

                  {/* Ekip & Şablonlar — yalnızca yönetebilen rollere görünür */}
                  {(can('team.manage') || can('template.manage')) && (
                    <li>
                      <NavLink
                        to={`/projects/${project.id}?tab=team`}
                        className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                        style={subLinkStyle}
                        onClick={() => !isMd && setIsOpen(false)}
                      >
                        <TbUsersGroup size={16} />
                        Ekip & Şablonlar
                      </NavLink>
                    </li>
                  )}

                  {/* Stok Takip — yalnızca hasInventory: true olan projeler */}
                  {project.hasInventory && (
                    <>
                      <li>
                        <div className="sidebar-section">
                          Stok Takip
                        </div>
                      </li>
                      <li>
                        <NavLink
                          to={`/projects/${project.id}/inventory`}
                          className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                          style={subLinkStyle}
                          onClick={() => !isMd && setIsOpen(false)}
                        >
                          <TbPackage size={16} />
                          Stok Durumu
                        </NavLink>
                      </li>
                    </>
                  )}
                </React.Fragment>
              ))}
            </>
          )}

          {can('role.manage') && (
            <>
              <li><div className="sidebar-section">Yönetim</div></li>
              <li>
                <NavLink
                  to="/roles"
                  className={linkClass}
                  onClick={() => !isMd && setIsOpen(false)}
                >
                  <TbShieldCheck size={18} aria-hidden="true" />
                  <span>Roller ve İzinler</span>
                </NavLink>
              </li>
            </>
          )}
        </ul>

        {/* User card + logout */}
        {currentUser && (
          <div className="p-3">
            <div className="sidebar-user d-flex align-items-center gap-2 p-2">
              <Avatar name={currentUser.name} color={currentUser.avatarColor} size={34} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="fw-semibold text-truncate" style={{ fontSize: '0.82rem' }}>
                  {currentUser.name}
                </div>
                <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
                  {roleName}
                </div>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--danger flex-shrink-0"
                style={{ width: 32, height: 32 }}
                onClick={handleLogout}
                title="Çıkış yap"
                aria-label="Çıkış yap"
              >
                <TbLogout size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
