import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { TbUsersGroup } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../constants';
import { timeAgo } from '../../utils/dateUtils';
import Avatar from '../common/Avatar';
import { SlaPill } from '../dashboard/DashboardKit';

/**
 * A draggable issue card for the Kanban board.
 *
 * @param {Object}   props
 * @param {Object}   props.issue   - Issue object
 * @param {number}   props.index   - Position within the Droppable list
 * @param {Function} props.onClick - Called when the card is clicked
 */
function IssueCard({ issue, index, onClick, readonly = false }) {
  const { state } = useAppContext();
  const assignee = state.users.find(u => u.id === issue.assigneeId);
  const issueKey = issue.number || `#${issue.id.slice(0, 6)}`;

  return (
    <Draggable draggableId={issue.id} index={index} isDragDisabled={readonly}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`kb-card ${snapshot.isDragging ? 'kb-card--dragging' : ''}`}
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
          aria-label={`${issueKey}: ${issue.title}`}
          style={{
            ...provided.draggableProps.style,
            cursor: readonly ? 'default' : 'pointer',
            userSelect: 'none',
            opacity: readonly ? 0.85 : 1,
          }}
        >
          <div className="kb-card__top">
            <span className="kb-card__key">{issueKey}</span>
            <SlaPill issue={issue} />
          </div>

          <p className="kb-card__title">{issue.title}</p>

          {/* Rejection reason (if rejected) */}
          {issue.status === 'Geri Çevrildi' && issue.rejectionReason && (
            <div className="mb-2 small fst-italic" style={{ color: 'var(--danger)' }}>🚫 {issue.rejectionReason}</div>
          )}

          <div className="kb-card__foot">
            <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
              <span className="d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}
                title={`${PRIORITY_LABELS[issue.priority]} öncelik`}>
                <span className="ds-dot" style={{ background: PRIORITY_COLORS[issue.priority] }} />
                {PRIORITY_LABELS[issue.priority]}
              </span>
              {issue.requestFormName ? (
                <span className="ds-pill text-truncate" style={{ background: 'var(--navy-soft)', color: 'var(--navy)', maxWidth: 120 }}>
                  {issue.requestFormName}
                </span>
              ) : (
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{timeAgo(issue.createdAt)}</span>
              )}
            </div>

            {assignee ? (
              <span title={assignee.name}><Avatar name={assignee.name} color={assignee.avatarColor} size={24} /></span>
            ) : issue.assigneeTeamId ? (
              <span className="ds-kpi__icon" title="Ekibe atandı" style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <TbUsersGroup size={14} />
              </span>
            ) : (
              <span className="ds-pill" style={{ background: 'var(--orange-soft)', color: 'var(--orange)', padding: '1px 7px' }}>Atanmamış</span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default IssueCard;
