import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TbPlus, TbEye, TbFlag, TbCircleCheck, TbArrowsSort, TbBuilding, TbUpload, TbFileSpreadsheet, TbPrinter, TbClock,
  TbInbox, TbHourglass, TbProgress, TbBan,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useRequestFilters } from '../../hooks/useRequestFilters';
import { ACTIONS, ROLES, PRIORITIES, PRIORITY_LABELS } from '../../constants';
import { getVisibleRequests } from '../../utils/permissionUtils';
import { issuesApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';
import RequestCard from './RequestCard';
import RequestForm from './RequestForm';
import RequestDetailModal from './RequestDetailModal';
import ModernSearchBar from './ModernSearchBar';
import FilterChip, { FilterChipOption } from './FilterChip';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';
import HelpGuide from '../common/HelpGuide';
import { requestsToCsv, downloadCsv, printRequests } from '../../utils/exportUtils';
import { requestDurations, averageMs, formatDuration } from '../../utils/durationUtils';
import { Kpi } from '../dashboard/DashboardKit';

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

function helpSections(role) {
  if (role === ROLES.EXTERNAL_USER) return [
    { icon: '📋', title: 'Talep Listeleme', items: ['Kendi oluşturduğunuz ve size görünür yapılan talepler listelenir.', 'Her kartın sol kenarındaki renk çubuğu talebin durumunu gösterir.', 'Geri çevrilen talepler kırmızı, tamamlananlar yeşil ile işaretlenir.'] },
    { icon: '➕', title: 'Yeni Talep Oluşturma', items: ['Sağ üstteki "Yeni Talep" butonuyla yeni bir talep oluşturabilirsiniz.', 'Talep başlığı, açıklaması ve önceliğini belirtmeniz gerekir.', 'Talep açarken ilgili daire başkanlığı doğru seçilmelidir.', 'Taleplerde yer alan yorumlar talebinizin hızlı çözüme kavuşması için önemlidir.', 'Hatalı daire başkanlıklarına açılan taleplerin doğru daire başkanlığına tekrar açılması gerekmektedir.'] },
    { icon: '🔍', title: 'Arama ve Filtreleme', items: ['Arama kutusuna yazarak talep başlığı, açıklaması veya numarasına göre filtreleyin.', 'Durum filtresinden açık, kapanan veya geri çevrilen talepleri görüntüleyin.'] },
    { icon: '📄', title: 'Talep Detayı', items: ['Bir talep kartına tıklayarak detaylarını görüntüleyin.', 'Kendi oluşturduğunuz talepleri düzenleyebilir veya silebilirsiniz.'] },
  ];
  if (role === ROLES.WORKER) return [
    { icon: '📋', title: 'Talep Listeleme', items: ['Kendi oluşturduğunuz talepler listelenir.', 'Her kartın sol kenarındaki renk çubuğu talebin durumunu gösterir.'] },
    { icon: '➕', title: 'Yeni Talep Oluşturma', items: ['Sağ üstteki "Yeni Talep" butonuyla yeni bir talep oluşturabilirsiniz.', 'Talep başlığı, açıklaması ve önceliğini belirtmeniz gerekir.', 'Talep açarken ilgili daire başkanlığı doğru seçilmelidir.', 'Taleplerde yer alan yorumlar talebinizin hızlı çözüme kavuşması için önemlidir.', 'Hatalı daire başkanlıklarına açılan taleplerin doğru daire başkanlığına tekrar açılması gerekmektedir.'] },
    { icon: '🔍', title: 'Arama ve Filtreleme', items: ['Arama kutusuna yazarak talep arayabilirsiniz.', 'Durum, öncelik ve daire başkanlığı filtrelerini kullanabilirsiniz.'] },
  ];
  if (role === ROLES.PROJECT_MANAGER) return [
    { icon: '📋', title: 'Talep Yönetimi', items: ['Müdürlüğünüze gelen tüm talepler listelenir.', 'Talepleri duruma, önceliğe ve daire başkanlığına göre filtreleyebilirsiniz.'] },
    { icon: '✅', title: 'Talep İşlemleri', items: ['Talepleri atayabilir, durumlarını değiştirebilirsiniz.', '"Geri Çevir" butonu ile uygunsuz talepleri geri çevirebilirsiniz.', 'Geri çevirme sırasında neden belirtmeniz gerekir.'] },
    { icon: '📊', title: 'Dışa Aktarma', items: ['Talepleri Excel/CSV olarak dışa aktarabilirsiniz.', 'Yazdır seçeneği ile PDF çıktısı alabilirsiniz.'] },
  ];
  if (role === ROLES.DEPARTMENT_HEAD) return [
    { icon: '📋', title: 'Talep Yönetimi', items: ['Daire başkanlığınıza gelen tüm talepler listelenir.', 'Talepleri duruma, önceliğe ve daire başkanlığına göre filtreleyebilirsiniz.'] },
    { icon: '✅', title: 'Talep İşlemleri', items: ['Talepleri müdürlere atayabilirsiniz.', '"Geri Çevir" butonu ile uygunsuz talepleri geri çevirebilirsiniz.', 'Geri çevrilen talepler açan kişiye geri gönderilir.'] },
    { icon: '📊', title: 'Dışa Aktarma', items: ['Talepleri Excel/CSV olarak dışa aktarabilirsiniz.'] },
  ];
  return [
    { icon: '📋', title: 'Tüm Talepleri Yönetme', items: ['Sistemdeki tüm talepler listelenir.', 'Daire Başkanlığı, durum, öncelik filtrelerini kullanabilirsiniz.'] },
    { icon: '✅', title: 'Talep İşlemleri', items: ['Tüm talepleri atayabilir, durumlarını değiştirebilirsiniz.', '"Geri Çevir" butonu ile uygunsuz talepleri geri çevirebilirsiniz.'] },
    { icon: '📊', title: 'Dışa Aktarma', items: ['Talepleri Excel/CSV olarak dışa aktarabilirsiniz.', 'Yazdır seçeneği ile PDF çıktısı alabilirsiniz.'] },
  ];
}

export default function RequestList() {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const { isExternalUser, role, can } = usePermissions();

  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);

  const [visibleToModal, setVisibleToModal] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  // The top bar's "Yeni Talep" button links here with ?yeni=1 — open the form once.
  // A notification click links with ?issue=<id> — open that request's detail once.
  useEffect(() => {
    if (searchParams.get('yeni') === '1') {
      setShowForm(true);
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('issue')) {
      setSelectedRequestId(searchParams.get('issue'));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  async function handleAddVisibleUser(requestId) {
    if (!selectedUserId) return;
    try {
      const updated = await issuesApi.addVisibleUser(requestId, selectedUserId);
      const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);
      dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(updated, unitCodeByProjectId) });
    } catch (err) {
      window.alert(err.message);
    } finally {
      setVisibleToModal(null);
      setSelectedUserId('');
    }
  }

  const externalUsers = state.users.filter(u => u.role === ROLES.EXTERNAL_USER);

  // Determine empty state variant
  const hasActiveFilter = searchQuery.trim() || selectedUnitId || statusGroup !== 'all' || selectedPriority;

  // Stat card counts — always from all visible requests (not filtered)
  const allVisibleRequests = getVisibleRequests(state.issues, currentUser, state.projects);
  const totalCount      = allVisibleRequests.length;
  const pendingCount    = allVisibleRequests.filter(r => r.status === 'To Do').length;
  const inProgressCount = allVisibleRequests.filter(r => r.status !== 'To Do' && r.status !== 'Done' && r.status !== 'Geri Çevrildi').length;
  const resolvedCount   = allVisibleRequests.filter(r => r.status === 'Done').length;
  const rejectedCount   = allVisibleRequests.filter(r => r.status === 'Geri Çevrildi').length;

  // Average waiting / resolution / total time over resolved requests
  const resolvedDurations = allVisibleRequests.filter(r => r.status === 'Done').map(r => requestDurations(r));
  const avgWaiting    = averageMs(resolvedDurations.map(d => d.waiting));
  const avgResolution = averageMs(resolvedDurations.map(d => d.resolution));
  const avgTotal      = averageMs(resolvedDurations.map(d => d.total));

  return (
    <div>
      <div className="pg-head">
        <div>
          <div className="pg-head__title">
            <h4 className="pg-head__name">{isExternalUser ? 'Taleplerim' : role === ROLES.SYSTEM_ADMIN ? 'Talepler' : 'Açtığım Talepler'}</h4>
            <HelpGuide title="Talepler Sayfası — Yardım Kılavuzu" sections={helpSections(currentUser?.role)} />
          </div>
          <div className="pg-head__desc">{totalCount} talep · kutucuğa tıklayınca o duruma göre süzülür</div>
        </div>
        {can('request.create') && (
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => setShowForm(true)}>
            <TbPlus size={16} /> Yeni Talep
          </button>
        )}
      </div>

      <div className="row g-3 mb-3">
        {[
          ['Toplam', totalCount, <TbInbox size={17} />, 'navy', 'Tüm talepler', 'all'],
          ['Bekleyen', pendingCount, <TbHourglass size={17} />, 'warn', 'Henüz işleme alınmadı', 'open'],
          ['Çözüm aşamasında', inProgressCount, <TbProgress size={17} />, 'orange', 'Devam eden ve onayda', 'open'],
          ['Çözülmüş', resolvedCount, <TbCircleCheck size={17} />, 'ok', 'Tamamlanan talepler', 'closed'],
          ['Geri çevrilmiş', rejectedCount, <TbBan size={17} />, 'danger', 'Geri çevrilen talepler', 'rejected'],
        ].map(([label, value, icon, tone, sub, group]) => (
          <div key={label} className="col-6 col-md">
            <Kpi label={label} value={value} icon={icon} tone={tone} sub={sub} onClick={() => setStatusGroup(group)} />
          </div>
        ))}
      </div>

      {/* Ortalama süreler — çözülmüş talepler üzerinden */}
      {resolvedCount > 0 && (
        <div className="ds-bar mb-3">
          <span className="ds-bar__label d-flex align-items-center gap-1"><TbClock size={14} /> Ortalama süreler</span>
          <span className="text-muted" style={{ fontSize: '0.78rem' }}>{resolvedCount} çözülmüş talep</span>
          {[
            ['Bekleme', avgWaiting, 'Açılıştan işleme alınana kadar', 'var(--warn)'],
            ['Çözüm', avgResolution, 'İşleme alınmadan çözülene kadar', 'var(--orange)'],
            ['Toplam', avgTotal, 'Açılıştan çözülene kadar', 'var(--ok)'],
          ].map(([label, ms, hint, color]) => (
            <span key={label} className="d-flex align-items-baseline gap-2 ms-md-2" title={hint}>
              <span className="text-muted small">{label}</span>
              <span className="fw-bold" style={{ color }}>{formatDuration(ms)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Filter chips row */}
      <div className="d-flex flex-wrap gap-2 mb-3">

        {/* Birim filtresi */}
        {availableUnits.length > 0 && (
          <FilterChip
            icon={<TbBuilding size={14} />}
            label={selectedUnitId ? (availableUnits.find(u => u.id === selectedUnitId)?.unitCode ?? 'Daire Başkanlığı') : 'Daire Başkanlığı'}
            active={!!selectedUnitId}
          >
            <FilterChipOption selected={!selectedUnitId} onClick={() => setSelectedUnitId(null)}>
              Tüm Daire Başkanlıkları
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
              {PRIORITY_LABELS[p]}
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
              : 'Seçili daire başkanlığında talep bulunamadı.'
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
                  style={{ bottom: 8, right: 8 }}
                  title="Talep sahibine görünür yap"
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
      {/* lg: müdürlük questions can sit up to 4 per row */}
      <Modal isOpen={showForm} title="Yeni Talep Oluştur" onClose={() => setShowForm(false)} size="lg">
        <RequestForm
          onClose={() => setShowForm(false)}
          defaultUnitId={selectedUnitId}
        />
      </Modal>

      {/* Help modal */}

      {/* Add visible user modal */}
      <Modal
        isOpen={!!visibleToModal}
        title="Talep Sahibine Görünür Yap"
        onClose={() => setVisibleToModal(null)}
      >
        {visibleToModal && (
          <div>
            <p className="text-muted small mb-3">
              <strong>{visibleToModal.number}</strong> — {visibleToModal.title}
            </p>
            <div className="mb-3">
              <label className="form-label fw-medium">Üniversite Personeli / Öğrenci Seç</label>
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
