import React from 'react';
import { FiPlus, FiTrash2, FiSearch, FiX } from 'react-icons/fi';
import { IoSend } from 'react-icons/io5';

export default function HeaderActions({
  searchTerm,
  onSearchChange,
  selectedCount,
  onAddCandidate,
  onDeleteSelected,
  onSendMessage,
  onOpenHealth,
  providerHealth
}) {
  const isDown = providerHealth?.isDown || providerHealth?.status === 'outage';

  return (
    <header className="page-header">
      <div className="page-title-wrap">
        <h1 className="page-title">Candidate communication</h1>
        <button
          type="button"
          className={`provider-health-badge ${isDown ? 'health-badge-down' : 'health-badge-operational'}`}
          onClick={onOpenHealth}
          id="btn-provider-health"
          title="Click to view Communication Service Health and Provider Metrics"
        >
          <span className={`health-dot ${isDown ? 'dot-red' : 'dot-green'}`} />
          <span className="health-badge-text">
            {isDown ? 'Service Outage' : 'Service Operational'}
          </span>
        </button>
      </div>

      <div className="header-actions">
        {/* ADD CANDIDATE */}
        <button
          type="button"
          className="btn btn-add-candidate"
          onClick={onAddCandidate}
          id="btn-add-candidate"
        >
          <FiPlus size={16} />
          <span>ADD CANDIDATE</span>
        </button>

        {/* DELETE CANDIDATE */}
        <button
          type="button"
          className={`btn ${selectedCount > 0 ? 'btn-blue-active' : 'btn-disabled'}`}
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          id="btn-delete-candidate"
          title={selectedCount > 0 ? 'Delete selected candidate(s)' : 'Select a candidate to delete'}
        >
          <FiTrash2 size={16} />
          <span>DELETE CANDIDATE</span>
        </button>

        {/* SEND MESSAGE */}
        <button
          type="button"
          className={`btn ${selectedCount > 0 ? 'btn-blue-active' : 'btn-disabled'}`}
          onClick={onSendMessage}
          disabled={selectedCount === 0}
          id="btn-send-message"
          title={selectedCount > 0 ? 'Send message to candidate(s)' : 'Select a candidate to send message'}
        >
          <IoSend size={14} />
          <span>SEND MESSAGE</span>
        </button>

        {/* SEARCH BOX */}
        <div className="search-input-wrap">
          <FiSearch size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            id="candidate-search"
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <FiX size={13} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
