import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TbArrowLeft, TbPrinter, TbMail, TbMapPin, TbBuilding, TbUsersGroup, TbShieldCheck, TbCalendar, TbUserCheck,
} from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { teamsApi } from '../api/resources';
import { canViewPersonnel } from '../utils/permissionUtils';
import Avatar from '../components/common/Avatar';
import EmptyState from '../components/common/EmptyState';
import PersonStats from '../components/reports/PersonStats';

function InfoRow({ icon, label, children }) {
  return (
    <div className="d-flex align-items-start gap-2 py-2 border-bottom">
      <span className="text-primary flex-shrink-0" style={{ marginTop: 2 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="text-muted" style={{ fontSize: '0.72rem' }}>{label}</div>
        <div className="small fw-medium">{children}</div>
      </div>
    </div>
  );
}

/**
 * Personel Profili (/personnel/:userId): a Daire Başkanı or Müdür opens it by
 * clicking a person's name. Shows who they are (roles, müdürlükler, teams,
 * location) and the same work statistics as Performansım.
 */
export default function PersonnelProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const [teams, setTeams] = useState([]);

  const person = state.users.find((u) => u.id === userId);
  const allowed = canViewPersonnel(currentUser, person, state.projects);

  // Teams may belong to any müdürlük of the person's daire başkanlığı.
  const unitProjects = useMemo(
    () => (person ? state.projects.filter((p) => p.unitId === person.unitId) : []),
    [state.projects, person]
  );
  useEffect(() => {
    if (!person || !allowed) return undefined;
    let cancelled = false;
    Promise.all(unitProjects.map((p) => teamsApi.listByProject(p.id).catch(() => [])))
      .then((lists) => {
        if (!cancelled) setTeams(lists.flat().filter((t) => t.memberIds.includes(person.id)));
      });
    return () => { cancelled = true; };
  }, [person, allowed, unitProjects]);

  if (!person || !allowed) {
    return (
      <EmptyState
        title="Personel bulunamadı"
        description="Bu kişi yönetim alanınızda değil ya da kaydı bulunmuyor."
      />
    );
  }

  const roleName = (key) => state.roles.find((r) => r.key === key)?.name || key;
  const roles = [person.roleKey || person.role, ...(person.extraRoles || [])].map(roleName);
  const unitName = state.units.find((u) => u.id === person.unitId)?.name;
  const projectIds = (person.projectIds?.length ? person.projectIds : [person.projectId]).filter(Boolean);
  const projectName = (id) => state.projects.find((p) => p.id === id)?.name;
  const location = [person.building, person.floor && `${person.floor}. kat`, person.room && `Oda ${person.room}`]
    .filter(Boolean).join(' · ');

  return (
    <div className="viz-root">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 no-print">
        <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => navigate(-1)}>
          <TbArrowLeft size={15} /> Geri
        </button>
        <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={() => window.print()}
          title="Yazdırma penceresinde hedef olarak “PDF olarak kaydet” seçin">
          <TbPrinter size={18} /> Yazdır / PDF
        </button>
      </div>

      {/* Print header (only on paper / PDF) */}
      <div className="print-only mb-3">
        <div className="d-flex align-items-center gap-3 pb-2 mb-2" style={{ borderBottom: '2px solid #EE7203' }}>
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="" style={{ height: 52 }} />
          <div>
            <div className="fw-bold" style={{ color: '#1F2855', fontSize: '1.1rem' }}>Mersin Üniversitesi — Talep Takip Sistemi</div>
            <div className="fw-semibold" style={{ color: '#EE7203' }}>Personel Profili</div>
          </div>
        </div>
        <div className="small text-muted">Oluşturulma: {new Date().toLocaleString('tr-TR')} · Hazırlayan: {currentUser?.name}</div>
      </div>

      {/* ── Kimlik ve bilgiler ── */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm h-100 viz-card">
            <div className="card-body text-center">
              <Avatar name={person.name} color={person.avatarColor} size={72} />
              <h5 className="fw-bold mt-3 mb-1" style={{ color: '#1F2855' }}>{person.name}</h5>
              <div className="d-flex flex-wrap justify-content-center gap-1 mb-2">
                {roles.map((r) => (
                  <span key={r} className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary-subtle fw-medium">{r}</span>
                ))}
              </div>
              {person.isActive === false && <span className="badge text-bg-secondary">Pasif kullanıcı</span>}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-sm h-100 viz-card">
            <div className="card-body py-2">
              <div className="row">
                <div className="col-12 col-md-6">
                  <InfoRow icon={<TbMail size={16} />} label="E-posta">
                    <a href={`mailto:${person.email}`} className="text-decoration-none">{person.email}</a>
                  </InfoRow>
                  <InfoRow icon={<TbBuilding size={16} />} label="Daire Başkanlığı">{unitName || '—'}</InfoRow>
                  <InfoRow icon={<TbMapPin size={16} />} label="Konum">{location || '—'}</InfoRow>
                  <InfoRow icon={<TbCalendar size={16} />} label="Kayıt tarihi">
                    {person.createdAt ? new Date(person.createdAt).toLocaleDateString('tr-TR') : '—'}
                  </InfoRow>
                </div>
                <div className="col-12 col-md-6">
                  <InfoRow icon={<TbShieldCheck size={16} />} label="Müdürlükler">
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {projectIds.length === 0 && '—'}
                      {projectIds.map((id, i) => (
                        <span key={id} className="badge text-bg-light border fw-normal" style={{ fontSize: 11 }}>
                          {projectName(id) || 'Müdürlük'}{i === 0 && projectIds.length > 1 ? ' (ana)' : ''}
                        </span>
                      ))}
                    </div>
                  </InfoRow>
                  <InfoRow icon={<TbUsersGroup size={16} />} label="Ekipler">
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {teams.length === 0 && '—'}
                      {teams.map((t) => (
                        <span key={t.id} className="badge text-bg-light border fw-normal" style={{ fontSize: 11 }}
                          title={projectName(t.projectId)}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </InfoRow>
                  <InfoRow icon={<TbUserCheck size={16} />} label="Durum">
                    {person.isActive === false ? 'Pasif' : 'Aktif'}
                  </InfoRow>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── İstatistikler ── */}
      <PersonStats key={person.id} person={person} />
    </div>
  );
}
