import React, { useState } from 'react';
import { TbPlus } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { ACTIONS } from '../../constants';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import EmptyState from '../common/EmptyState';
import Modal from '../common/Modal';
import IssueForm from '../issue/IssueForm';
import IssueModal from '../issue/IssueModal';
import RequestDetailModal from '../request/RequestDetailModal';

function BacklogView({ projectId }) {
  const { state, dispatch } = useAppContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  const backlogIssues = state.issues.filter(
    i => i.projectId === projectId && !i.sprintId && i.status !== 'Geri Çevrildi'
  );

  const availableSprints = state.sprints.filter(
    s => s.projectId === projectId && s.status !== 'Completed'
  );

  function handleIssueClick(issue) {
    if (issue.isRequest) {
      setSelectedRequestId(issue.id);
    } else {
      setSelectedIssueId(issue.id);
    }
  }

  function handleAssignToSprint(issueId, sprintId) {
    dispatch({
      type: ACTIONS.ASSIGN_ISSUE_TO_SPRINT,
      payload: { issueId, sprintId: sprintId || null },
    });
  }

  function getAssignee(assigneeId) {
    return state.users.find(u => u.id === assigneeId);
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="fw-semibold mb-0">
          Backlog <span className="text-muted fw-normal small">({backlogIssues.length})</span>
        </h6>
        <button
          className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
          onClick={() => setShowCreateModal(true)}
        >
          <TbPlus size={14} />
          Issue Oluştur
        </button>
      </div>

      {backlogIssues.length === 0 ? (
        <EmptyState
          title="Backlog boş"
          description="Tüm issue'lar bir aya atanmış."
          action={
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}>
              Issue Oluştur
            </button>
          }
        />
      ) : (
        <ul className="list-unstyled mb-0">
          {backlogIssues.map(issue => {
            const assignee = getAssignee(issue.assigneeId);
            return (
              <li key={issue.id} className="card border-0 shadow-sm mb-2">
                <div className="card-body py-2 px-3 d-flex align-items-center gap-3 flex-wrap">
                  <PriorityIcon priority={issue.priority} size={14} className="flex-shrink-0" />
                  <button
                    className="btn btn-link p-0 text-start text-decoration-none flex-grow-1 small fw-semibold"
                    onClick={() => handleIssueClick(issue)}
                    style={{ minWidth: 0 }}
                  >
                    <span className="text-muted me-1" style={{ fontSize: '0.7rem' }}>
                      {issue.number}
                    </span>
                    {issue.title}
                    {/* Rejection reason (if rejected) */}
                    {issue.status === 'Geri Çevrildi' && issue.rejectionReason && (
                      <div className="mt-1" style={{ color: '#DE350B', fontStyle: 'italic', fontSize: '0.75rem' }}>
                        🚫 {issue.rejectionReason}
                      </div>
                    )}
                  </button>
                  {issue.isRequest && (
                    <Badge label="Talep" color="#6f42c1" className="me-1" />
                  )}
                  <Badge label="Talep" type="issueType" />
                  {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} size={22} />}
                  <select
                    className="form-select form-select-sm"
                    style={{ maxWidth: 160 }}
                    value=""
                    onChange={e => handleAssignToSprint(issue.id, e.target.value)}
                    aria-label={`${issue.title} için ay seç`}
                  >
                    <option value="" disabled>Aya ata…</option>
                    {availableSprints.map(sprint => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name} {sprint.status === 'Active' ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      )}

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

      <IssueModal
        isOpen={Boolean(selectedIssueId)}
        onClose={() => setSelectedIssueId(null)}
        issueId={selectedIssueId}
      />

      <RequestDetailModal
        isOpen={Boolean(selectedRequestId)}
        onClose={() => setSelectedRequestId(null)}
        requestId={selectedRequestId}
      />
    </div>
  );
}

export default BacklogView;
