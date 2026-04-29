import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * A portal-based modal dialog with accessibility support.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen      - Whether the modal is visible
 * @param {Function} props.onClose     - Callback to close the modal
 * @param {string}   props.title       - Modal heading text
 * @param {React.ReactNode} props.children - Modal body content
 * @param {string}   [props.size]      - Bootstrap modal size: 'sm' | 'lg' | 'xl'
 * @param {string}   [props.id]        - Optional id for aria-labelledby
 */
function Modal({ isOpen, onClose, title, children, size = '', id = 'modal-title' }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizeClass = size ? `modal-${size}` : '';

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${sizeClass}`}>
          <div className="modal-content">
            {/* Header */}
            <div className="modal-header">
              <h5 className="modal-title" id={id}>
                {title}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label="Kapat"
              />
            </div>

            {/* Body */}
            <div className="modal-body">{children}</div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default Modal;
