import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { STATUS_COLORS, STATUS_LABELS } from '../../constants';
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
  const accentColor = STATUS_COLORS[status] === '#DFE1E6' ? '#94a3b8' : (STATUS_COLORS[status] || '#94a3b8');

  return (
    <div className="kb-col">
      <div className="kb-col__head">
        <span className="ds-dot" style={{ background: accentColor, width: 9, height: 9 }} />
        <span className="kb-col__title text-truncate">{STATUS_LABELS[status] || status}</span>
        <span className="ds-count ms-auto" aria-label={`${issues.length} kayıt`}>{issues.length}</span>
      </div>

      <Droppable droppableId={status} isDropDisabled={readonly}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`kb-col__body ${snapshot.isDraggingOver ? 'kb-col__body--over' : ''}`}
            aria-label={`${STATUS_LABELS[status] || status} sütunu`}
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
            {issues.length === 0 && !snapshot.isDraggingOver && (
              <div className="kb-col__empty">{readonly ? 'Kayıt yok' : 'Buraya sürükleyin'}</div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default BoardColumn;
