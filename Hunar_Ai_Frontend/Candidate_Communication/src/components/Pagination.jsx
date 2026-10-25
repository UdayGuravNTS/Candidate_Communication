import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon
} from './Icons';

export default function Pagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pageSizeOptions = [5, 10, 25, 50];

  return (
    <div className="table-pagination">
      <div className="pagination-left">
        {/* Rows per page selector */}
        <div className="rows-per-page-container" ref={dropdownRef}>
          <span className="pagination-label">Rows per page:</span>
          <button
            type="button"
            className="rows-per-page-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-label="Select rows per page"
          >
            <span>{pageSize}</span>
            <ChevronDownIcon size={13} className="chevron-icon" />
          </button>

          {dropdownOpen && (
            <div className="rows-per-page-menu">
              {pageSizeOptions.map((size) => (
                <div
                  key={size}
                  className={`rows-per-page-option ${size === pageSize ? 'active' : ''}`}
                  onClick={() => {
                    onPageSizeChange(size);
                    setDropdownOpen(false);
                  }}
                >
                  {size}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Range text */}
        <span className="pagination-range-text">
          {startItem}-{endItem} of {totalItems}
        </span>

        {/* Navigation Buttons */}
        <div className="pagination-controls">
          <button
            type="button"
            className="page-nav-btn"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            title="First page"
            aria-label="First page"
          >
            <ChevronsLeftIcon size={16} />
          </button>
          <button
            type="button"
            className="page-nav-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            className="page-nav-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRightIcon size={16} />
          </button>
          <button
            type="button"
            className="page-nav-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title="Last page"
            aria-label="Last page"
          >
            <ChevronsRightIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
