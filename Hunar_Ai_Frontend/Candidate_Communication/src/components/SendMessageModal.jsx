import React, { useEffect, useState } from 'react';
import { CloseIcon } from './Icons';

export default function SendMessageModal({
  isOpen,
  onClose,
  selectedCandidates,
  onSend,
  isSending = false
}) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSending) {
        setMessage('');
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSending, onClose]);

  const handleClose = (force = false) => {
    if (isSending && !force) return;
    setMessage('');
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim() || selectedCandidates.length === 0) return;

    try {
      await onSend({
        channel: 'WhatsApp',
        message: message.trim(),
        candidateIds: selectedCandidates.map((candidate) => candidate.id),
        isScheduled: false,
        scheduledDate: null
      });
      handleClose(true);
    } catch {
      // toast is shown by the page; keep the typed message
    }
  };

  return (
    <div className="message-drawer-backdrop">
      <aside
        className="message-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-message-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="message-drawer-header">
          <h2 id="send-message-title">Send Message</h2>
          <button
            type="button"
            className="message-drawer-close"
            onClick={handleClose}
            aria-label="Close send message panel"
            disabled={isSending}
          >
            <CloseIcon size={22} />
          </button>
        </div>

        <form className="message-drawer-form" onSubmit={handleSubmit}>
          <div className="message-drawer-recipients">
            <p className="message-drawer-recipient-count">
              {selectedCandidates.length} Recipient{selectedCandidates.length === 1 ? '' : 's'}
            </p>
            <div className="message-drawer-recipient-list">
              {selectedCandidates.map((candidate) => (
                <span key={candidate.id} className="message-drawer-recipient">
                  {candidate.fullName}
                </span>
              ))}
            </div>
          </div>

          <div className="message-drawer-message-field">
            <label htmlFor="message-body" className="message-drawer-label">
              Message <span aria-hidden="true">*</span>
            </label>
            <p className="message-drawer-hint">Type, or paste the message you want to send.</p>
            <textarea
              id="message-body"
              className="message-drawer-textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type or paste here..."
              required
              disabled={isSending}
            />
          </div>

          <div className="message-drawer-actions">
            <button
              type="button"
              className="btn-secondary message-drawer-cancel"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="message-drawer-submit"
              disabled={isSending || !message.trim() || selectedCandidates.length === 0}
            >
              <span>{isSending ? 'Sending...' : 'Send Message'}</span>
            </button>
          </div>
        </form>
      </aside>
    </div>
  );

}
