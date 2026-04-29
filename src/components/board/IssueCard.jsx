import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { useAppContext } from '../../context/AppContext';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';

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
          className={`issue-card card border-0 mb-2 ${snapshot.isDragging ? 'issue-card--dragging shadow' : 'shadow-sm'}`}
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
          <div className="card-body p-2">
            {/* Request indicator strip */}
            {issue.isRequest && (
              <div
                className="mb-1"
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: '#FF8B00',
                  marginLeft: -8,
                  marginRight: -8,
                  marginTop: -8,
                }}
                aria-hidden="true"
              />
            )}

            {/* Title */}
            <p
              className="mb-2 small fw-semibold"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {issue.title}
            </p>

            {/* Footer: key, type badge, priority icon, avatar */}
            <div className="d-flex align-items-center justify-content-between gap-1">
              <div className="d-flex align-items-center gap-1 flex-wrap">
                <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                  {issueKey}
                </span>
                <Badge label={issue.type} type="issueType" />
              </div>

              <div className="d-flex align-items-center gap-1 flex-shrink-0">
                <PriorityIcon priority={issue.priority} size={14} />
                {assignee && (
                  <Avatar
                    name={assignee.name}
                    color={assignee.avatarColor}
                    size={20}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default IssueCard;
