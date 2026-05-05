import { useState, useEffect, useMemo } from 'react';
import { ROLES, PRIORITIES } from '../constants';
import { getVisibleRequests } from '../utils/permissionUtils';
import { filterRequests } from '../components/request/RequestList';

// Statuses considered "open" (not resolved)
const OPEN_STATUSES = ['To Do', 'In Progress', 'In Review'];
const CLOSED_STATUSES = ['Done'];
const REJECTED_STATUSES = ['Geri Çevrildi'];

// Priority order for sorting (lower index = higher priority)
const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

/**
 * Centralises all filtering and sorting logic for the requests list.
 *
 * Filtering pipeline (order is fixed and must not be changed):
 *   1. getVisibleRequests  — permission layer (External_User rule)
 *   2. Role-based filter   — Department_Head / Project_Manager / Worker
 *   3. Unit filter         — selectedUnitId
 *   4. Status group filter — statusGroup ('all' | 'open' | 'closed')
 *   5. Priority filter     — selectedPriority
 *   6. Search filter       — debouncedQuery (title, description, number)
 *   7. Sort                — sortBy ('date_desc' | 'date_asc' | 'priority_asc' | 'priority_desc')
 */
export function useRequestFilters({ issues, currentUser, projects, units, role }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [statusGroup, setStatusGroup] = useState('all');       // 'all' | 'open' | 'closed'
  const [selectedPriority, setSelectedPriority] = useState(''); // '' = tümü
  const [sortBy, setSortBy] = useState('date_desc');            // default: en yeni önce

  // Debounce: update debouncedQuery 300ms after searchQuery changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Step 1: Permission layer — must always be first
  const visibleRequests = useMemo(
    () => getVisibleRequests(issues, currentUser, projects),
    [issues, currentUser, projects]
  );

  // Step 2: Role-based filtering
  const roleFilteredRequests = useMemo(() => {
    let result = visibleRequests;

    // System_Admin tüm talepleri görür
    // Diğer tüm roller (Department_Head, Project_Manager, Worker, External_User)
    // sadece kendi açtıkları talepleri görür — getVisibleRequests zaten bunu sağlar
    // Department_Head ve Project_Manager için ek proje/birim filtresi uygulanmaz

    return result;
  }, [visibleRequests, role, projects, currentUser]);

  // Derive available units from role-filtered requests (not all units)
  const availableUnits = useMemo(() => {
    const unitCodes = [...new Set(roleFilteredRequests.map(r => r.unitCode).filter(Boolean))];
    return units.filter(u => unitCodes.includes(u.unitCode));
  }, [roleFilteredRequests, units]);

  // Step 3: Unit filter
  const unitFilteredRequests = useMemo(() => {
    if (!selectedUnitId) return roleFilteredRequests;
    const selectedUnit = units.find(u => u.id === selectedUnitId);
    if (!selectedUnit) return roleFilteredRequests;
    return roleFilteredRequests.filter(r => r.unitCode === selectedUnit.unitCode);
  }, [roleFilteredRequests, selectedUnitId, units]);

  // Step 4: Status group filter
  const statusFilteredRequests = useMemo(() => {
    if (statusGroup === 'open')     return unitFilteredRequests.filter(r => OPEN_STATUSES.includes(r.status));
    if (statusGroup === 'closed')   return unitFilteredRequests.filter(r => CLOSED_STATUSES.includes(r.status));
    if (statusGroup === 'rejected') return unitFilteredRequests.filter(r => REJECTED_STATUSES.includes(r.status));
    return unitFilteredRequests;
  }, [unitFilteredRequests, statusGroup]);

  // Step 5: Priority filter
  const priorityFilteredRequests = useMemo(() => {
    if (!selectedPriority) return statusFilteredRequests;
    return statusFilteredRequests.filter(r => r.priority === selectedPriority);
  }, [statusFilteredRequests, selectedPriority]);

  // Step 6: Search filter
  const searchFilteredRequests = useMemo(
    () => filterRequests(priorityFilteredRequests, debouncedQuery),
    [priorityFilteredRequests, debouncedQuery]
  );

  // Step 7: Sort
  const filteredRequests = useMemo(() => {
    const sorted = [...searchFilteredRequests];
    if (sortBy === 'date_desc') {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'date_asc') {
      sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'priority_asc') {
      // Highest → Lowest
      sorted.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
    } else if (sortBy === 'priority_desc') {
      // Lowest → Highest
      sorted.sort((a, b) => PRIORITY_ORDER.indexOf(b.priority) - PRIORITY_ORDER.indexOf(a.priority));
    }
    return sorted;
  }, [searchFilteredRequests, sortBy]);

  return {
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
    resultCount: filteredRequests.length,
  };
}
