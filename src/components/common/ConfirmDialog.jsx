import React from 'react';
import Modal from './Modal';

/**
 * A confirmation dialog built on top of Modal.
 * Typically used for destructive actions like deletion.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen        - Whether the dialog is visible
 * @param {Function} props.onClose       - Callback to cancel / close
 * @param {Function} props.onConfirm     - Callback when the user confirms
 * @param {string}   [props.title]       - Dialog heading
 * @param {string}   [props.message]     - Body message
 * @param {string}   [props.confirmText] - Label for the confirm button
 * @param {string}   [props.cancelText]  - Label for the cancel button
 * @param {string}   [props.variant]     - Bootstrap button variant for confirm (default: 'danger')
 */
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Emin misiniz?',
  message = 'Bu işlem geri alınamaz.',
  confirmText = 'Sil',
  cancelText = 'İptal',
  variant = 'danger',
}) {
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" id="confirm-dialog-title">
      <p className="mb-4">{message}</p>
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {cancelText}
        </button>
        <button
          type="button"
          className={`btn btn-${variant}`}
          onClick={handleConfirm}
          autoFocus
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
