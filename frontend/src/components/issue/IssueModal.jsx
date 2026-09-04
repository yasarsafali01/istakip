import React from 'react';
import Modal from '../common/Modal';
import IssueDetailContent from './IssueDetailContent';
import { useAppContext } from '../../context/AppContext';

/**
 * Wraps IssueDetailContent inside a large modal dialog.
 * Works for all issue types: Task, Bug, Story, Epic, Request.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen   - Whether the modal is visible
 * @param {Function} props.onClose  - Callback to close the modal
 * @param {string}   props.issueId  - ID of the issue to display
 * @param {boolean}  [props.readonly] - Disable editing
 */
function IssueModal({ isOpen, onClose, issueId, readonly = false }) {
  const { state } = useAppContext();
  const issue = state.issues.find(i => i.id === issueId);

  if (!isOpen || !issue) return null;

  const issueKey = issue.number || `#${issueId?.slice(0, 6)}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={issueKey}
      size="xl"
      id="issue-modal-title"
    >
      <IssueDetailContent issue={issue} onClose={onClose} readonly={readonly} />
    </Modal>
  );
}

export default IssueModal;
