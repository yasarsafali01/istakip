import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { TbPlus, TbLock } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { ACTIONS, STATUSES, ACTIVITY_TYPES, ROLES } from '../../constants';
import { generateId } from '../../utils/issueUtils';
import useIssueFilters from '../../hooks/useIssueFilters';
import BoardColumn from './BoardColumn';
import BoardFilters from './BoardFilters';
import IssueModal from '../issue/IssueModal';
import RequestDetailModal from '../request/RequestDetailModal';
import Modal from '../common/Modal';
import IssueForm from '../issue/IssueForm';
import EmptyState from '../common/EmptyState';

/**
 * Full Kanban board with drag-and-drop, filters, and issue creation.
 *
 * @param {Object}      props
 * @param {string}      props.projectId             - The project being displayed
 * @param {string|null} [props.sprintId]            - Sprint filter (null = show all)
 * @param {boolean}     [props.readonly]            - If true, disables drag-drop and editing
 * @param {string|null} [props.defaultAssigneeFilter] - Pre-select an assignee filter (e.g. for Worker view)
 */
function Board({ projectId, sprintId, readonly = false, defaultAssigneeFilter = null }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Route card clicks: requests → RequestDetailModal, others → IssueModal
  function handleIssueClick(issue) {
    if (issue.isRequest) {
      setSelectedRequestId(issue.id);
    } else {
      setSelectedIssueId(issue.id);
    }
  }

  // Determine which issues to show
  const baseIssues = state.issues.filter(issue => {
    if (issue.projectId !== projectId) return false;
    if (issue.status === 'Geri Çevrildi') return false;
    if (sprintId) return issue.sprintId === sprintId;
    return true;
  });

  const {
    filteredIssues,
    assigneeFilter,
    priorityFilter,
    setAssigneeFilter,
    setPriorityFilter,
    clearFilters,
  } = useIssueFilters(baseIssues, defaultAssigneeFilter);

  function handleDragEnd(result) {
    // Disable drag-drop while a request detail modal is open
    if (selectedRequestId) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const issue = state.issues.find(i => i.id === draggableId);
    if (!issue || issue.status === newStatus) return;

    dispatch({ type: ACTIONS.MOVE_ISSUE, payload: { issueId: draggableId, newStatus } });
    dispatch({
      type: ACTIONS.ADD_ACTIVITY,
      payload: {
        id: generateId(),
        issueId: draggableId,
        userId: currentUser?.id,
        type: ACTIVITY_TYPES.STATUS_CHANGE,
        description: `Durum "${issue.status}" → "${newStatus}" olarak değiştirildi`,
        createdAt: new Date().toISOString(),
      },
    });
  }

  const currentSprint = sprintId
    ? state.sprints.find(s => s.id === sprintId)
    : state.sprints.find(s => s.projectId === projectId && s.status === 'Active');

  const showEmptySprintMessage = sprintId && baseIssues.length === 0;

  return (
    <div>
      {/* Board header */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {currentSprint && (
            <span className="badge" style={{ backgroundColor: '#E3FCEF', color: '#006644' }}>
              {currentSprint.name}
            </span>
          )}
          {readonly && (
            <span className="badge d-flex align-items-center gap-1"
              style={{ background: '#DEEBFF', color: '#0747A6', fontSize: '0.72rem' }}>
              <TbLock size={12} /> Salt Okunur
            </span>
          )}
          <BoardFilters
            projectId={projectId}
            assigneeFilter={assigneeFilter}
            priorityFilter={priorityFilter}
            setAssigneeFilter={setAssigneeFilter}
            setPriorityFilter={setPriorityFilter}
            clearFilters={clearFilters}
          />
        </div>
        {!readonly && currentUser?.role !== ROLES.WORKER && (
          <button
            className="btn btn-sm btn-primary d-flex align-items-center gap-1"
            onClick={() => setShowCreateModal(true)}
          >
            <TbPlus size={16} aria-hidden="true" />
            Issue Oluştur
          </button>
        )}
      </div>

      {/* Empty state when no sprint is active */}
      {!sprintId && !currentSprint && (
        <EmptyState
          title="Aktif ay bulunmuyor"
          description="Backlog sayfasından bir ay başlatın."
        />
      )}

      {showEmptySprintMessage && (
        <EmptyState
          title="Bu ayda issue yok"
          description="Backlog'dan issue atayabilirsiniz."
        />
      )}

      {/* Kanban columns */}
      {(sprintId || currentSprint) && !showEmptySprintMessage && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="d-flex gap-3 overflow-auto pb-3" style={{ alignItems: 'flex-start' }}>
            {STATUSES.filter(s => s !== 'Geri Çevrildi').map(status => {
              const columnIssues = filteredIssues.filter(i => i.status === status);
              return (
                <BoardColumn
                  key={status}
                  status={status}
                  issues={columnIssues}
                  onIssueClick={handleIssueClick}
                  readonly={readonly || !!selectedRequestId}
                />
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Issue detail modal — readonly if sprint is completed */}
      <IssueModal
        isOpen={Boolean(selectedIssueId)}
        onClose={() => setSelectedIssueId(null)}
        issueId={selectedIssueId}
        readonly={readonly}
      />

      {/* Request detail modal */}
      <RequestDetailModal
        isOpen={Boolean(selectedRequestId)}
        onClose={() => setSelectedRequestId(null)}
        requestId={selectedRequestId}
        onCloneSuccess={(newId) => {
          setSelectedRequestId(null);
          // Open the newly cloned request
          setTimeout(() => setSelectedRequestId(newId), 50);
        }}
      />

      {/* Create issue modal */}
      {!readonly && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Yeni Issue Oluştur"
          size="lg"
        >
          <IssueForm
            projectId={projectId}
            onSuccess={() => setShowCreateModal(false)}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}

export default Board;
