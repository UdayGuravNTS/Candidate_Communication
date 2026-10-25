import React, { useEffect } from 'react';
import { CheckIcon, CloseIcon, FailedIcon, RefreshIcon } from './Icons';
import EmptyCandidateIllustration from './EmptyCandidateIllustration';

// "25-10-2026, 9:47 AM"  ->  { date: "25-10-2026", time: "9:47 AM" }
function getDateAndTime(item) {
  if (item.timestamp) {
    const [date, ...rest] = item.timestamp.split(',');
    return { date: date.trim(), time: rest.join(',').trim() };
  }

  // Fallback: ISO string from sentAt
  if (item.sentAt) {
    const parsed = new Date(item.sentAt);
    if (!Number.isNaN(parsed.getTime())) {
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yyyy = parsed.getFullYear();
      const time = parsed.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return { date: `${dd}-${mm}-${yyyy}`, time };
    }
  }

  return { date: 'Date unavailable', time: '' };
}

export default function CandidateDrawer({
  candidate,
  onClose,
  onRetryMessage
}) {
  useEffect(() => {
    if (!candidate) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [candidate, onClose]);

  if (!candidate) return null;

  const historyList = Array.isArray(candidate.history) ? candidate.history : [];

  const renderStatusBadge = (status) => {
    if (status === 'read' || status === 'Delivered') {
      return (
        <span className="history-status history-status-read">
          <CheckIcon size={13} />
          <span>{status === 'read' ? 'read' : 'Delivered'}</span>
        </span>
      );
    }

    if (status === 'Failed') {
      return (
        <span className="history-status history-status-failed">
          <FailedIcon size={13} />
          <span>Failed</span>
        </span>
      );
    }

    return <span className="history-status history-status-sent">{status || 'Sent'}</span>;
  };

  return (
    <div className="history-drawer-backdrop" onClick={onClose}>
      <aside
        className="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="communication-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="history-drawer-header">
          <h2 id="communication-history-title">Communication history</h2>
          <button
            type="button"
            className="history-drawer-close"
            onClick={onClose}
            aria-label="Close communication history"
          >
            <CloseIcon size={22} />
          </button>
        </header>

        <div className="history-drawer-content">
          <section className="history-candidate-info" aria-label="Candidate information">
            <p className="history-candidate-id">Candidate ID: {candidate.id}</p>
            <h3>{candidate.fullName}</h3>
            <p>{candidate.mobileNumber}</p>
            <p>{candidate.email || 'Email not provided'}</p>
          </section>

          {historyList.length === 0 ? (
            <section className="history-empty-state" aria-live="polite">
              <EmptyCandidateIllustration
                width={260}
                height={195}
                className="history-empty-illustration"
              />
              <h3>No communication history</h3>
              <p>
                You have not communicated with this candidate yet.
                <br />
                When you send them a message, it will appear here.
              </p>
            </section>
          ) : (
            <section className="history-message-list" aria-label="Messages">
              {historyList.map((item, index) => {
                const { date, time } = getDateAndTime(item);

                return (
                  <article className="history-message" key={item.id || index}>
                    <div className="history-message-heading">
                      <div className="history-message-date">
                        <span>{date}</span>
                        {time && (
                          <>
                            <span className="history-message-separator">|</span>
                            <span>{time}</span>
                          </>
                        )}
                      </div>
                      {renderStatusBadge(item.status)}
                    </div>

                    <p className="history-message-text">{item.text || item.message}</p>

                    {item.status === 'Failed' && (
                      <div className="history-failure-details">
                        <p>{item.failureReason || 'Message delivery failed.'}</p>
                        {item.canRetry !== false && (
                          <button
                            type="button"
                            className="history-retry-button"
                            onClick={() => onRetryMessage(candidate, item)}
                          >
                            <RefreshIcon size={13} />
                            <span>Retry message</span>
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}