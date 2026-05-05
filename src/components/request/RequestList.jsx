import React, { useState } from 'react';
import { TbPlus, TbEye, TbHelp, TbFlag, TbCircleCheck, TbArrowsSort, TbBuilding, TbUpload, TbFileSpreadsheet, TbPrinter } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useRequestFilters } from '../../hooks/useRequestFilters';
import { ACTIONS, ROLES, PRIORITIES } from '../../constants';
import { getVisibleRequests } from '../../utils/permissionUtils';
import RequestCard from './RequestCard';
import RequestForm from './RequestForm';
import RequestDetailModal from './RequestDetailModal';
import ModernSearchBar from './ModernSearchBar';
import FilterChip, { FilterChipOption } from './FilterChip';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';
import { requestsToCsv, downloadCsv, printRequests } from '../../utils/exportUtils';

/**
 * Filters requests by searchQuery across title, description and number fields.
 * Exported so it can be reused by useRequestFilters hook.
 *
 * @param {Array}  requests
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
  const [showHelp, setShowHelp] = useState(false);

  // All filtering logic delegated to the hook
  const {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    selectedUnitId,
    setSelectedUnitId,
    statusGroup,
    setStatusGroup,
    selectedPriority,
    setSelectedPriority,
    sortBy,
    setSortBy,
    filteredRequests,
    availableUnits,
    resultCount,
  } = useRequestFilters({
    issues: state.issues,
    currentUser,
    projects: state.projects,
    units: state.units,
    role,
  });

  function handleAddVisibleUser(requestId) {
    if (!selectedUserId) return;
    dispatch({ type: ACTIONS.ADD_VISIBLE_USER, payload: { issueId: requestId, userId: selectedUserId } });
    setVisibleToModal(null);
    setSelectedUserId('');
  }

  const externalUsers = state.users.filter(u => u.role === ROLES.EXTERNAL_USER);

  // Determine empty state variant
  const hasActiveFilter = searchQuery.trim() || selectedUnitId || statusGroup !== 'all' || selectedPriority;

  // Stat card counts — always from all visible requests (not filtered)
  const allVisibleRequests = getVisibleRequests(state.issues, currentUser, state.projects);
  const totalCount      = allVisibleRequests.length;
  const inProgressCount = allVisibleRequests.filter(r => r.status !== 'To Do' && r.status !== 'Done' && r.status !== 'Geri Çevrildi').length;
  const resolvedCount   = allVisibleRequests.filter(r => r.status === 'Done').length;
  const rejectedCount   = allVisibleRequests.filter(r => r.status === 'Geri Çevrildi').length;

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-2">
          <h4 className="fw-bold mb-0">
            {[ROLES.EXTERNAL_USER, ROLES.WORKER, ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD].includes(currentUser?.role)
              ? 'Açtığım Talepler'
              : 'Talepler'}
          </h4>
          <button
            type="button"
            className="btn btn-link p-0 text-muted d-flex align-items-center"
            style={{ lineHeight: 1 }}
            onClick={() => setShowHelp(true)}
            title="Bu sayfa hakkında bilgi al"
            aria-label="Yardım"
          >
            <TbHelp size={20} />
          </button>
        </div>
        <button
          className="btn btn-primary d-flex align-items-center gap-1"
          onClick={() => setShowForm(true)}
        >
          <TbPlus size={18} />
          Yeni Talep
        </button>
      </div>

      {/* Stat cards */}
      <div className="row g-3 mb-4">
        {/* Toplam Talep */}
        <div className="col-3">
          <div
            className="rounded-3 p-3 h-100"
            style={{
              background: 'linear-gradient(135deg, #EAF0FB 0%, #dce8ff 100%)',
              borderLeft: '4px solid #0052CC',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="text-muted small fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Toplam Talep
              </span>
              <span style={{ fontSize: '1.4rem' }}>📋</span>
            </div>
            <div className="fw-bold" style={{ fontSize: '2rem', color: '#0052CC', lineHeight: 1 }}>
              {totalCount}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '0.78rem' }}>Tüm talepleriniz</div>
          </div>
        </div>

        {/* Çözüm Aşamasında */}
        <div className="col-3">
          <div
            className="rounded-3 p-3 h-100"
            style={{
              background: 'linear-gradient(135deg, #FFF4E5 0%, #ffe8c2 100%)',
              borderLeft: '4px solid #FF991F',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="text-muted small fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Çözüm Aşamasında
              </span>
              <span style={{ fontSize: '1.4rem' }}>⚙️</span>
            </div>
            <div className="fw-bold" style={{ fontSize: '2rem', color: '#FF991F', lineHeight: 1 }}>
              {inProgressCount}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '0.78rem' }}>In Progress + In Review</div>
          </div>
        </div>

        {/* Çözülmüş */}
        <div className="col-3">
          <div
            className="rounded-3 p-3 h-100"
            style={{
              background: 'linear-gradient(135deg, #E3FCEF 0%, #c6f6d5 100%)',
              borderLeft: '4px solid #00875A',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="text-muted small fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Çözülmüş
              </span>
              <span style={{ fontSize: '1.4rem' }}>✅</span>
            </div>
            <div className="fw-bold" style={{ fontSize: '2rem', color: '#00875A', lineHeight: 1 }}>
              {resolvedCount}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '0.78rem' }}>Tamamlanan talepler</div>
          </div>
        </div>

        {/* Geri Çevrilmiş */}
        <div className="col-3">
          <div
            className="rounded-3 p-3 h-100"
            style={{
              background: 'linear-gradient(135deg, #FFEBE6 0%, #ffd4cc 100%)',
              borderLeft: '4px solid #DE350B',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="text-muted small fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Geri Çevrilmiş
              </span>
              <span style={{ fontSize: '1.4rem' }}>🚫</span>
            </div>
            <div className="fw-bold" style={{ fontSize: '2rem', color: '#DE350B', lineHeight: 1 }}>
              {rejectedCount}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '0.78rem' }}>Geri çevrilen talepler</div>
          </div>
        </div>
      </div>

      {/* Filter chips row */}
      <div className="d-flex flex-wrap gap-2 mb-3">

        {/* Birim filtresi */}
        {availableUnits.length > 0 && (
          <FilterChip
            icon={<TbBuilding size={14} />}
            label={selectedUnitId ? (availableUnits.find(u => u.id === selectedUnitId)?.unitCode ?? 'Birim') : 'Birim'}
            active={!!selectedUnitId}
          >
            <FilterChipOption selected={!selectedUnitId} onClick={() => setSelectedUnitId(null)}>
              Tüm Birimler
            </FilterChipOption>
            {availableUnits.map(unit => (
              <FilterChipOption
                key={unit.id}
                selected={selectedUnitId === unit.id}
                onClick={() => setSelectedUnitId(unit.id)}
              >
                {unit.unitCode} — {unit.name}
              </FilterChipOption>
            ))}
          </FilterChip>
        )}

        {/* Durum filtresi */}
        <FilterChip
          icon={<TbCircleCheck size={14} />}
          label={statusGroup === 'open' ? 'Açık Talepler' : statusGroup === 'closed' ? 'Kapanan Talepler' : statusGroup === 'rejected' ? 'Geri Çevrilen Talepler' : 'Durum'}
          active={statusGroup !== 'all'}
        >
          <FilterChipOption selected={statusGroup === 'all'} onClick={() => setStatusGroup('all')}>
            Tüm Talepler
          </FilterChipOption>
          <FilterChipOption selected={statusGroup === 'open'} onClick={() => setStatusGroup('open')}>
            Açık Talepler
          </FilterChipOption>
          <FilterChipOption selected={statusGroup === 'closed'} onClick={() => setStatusGroup('closed')}>
            Kapanan Talepler
          </FilterChipOption>
          <FilterChipOption selected={statusGroup === 'rejected'} onClick={() => setStatusGroup('rejected')}>
            Geri Çevrilen Talepler
          </FilterChipOption>
        </FilterChip>

        {/* Öncelik filtresi */}
        <FilterChip
          icon={<TbFlag size={14} />}
          label={selectedPriority || 'Öncelik'}
          active={!!selectedPriority}
        >
          <FilterChipOption selected={!selectedPriority} onClick={() => setSelectedPriority('')}>
            Tüm Öncelikler
          </FilterChipOption>
          {PRIORITIES.map(p => (
            <FilterChipOption
              key={p}
              selected={selectedPriority === p}
              onClick={() => setSelectedPriority(p)}
            >
              {p}
            </FilterChipOption>
          ))}
        </FilterChip>

        {/* Sıralama */}
        <FilterChip
          icon={<TbArrowsSort size={14} />}
          label={
            sortBy === 'date_asc' ? 'En Eski Önce' :
            sortBy === 'priority_asc' ? 'Öncelik ↑' :
            sortBy === 'priority_desc' ? 'Öncelik ↓' :
            'Sırala'
          }
          active={sortBy !== 'date_desc'}
        >
          <FilterChipOption selected={sortBy === 'date_desc'} onClick={() => setSortBy('date_desc')}>
            En Yeni Önce
          </FilterChipOption>
          <FilterChipOption selected={sortBy === 'date_asc'} onClick={() => setSortBy('date_asc')}>
            En Eski Önce
          </FilterChipOption>
          <FilterChipOption selected={sortBy === 'priority_asc'} onClick={() => setSortBy('priority_asc')}>
            Öncelik: Yüksek → Düşük
          </FilterChipOption>
          <FilterChipOption selected={sortBy === 'priority_desc'} onClick={() => setSortBy('priority_desc')}>
            Öncelik: Düşük → Yüksek
          </FilterChipOption>
        </FilterChip>

        {/* Dışa Aktar */}
        <FilterChip
          icon={<TbUpload size={14} />}
          label="Dışa Aktar"
          active={false}
        >
          <FilterChipOption
            selected={false}
            onClick={() => {
              const csv = requestsToCsv(filteredRequests, state.units, state.users);
              downloadCsv(csv, 'talepler.csv');
            }}
          >
            <TbFileSpreadsheet size={14} style={{ flexShrink: 0 }} />
            Excel / CSV olarak indir
          </FilterChipOption>
          <FilterChipOption
            selected={false}
            onClick={() => printRequests(filteredRequests, state.units, state.users)}
          >
            <TbPrinter size={14} style={{ flexShrink: 0 }} />
            Yazdır
          </FilterChipOption>
        </FilterChip>

      </div>
      <ModernSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={resultCount}
      />

      {/* Request list */}
      {filteredRequests.length === 0 && hasActiveFilter ? (
        <EmptyState
          title="Arama kriterlerine uygun talep bulunamadı"
          description={
            searchQuery.trim()
              ? `"${searchQuery}" için sonuç bulunamadı.`
              : 'Seçili birimde talep bulunamadı.'
          }
        />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title="Henüz talep yok"
          description={isExternalUser ? 'Yeni bir talep oluşturabilirsiniz.' : 'Henüz talep bulunmuyor.'}
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              Talep Oluştur
            </button>
          }
        />
      ) : (
        <div>
          {filteredRequests.map(req => (
            <div key={req.id} className="position-relative">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRequestId(req.id)}
                onKeyDown={e => e.key === 'Enter' && setSelectedRequestId(req.id)}
                style={{ cursor: 'pointer' }}
              >
                <RequestCard request={req} searchQuery={debouncedQuery} />
              </div>

              {/* "Make visible to external user" button — internal users only */}
              {!isExternalUser && (
                <button
                  className="btn btn-sm btn-outline-secondary position-absolute"
                  style={{ top: 8, right: 8 }}
                  title="Dış kullanıcıya görünür yap"
                  onClick={e => {
                    e.stopPropagation();
                    setVisibleToModal(req);
                    setSelectedUserId('');
                  }}
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
        onCloneSuccess={newId => setSelectedRequestId(newId)}
      />

      {/* New request modal */}
      <Modal isOpen={showForm} title="Yeni Talep Oluştur" onClose={() => setShowForm(false)}>
        <RequestForm
          onClose={() => setShowForm(false)}
          defaultUnitId={selectedUnitId}
        />
      </Modal>

      {/* Help modal */}
      <Modal isOpen={showHelp} title="Talepler Sayfası — Yardım" onClose={() => setShowHelp(false)}>
        <div style={{ fontSize: '0.9rem' }}>
          <p className="text-muted mb-3">Bu sayfada taleplerinizi yönetebilirsiniz. Aşağıda yapabilecekleriniz özetlenmiştir.</p>

          <div className="mb-3">
            <h6 className="fw-semibold mb-2">📋 Talep Listeleme</h6>
            <ul className="mb-0 ps-3 text-muted">
              <li>Kendi oluşturduğunuz ve size görünür yapılan talepler listelenir.</li>
              <li>Her kartın sol kenarındaki renk çubuğu talebin durumunu gösterir.</li>
            </ul>
          </div>

          <div className="mb-3">
            <h6 className="fw-semibold mb-2">🔍 Arama</h6>
            <ul className="mb-0 ps-3 text-muted">
              <li>Arama kutusuna yazarak talep başlığı, açıklaması veya numarasına göre filtreleyin.</li>
              <li>Eşleşen metinler sarı ile vurgulanır.</li>
              <li>Aramayı temizlemek için sağdaki × butonuna tıklayın.</li>
            </ul>
          </div>

          <div className="mb-3">
            <h6 className="fw-semibold mb-2">🏢 Birim Filtresi</h6>
            <ul className="mb-0 ps-3 text-muted">
              <li>Açılır listeden bir birim seçerek yalnızca o birime ait talepleri görüntüleyin.</li>
              <li>"Tüm Birimler" seçeneği filtreyi kaldırır.</li>
            </ul>
          </div>

          <div className="mb-3">
            <h6 className="fw-semibold mb-2">🔽 Durum, Öncelik ve Sıralama</h6>
            <ul className="mb-0 ps-3 text-muted">
              <li><strong>Durum:</strong> Tüm talepler, yalnızca açık (To Do / In Progress / In Review) veya kapanan (Done) talepler arasında seçim yapın.</li>
              <li><strong>Öncelik:</strong> Belirli bir öncelik seviyesine göre filtreleyin (Highest, High, Medium, Low, Lowest).</li>
              <li><strong>Sıralama:</strong> Talepleri tarihe (en yeni / en eski) veya önceliğe göre sıralayın.</li>
            </ul>
          </div>

          <div className="mb-3">
            <h6 className="fw-semibold mb-2">➕ Yeni Talep</h6>
            <ul className="mb-0 ps-3 text-muted">
              <li>Sağ üstteki "Yeni Talep" butonuyla yeni bir talep oluşturabilirsiniz.</li>
            </ul>
          </div>

          <div className="mb-3">
            <h6 className="fw-semibold mb-2">✏️ Talep Düzenleme ve Silme</h6>
            <ul className="mb-0 ps-3 text-muted">
              <li>Bir talep kartına tıklayarak detaylarını görüntüleyin.</li>
              <li>Kendi oluşturduğunuz talepleri düzenleyebilir veya silebilirsiniz.</li>
            </ul>
          </div>

          <div className="d-flex justify-content-end mt-4">
            <button className="btn btn-primary btn-sm" onClick={() => setShowHelp(false)}>
              Anladım
            </button>
          </div>
        </div>
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
              <select
                className="form-select"
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
              >
                <option value="">— Seçiniz —</option>
                {externalUsers
                  .filter(u => !visibleToModal.visibleTo.includes(u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>
            {visibleToModal.visibleTo.length > 0 && (
              <div className="mb-3">
                <p className="small fw-medium mb-1">Mevcut görünür kullanıcılar:</p>
                <ul className="list-unstyled mb-0">
                  {visibleToModal.visibleTo.map(uid => {
                    const u = state.users.find(x => x.id === uid);
                    return (
                      <li key={uid} className="small text-muted">
                        • {u?.name || uid}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="d-flex gap-2 justify-content-end">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setVisibleToModal(null)}
              >
                İptal
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAddVisibleUser(visibleToModal.id)}
                disabled={!selectedUserId}
              >
                Ekle
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
