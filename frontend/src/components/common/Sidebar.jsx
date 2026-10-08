import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  TbUsers,
  TbForms,
  TbChartBar,
  TbUserCheck,
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
  units:     { to: '/units',     label: 'Daire Başkanlıkları',         Icon: TbBuilding },
  requests:  { to: '/requests',  label: 'Talepler',         Icon: TbTicket },
};

const ROLE_LABELS = {
  System_Admin:    'Sistem Yöneticisi',
  Department_Head: 'Daire Başkanı',
  Project_Manager: 'Müdür',
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

  const primaryRoleName =
    state.roles?.find((r) => r.key === currentUser?.roleKey)?.name ||
    ROLE_LABELS[currentUser?.roleKey || currentUser?.role] ||
    currentUser?.role;
  // Primary role first, then any extra roles (e.g. "Çalışan, Envanter Sorumlusu").
  const roleName = [
    primaryRoleName,
    ...(currentUser?.extraRoles || []).map((k) => state.roles?.find((r) => r.key === k)?.name || k),
  ].join(', ');

  const visibleProjects = currentUser
    ? getVisibleProjects(state.projects, currentUser)
    : [];

  const linkClass = ({ isActive }) =>
    `sidebar-link d-flex align-items-center gap-2 px-3 py-2 text-decoration-none ${
      isActive ? 'sidebar-link--active' : ''
    }`;

  const location = useLocation();

  const subLinkStyle = ({ isActive }) => ({
    fontSize: '0.83rem',
    color: isActive ? '#2563eb' : undefined,
    fontWeight: isActive ? 600 : 500,
    background: isActive ? '#eff6ff' : 'transparent',
  });

  // Aktif/Bekleyen Talepler/Onay Bekleyenler share one path and differ only by
  // ?tab=, which NavLink ignores — so pick the highlighted one from the query.
  const projectTabStyle = (projectId, tab) => () => {
    const current = new URLSearchParams(location.search).get('tab') || 'board';
    return subLinkStyle({ isActive: location.pathname === `/projects/${projectId}` && current === tab });
  };

  const sidebarVisible = isMd || isOpen;

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
        {/* Brand — kurum logosu ve sistem adı */}
        <div className="sidebar-brand px-3 py-3 d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Mersin Üniversitesi logosu" style={{ height: 40, width: 'auto', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div className="fw-bold text-truncate" style={{ fontSize: '0.88rem', lineHeight: 1.2, color: '#1F2855' }}>
              Mersin Üniversitesi
            </div>
            <div className="fw-semibold text-truncate" style={{ fontSize: 11.5, color: '#EE7203' }}>Talep Takip Sistemi</div>
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
                  {visibleProjects.length === 1 ? visibleProjects[0].name : 'Müdürlükler'}
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
                      style={projectTabStyle(project.id, 'board')}
                      onClick={() => !isMd && setIsOpen(false)}
                    >
                      <TbLayoutKanban size={16} />
                      Aktif Talepler
                    </NavLink>
                  </li>

                  {/* Backlog */}
                  <li>
                    <NavLink
                      to={`/projects/${project.id}?tab=backlog`}
                      className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                      style={projectTabStyle(project.id, 'backlog')}
                      onClick={() => !isMd && setIsOpen(false)}
                    >
                      <TbList size={16} />
                      Bekleyen Talepler
                    </NavLink>
                  </li>

                  {/* Onay Bekleyenler — çalışanların tamamladığı, onay bekleyen işler */}
                  {can('issue.approve') && (() => {
                    const waiting = state.issues.filter((i) => i.projectId === project.id && i.status === 'Onay Bekliyor').length;
                    return (
                      <li>
                        <NavLink
                          to={`/projects/${project.id}?tab=approvals`}
                          className="sidebar-link d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                          style={projectTabStyle(project.id, 'approvals')}
                          onClick={() => !isMd && setIsOpen(false)}
                        >
                          <TbShieldCheck size={16} />
                          Onay Bekleyenler
                          {waiting > 0 && (
                            <span className="badge rounded-pill ms-auto" style={{ backgroundColor: '#8B5CF6', fontSize: '0.65rem' }}>{waiting}</span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })()}

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

          {/* Raporlar — Performansım herkese (dış kullanıcı hariç), İstatistikler yönetim kapsamı olanlara */}
          {currentUser && currentUser.role !== ROLES.EXTERNAL_USER && (
            <>
              <li><div className="sidebar-section">Raporlar</div></li>
              <li>
                <NavLink
                  to="/performance"
                  className={linkClass}
                  onClick={() => !isMd && setIsOpen(false)}
                >
                  <TbUserCheck size={18} aria-hidden="true" />
                  <span>Performansım</span>
                </NavLink>
              </li>
              {[ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(currentUser.role) && (
                <li>
                  <NavLink
                    to="/reports"
                    className={linkClass}
                    onClick={() => !isMd && setIsOpen(false)}
                  >
                    <TbChartBar size={18} aria-hidden="true" />
                    <span>İstatistikler</span>
                  </NavLink>
                </li>
              )}
            </>
          )}

          {(can('role.manage') || can('user.assign_role') || can('request_form.manage')
            || can('team.manage') || can('template.manage')) && (
            <>
              <li><div className="sidebar-section">Yönetim</div></li>
              {can('user.assign_role') && (
                <li>
                  <NavLink
                    to="/users"
                    className={linkClass}
                    onClick={() => !isMd && setIsOpen(false)}
                  >
                    <TbUsers size={18} aria-hidden="true" />
                    <span>Kullanıcılar</span>
                  </NavLink>
                </li>
              )}
              {can('request_form.manage') && (
                <li>
                  <NavLink
                    to="/request-forms"
                    className={linkClass}
                    onClick={() => !isMd && setIsOpen(false)}
                  >
                    <TbForms size={18} aria-hidden="true" />
                    <span>Talep Formları</span>
                  </NavLink>
                </li>
              )}
              {(can('team.manage') || can('template.manage')) && (
                <li>
                  <NavLink
                    to="/teams-templates"
                    className={linkClass}
                    onClick={() => !isMd && setIsOpen(false)}
                  >
                    <TbUsersGroup size={18} aria-hidden="true" />
                    <span>Ekipler ve Şablonlar</span>
                  </NavLink>
                </li>
              )}
              {can('role.manage') && (
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
              )}
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
                <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }} title={roleName}>
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
