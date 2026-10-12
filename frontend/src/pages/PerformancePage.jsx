import React, { useMemo, useState } from 'react';
import { TbUserCheck, TbPrinter } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../constants';
import PersonStats from '../components/reports/PersonStats';

/**
 * Raporlar → Performansım: a person's own numbers (see PersonStats).
 * Managers can pick anyone whose work they can see.
 */
export default function PerformancePage() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const isManager = [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(currentUser?.role);
  const usersById = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);

  // People a manager can look at: everyone with work assigned in what they can see.
  const people = useMemo(() => {
    const ids = new Set(state.issues.map((i) => i.assigneeId).filter(Boolean));
    if (currentUser) ids.add(currentUser.id);
    return [...ids].map((id) => usersById[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [state.issues, usersById, currentUser]);

  const [personId, setPersonId] = useState(currentUser?.id || '');
  const person = usersById[personId] || currentUser;

  return (
    <div className="viz-root">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h4 className="fw-bold mb-0 d-flex align-items-center gap-2"><TbUserCheck size={24} className="text-primary" /> Performansım</h4>
        <button type="button" className="btn btn-primary d-flex align-items-center gap-2 no-print" onClick={() => window.print()}
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
            <div className="fw-semibold" style={{ color: '#EE7203' }}>Personel Performans Raporu</div>
          </div>
        </div>
        <div className="small text-muted">Oluşturulma: {new Date().toLocaleString('tr-TR')} · Hazırlayan: {currentUser?.name}</div>
      </div>

      {/* key: switching person resets the year / talep türü filters */}
      <PersonStats
        key={person?.id}
        person={person}
        controls={isManager && people.length > 1 && (
          <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 240 }} value={person?.id || ''}
            onChange={(e) => setPersonId(e.target.value)} aria-label="Personel">
            {people.map((u) => <option key={u.id} value={u.id}>{u.id === currentUser?.id ? `${u.name} (ben)` : u.name}</option>)}
          </select>
        )}
      />
    </div>
  );
}
