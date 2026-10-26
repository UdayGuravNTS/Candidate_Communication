import React, { useState } from 'react';
import {
  FilterIcon,
  CheckIcon,
  FailedIcon,
  SortAscIcon,
  SortDescIcon
} from './Icons';
import { IoFilter } from "react-icons/io5";
import { FiClock } from "react-icons/fi";
import EmptyCandidateIllustration from './EmptyCandidateIllustration';

export default function CandidateTable({
  candidates,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onCandidateClick,
  sortConfig,
  onSort,
  statusFilter,
  onStatusFilterChange
}) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const allVisibleSelected =
    candidates.length > 0 && candidates.every((c) => selectedIds.includes(c.id));
  const isPartiallySelected =
    candidates.some((c) => selectedIds.includes(c.id)) && !allVisibleSelected;

  const renderSortIndicator = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <IoFilter  size={14} className="column-filter-icon" />;
    }
    return sortConfig.direction === 'asc' ? (
      <SortAscIcon size={14} className="column-sort-icon active" />
    ) : (
      <SortDescIcon size={14} className="column-sort-icon active" />
    );
  };

  const renderStatusBadge = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'read') {
      return (
        <span className="status-pill status-read">
          <CheckIcon size={12} className="status-icon" />
          <span>read</span>
        </span>
      );
    }
    if (s === 'failed') {
      return (
        <span className="status-pill status-failed">
          <FailedIcon size={13} className="status-icon" />
          <span>Failed</span>
        </span>
      );
    }

    if (s === 'delivered') {
      return (
        <span className="status-pill status-delivered">
          <CheckIcon size={12} className="status-icon" />
          <span>Delivered</span>
        </span>
      );
    }

    if (s === 'scheduled') {
      return (
        <span className="status-pill status-scheduled">
          <FiClock size={12} className="status-icon" />
          <span>Scheduled</span>
        </span>
      );
    }

    if (s === 'sent') {
      return (
        <span className="status-pill status-sent">
          <span>Sent</span>
        </span>
      );
    }
    return <span className="status-na">{status || 'NA'}</span>;
  };

  // Generate subtle empty row lines only when candidates exist
  const emptyRowSlots = candidates.length === 0 ? 0 : Math.max(0, 10 - candidates.length);

  return (
    <div className="table-wrapper">
      <table className="candidate-table">
        <thead>
          <tr>
            <th className="th-checkbox">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={candidates.length === 0}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = isPartiallySelected;
                    }
                  }}
                  onChange={onToggleSelectAll}
                  aria-label="Select all candidates"
                />
                <span className="custom-checkbox"></span>
              </label>
            </th>

            <th className="th-clickable" onClick={() => onSort('fullName')}>
              <div className="th-content">
                <span>Full name</span>
                {renderSortIndicator('fullName')}
              </div>
            </th>

            <th className="th-clickable" onClick={() => onSort('mobileNumber')}>
              <div className="th-content">
                <span>Mobile number</span>
                {renderSortIndicator('mobileNumber')}
              </div>
            </th>

            <th className="th-clickable" onClick={() => onSort('lastMessage')}>
              <div className="th-content">
                <span>Last message</span>
                {renderSortIndicator('lastMessage')}
              </div>
            </th>

            <th className="th-clickable th-status-header">
              <div
                className="th-content"
                onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                title="Filter or Sort by Status"
              >
                <span>Status</span>
                <span onClick={(e) => { e.stopPropagation(); onSort('status'); }}>
                  {renderSortIndicator('status')}
                </span>
              </div>

              {/* Status Filter Dropdown */}
              {filterMenuOpen && (
                <div className="status-filter-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="status-filter-header">Filter by Status</div>
                  {['all', 'Sent', 'Delivered', 'read', 'Scheduled', 'Failed', 'NA'].map((st) => (
                    <div
                      key={st}
                      className={`status-filter-option ${statusFilter === st ? 'active' : ''}`}
                      onClick={() => {
                        onStatusFilterChange(st);
                        setFilterMenuOpen(false);
                      }}
                    >
                      {st === 'all' ? 'All Statuses' : st}
                    </div>
                  ))}
                </div>
              )}
            </th>

            <th className="th-clickable" onClick={() => onSort('id')}>
              <div className="th-content">
                <span>Candidate ID</span>
                {renderSortIndicator('id')}
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          {candidates.length === 0 ? (
            <tr className="empty-state-row">
              <td colSpan="6" className="empty-state-cell">
                <div className="empty-candidates-container">
                  <EmptyCandidateIllustration width={220} height={165} className="empty-illustration" />
                  <h3 className="empty-state-heading">No candidates added</h3>
                  <p className="empty-state-subtext">When you add a candidate, they will appear here.</p>
                </div>
              </td>
            </tr>
          ) : (
            candidates.map((candidate) => {
              const isSelected = selectedIds.includes(candidate.id);
              return (
                <tr
                  key={candidate.id}
                  className={`candidate-row ${isSelected ? 'row-selected' : ''}`}
                >
                  <td className="td-checkbox">
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(candidate.id)}
                        aria-label={`Select ${candidate.fullName}`}
                      />
                      <span className="custom-checkbox"></span>
                    </label>
                  </td>

                  <td className="td-name">
                    <button
                      type="button"
                      className="candidate-name-link"
                      onClick={() => onCandidateClick(candidate)}
                      title={`View ${candidate.fullName}'s details`}
                    >
                      {candidate.fullName}
                    </button>
                  </td>

                  <td className="td-mobile">
                    {candidate.mobileNumber}
                  </td>

                  <td className="td-last-message">
                    <span className={candidate.lastMessage === 'NA' ? 'text-na' : ''}>
                      {candidate.lastMessage}
                    </span>
                  </td>

                  <td className="td-status">
                    {renderStatusBadge(candidate.status)}
                  </td>

                  <td className="td-id">
                    <span className="candidate-id-badge">{candidate.id}</span>
                  </td>
                </tr>
              );
            })
          )}

          {/* Render clean empty row guides like in the screenshot */}
          {Array.from({ length: emptyRowSlots }).map((_, index) => (
            <tr key={`empty-${index}`} className="empty-grid-row">
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
