import React from 'react';
import Modal from '../common/Modal';
import RequestDetailContent from './RequestDetailContent';
import { useAppContext } from '../../context/AppContext';

/**
 * Modal wrapper for the full Jira-style request detail view.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen       - Whether the modal is visible
 * @param {Function} props.onClose      - Callback to close the modal
 * @param {string}   props.requestId    - ID of the request (issue) to display
 * @param {Function} [props.onCloneSuccess] - Called with newId after a clone
 */
function RequestDetailModal({ isOpen, onClose, requestId, onCloneSuccess }) {
  const { state } = useAppContext();
  const request = state.issues.find((i) => i.id === requestId);

  if (!isOpen || !request) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={request.number}
      size="xl"
      id="request-detail-modal-title"
    >
      <RequestDetailContent
        request={request}
        onClose={onClose}
        onCloneSuccess={onCloneSuccess}
      />
    </Modal>
  );
}

export default RequestDetailModal;
