import React, { useState } from 'react';
import { TbPlus, TbEye, TbSearch } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { ACTIONS, ROLES } from '../../constants';
import { getVisibleRequests } from '../../utils/permissionUtils';
import RequestCard from './RequestCard';
import RequestForm from './RequestForm';
import RequestDetailModal from './RequestDetailModal';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';

/**
 * Filters requests by searchQuery across title, description and number fields.
 * @param {Array} requests
 * @param {string} searchQuery
 * @returns {Array}
 */
export function filterRequests(requests, searchQuery) {
  if (!searchQuery.trim()) return requests;
  const q = searchQuery.toLowerCase();
  return requests.filter(r =>
    r.title.toLowerCase().includes(q) ||
    (r.description || '').toLowerCase().includes(q) ||
    String(r.number).toLowerCase().includes(q)
  );
}

export default function RequestList() {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const { isExternalUser, role } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [visibleToModal, setVisibleToModal] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get all visible requests
  let requests = getVisibleRequests(state.issues, currentUser);

  // Department_Head and Project_Manager see only their unit's requests
  if (role === ROLES.DEPARTMENT_HEAD || role === ROLES.PROJECT_MANAGER) {
    const myUnitProjects = state.projects
      .filter(p => p.unitId === currentUser.unitId)
      .map(p => p.id);
    requests = requests.filter(r => myUnitProjects.includes(r.projectId));
  }

  // Worker sees only requests from their own project
  if (role === ROLES.WORKER) {
    requests = requests.filter(r => r.projectId === currentUser.projectId);
  }

  const filteredRequests = filterRequests(requests, searchQuery);

  function handleAddVisibleUser(requestId) {
    if (!selectedUserId) return;
    dispatch({ type: ACTIONS.ADD_VISIBLE_USER, payload: { issueId: requestId, userId: selectedUserId } });
    setVisibleToModal(null);
    setSelectedUserId('');
  }

  const externalUsers = state.users.filter(u => u.role === ROLES.EXTERNAL_USER);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">Talepler</h4>
        <button className="btn btn-primary d-flex align-items-center gap-1" onClick={() => setShowForm(true)}>
          <TbPlus size={18} />
          Yeni Talep
        </button>
      </div>

      {/* Search input */}
      <div className="mb-3">
        <div className="input-group">
          <span className="input-group-text bg-white border-end-0">
            <TbSearch size={16} className="text-muted" />
          </span>
          <input
            type="text"
            className="form-control border-start-0"
            placeholder="Talep ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mt-1">
          <small className="text-muted">{filteredRequests.length} talep bulundu</small>
        </div>
      </div>

      {filteredRequests.length === 0 && searchQuery.trim() ? (
        <EmptyState
          title="Arama kriterlerine uygun talep bulunamadı"
          description={`"${searchQuery}" için sonuç bulunamadı.`}
        />
      ) : filteredRequests.length === 0 && !searchQuery.trim() ? (
        <EmptyState
          title="Henüz talep yok"
          description={isExternalUser ? 'Yeni bir talep oluşturabilirsiniz.' : 'Henüz talep bulunmuyor.'}
          action={<button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>Talep Oluştur</button>}
        />
      ) : (
        <div>
          {filteredRequests.map(req => (
            <div key={req.id} className="position-relative">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRequestId(req.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedRequestId(req.id)}
                style={{ cursor: 'pointer' }}
              >
                <RequestCard request={req} />
              </div>
              {!isExternalUser && (
                <button
                  className="btn btn-sm btn-outline-secondary position-absolute"
                  style={{ top: 8, right: 8 }}
                  title="Dış kullanıcıya görünür yap"
                  onClick={(e) => { e.stopPropagation(); setVisibleToModal(req); setSelectedUserId(''); }}
                >
                  <TbEye size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request detail modal */}
      <RequestDetailModal
        isOpen={!!selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
        requestId={selectedRequestId}
        onCloneSuccess={(newId) => setSelectedRequestId(newId)}
      />

      {/* New request modal */}
      <Modal isOpen={showForm} title="Yeni Talep Oluştur" onClose={() => setShowForm(false)}>
        <RequestForm onClose={() => setShowForm(false)} />
      </Modal>

      {/* Add visible user modal */}
      <Modal
        isOpen={!!visibleToModal}
        title="Dış Kullanıcıya Görünür Yap"
        onClose={() => setVisibleToModal(null)}
      >
        {visibleToModal && (
          <div>
            <p className="text-muted small mb-3">
              <strong>{visibleToModal.number}</strong> — {visibleToModal.title}
            </p>
            <div className="mb-3">
              <label className="form-label fw-medium">Dış Kullanıcı Seç</label>
              <select className="form-select" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                <option value="">— Seçiniz —</option>
                {externalUsers
                  .filter(u => !visibleToModal.visibleTo.includes(u.id))
                  .map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
            {visibleToModal.visibleTo.length > 0 && (
              <div className="mb-3">
                <p className="small fw-medium mb-1">Mevcut görünür kullanıcılar:</p>
                <ul className="list-unstyled mb-0">
                  {visibleToModal.visibleTo.map(uid => {
                    const u = state.users.find(x => x.id === uid);
                    return <li key={uid} className="small text-muted">• {u?.name || uid}</li>;
                  })}
                </ul>
              </div>
            )}
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={() => setVisibleToModal(null)}>İptal</button>
              <button className="btn btn-primary" onClick={() => handleAddVisibleUser(visibleToModal.id)} disabled={!selectedUserId}>
                Ekle
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
