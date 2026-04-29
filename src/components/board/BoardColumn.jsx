import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { STATUS_COLORS } from '../../constants';
import IssueCard from './IssueCard';

/**
 * A droppable board column representing a single status lane.
 *
 * @param {Object}   props
 * @param {string}   props.status   - Column status label (e.g. "To Do")
 * @param {Array}    props.issues   - Issues belonging to this column
 * @param {Function} props.onIssueClick - Called with an issue when its card is clicked
 */
function BoardColumn({ status, issues, onIssueClick, readonly = false }) {
  const accentColor = STATUS_COLORS[status] || '#DFE1E6';
  const isLight = status === 'To Do';

  return (
    <div
      className="board-column d-flex flex-column"
      style={{ minWidth: 240, flex: '1 1 0' }}
    >
      {/* Column header */}
      <div
        className="d-flex align-items-center justify-content-between px-2 py-2 rounded-top"
        style={{ backgroundColor: accentColor }}
      >
        <span
          className="fw-semibold small text-truncate"
          style={{ color: isLight ? '#42526E' : '#ffffff' }}
        >
          {status}
        </span>
        <span
          className="badge rounded-pill ms-2 flex-shrink-0"
          style={{
            backgroundColor: isLight ? '#42526E' : 'rgba(255,255,255,0.3)',
            color: '#ffffff',
            fontSize: '0.65rem',
          }}
          aria-label={`${issues.length} issue`}
        >
          {issues.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={status} isDropDisabled={readonly}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-grow-1 p-2 rounded-bottom"
            style={{
              minHeight: 120,
              backgroundColor: snapshot.isDraggingOver ? '#E8F0FE' : '#F4F5F7',
              transition: 'background-color 0.15s ease',
            }}
            aria-label={`${status} sütunu`}
          >
            {issues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                onClick={() => onIssueClick(issue)}
                readonly={readonly}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default BoardColumn;
