import React from 'react';
import { TbX } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { PRIORITIES } from '../../constants';
import Avatar from '../common/Avatar';

/**
 * Filter bar for the board: assignee avatars + priority dropdown.
 *
 * @param {Object}   props
 * @param {string|null} props.assigneeFilter    - Currently selected assignee ID
 * @param {string|null} props.priorityFilter    - Currently selected priority
 * @param {Function} props.setAssigneeFilter    - Setter for assignee filter
 * @param {Function} props.setPriorityFilter    - Setter for priority filter
 * @param {Function} props.clearFilters         - Clears all filters
 */
function BoardFilters({
  assigneeFilter,
  priorityFilter,
  setAssigneeFilter,
  setPriorityFilter,
  clearFilters,
}) {
  const { state } = useAppContext();
  const hasActiveFilter = assigneeFilter || priorityFilter;

  return (
    <div className="d-flex align-items-center gap-3 flex-wrap">
      {/* Assignee filter: avatar buttons */}
      <div className="d-flex align-items-center gap-1" role="group" aria-label="Atanan kişiye göre filtrele">
        {state.users.map((user) => (
          <button
            key={user.id}
            className="btn p-0 border-0"
            style={{
              outline: assigneeFilter === user.id ? `2px solid #0052CC` : 'none',
              outlineOffset: 2,
              borderRadius: '50%',
              opacity: assigneeFilter && assigneeFilter !== user.id ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
            onClick={() =>
              setAssigneeFilter(assigneeFilter === user.id ? null : user.id)
            }
            title={user.name}
            aria-pressed={assigneeFilter === user.id}
            aria-label={user.name}
          >
            <Avatar name={user.name} color={user.avatarColor} size={28} />
          </button>
        ))}
      </div>

      {/* Priority filter */}
      <div>
        <select
          className="form-select form-select-sm"
          value={priorityFilter ?? ''}
          onChange={(e) => setPriorityFilter(e.target.value || null)}
          aria-label="Önceliğe göre filtrele"
          style={{ minWidth: 130 }}
        >
          <option value="">Tüm Öncelikler</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Clear filters */}
      {hasActiveFilter && (
        <button
          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
          onClick={clearFilters}
          aria-label="Filtreleri temizle"
        >
          <TbX size={14} aria-hidden="true" />
          Temizle
        </button>
      )}
    </div>
  );
}

export default BoardFilters;
