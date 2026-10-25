import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function DeleteCandidateModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCandidates = []
}) {
  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const candidateCount = selectedCandidates.length;

  const candidateLabel = candidateCount === 1 ? 'Candidate' : 'Candidates';
  const confirmationDescription =
    candidateCount === 1
      ? `This action cannot be undone, and you'll lose all communication history with ${selectedCandidates[0].fullName}.`
      : `This action cannot be undone, and you'll lose all communication history with these candidates.`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="delete-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-modal-header">
          <h2 className="delete-modal-title" id="delete-modal-title">Delete Candidate</h2>
          <button
            type="button"
            className="delete-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="delete-modal-body">
          <p className="delete-modal-question">
            Are you sure you want to delete {candidateCount} {candidateLabel}?
          </p>
          <p className="delete-modal-desc">
            {confirmationDescription}
          </p>
        </div>

        <div className="delete-modal-footer">
          <button
            type="button"
            className="btn-modal-cancel"
            onClick={onClose}
          >
            CANCEL
          </button>
          <button
            type="button"
            className="btn-delete-confirm-solid"
            onClick={onConfirm}
          >
            DELETE {candidateCount} {candidateLabel.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
