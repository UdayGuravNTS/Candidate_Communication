import React, { useState, useMemo, useCallback, useEffect } from 'react';
import HeaderActions from '../components/HeaderActions';
import CandidateTable from '../components/CandidateTable';
import Pagination from '../components/Pagination';
import AddCandidateModal from '../components/AddCandidateModal';
import DeleteCandidateModal from '../components/DeleteCandidateModal';
import SendMessageModal from '../components/SendMessageModal';
import CandidateDrawer from '../components/CandidateDrawer';
import ProviderHealthModal from '../components/ProviderHealthModal';
import Toast from '../components/Toast';
import CandidateApi from '../services/candidateApi';

export default function CandidateCommunicationPage() {
  // candidates = ONLY the current page returned by the server
  const [candidates, setCandidates] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const [candidateLoadError, setCandidateLoadError] = useState('');
  const [candidateReloadToken, setCandidateReloadToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Templates & Provider Health state
  const [templates, setTemplates] = useState([]);
  const [providerHealth, setProviderHealth] = useState(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isTogglingOutage, setIsTogglingOutage] = useState(false);

  // Pagination state
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals & Drawer state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSendMessageModalOpen, setIsSendMessageModalOpen] = useState(false);
  const [activeCandidateDrawer, setActiveCandidateDrawer] = useState(null);
  const [toast, setToast] = useState(null);

  const [isSending, setIsSending] = useState(false);

  // Initial load of Templates and Provider Health
  useEffect(() => {
    CandidateApi.getTemplates()
      .then((data) => setTemplates(data))
      .catch(() => {});

    CandidateApi.getProviderHealth()
      .then((health) => setProviderHealth(health))
      .catch(() => {});
  }, []);


  // Wait 400ms after typing stops before calling the API
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch from the server whenever page, size, search or status filter changes
  useEffect(() => {
    let isCurrentRequest = true;
    setIsLoadingCandidates(true);
    setCandidateLoadError('');

    CandidateApi.getCandidates({
      page: currentPage,
      pageSize,
      search: debouncedSearch,
      status: statusFilter,
    })
      .then(({ candidates: loaded, totalCount: total }) => {
        if (!isCurrentRequest) return;
        setCandidates(loaded);
        setTotalCount(total);
      })
      .catch((error) => {
        if (isCurrentRequest) {
          setCandidateLoadError(
            error instanceof Error ? error.message : 'Unable to load candidates.'
          );
        }
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingCandidates(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [currentPage, pageSize, debouncedSearch, statusFilter, candidateReloadToken]);


  // Only poll if there is an active transient background dispatch in progress (Sending)
  const IN_FLIGHT = useMemo(() => ['Sending'], []);

  const hasInFlight = useMemo(
    () =>
      candidates.some((c) => IN_FLIGHT.includes(c.status)) ||
      (activeCandidateDrawer?.history || []).some((m) => IN_FLIGHT.includes(m.status)),
    [candidates, activeCandidateDrawer, IN_FLIGHT]
  );

  useEffect(() => {
    if (!hasInFlight) return undefined;

    const timer = setInterval(async () => {
      try {
        const { candidates: fresh, totalCount: total } = await CandidateApi.getCandidates({
          page: currentPage,
          pageSize,
          search: debouncedSearch,
          status: statusFilter,
        });
        setCandidates(fresh);
        setTotalCount(total);
        setActiveCandidateDrawer((prev) =>
          prev ? fresh.find((c) => c.id === prev.id) || prev : prev
        );
      } catch {
        // ignore polling errors silently
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [hasInFlight, currentPage, pageSize, debouncedSearch, statusFilter]);
  

  const reloadCandidates = () => setCandidateReloadToken((prev) => prev + 1);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleToggleOutage = async (newDown) => {
    setIsTogglingOutage(true);
    try {
      const updatedHealth = await CandidateApi.toggleProviderOutage(newDown);
      setProviderHealth(updatedHealth);
      showToast(
        newDown
          ? 'Provider outage simulated. Service is now offline.'
          : 'Provider service restored. All channels operational.',
        newDown ? 'error' : 'success'
      );
    } catch {
      showToast('Failed to toggle provider outage mode.', 'error');
    } finally {
      setIsTogglingOutage(false);
    }
  };

  const handleRefreshHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const h = await CandidateApi.getProviderHealth();
      setProviderHealth(h);
      showToast('Provider health updated.');
    } catch {
      showToast('Unable to check provider health.', 'error');
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const handleReloadTemplates = async () => {
    try {
      const tpls = await CandidateApi.getTemplates();
      setTemplates(tpls);
    } catch {
      // quiet fail
    }
  };


  // Sort the current page's rows (client side)
  const sortedCandidates = useMemo(() => {
    if (!sortConfig.key) return candidates;

    return [...candidates].sort((a, b) => {
      const valA = (a[sortConfig.key] || '').toString().toLowerCase();
      const valB = (b[sortConfig.key] || '').toString().toLowerCase();
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [candidates, sortConfig]);

  // Reset to page 1 when search / filter / page size changes
  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleRetryLoadCandidates = () => {
    reloadCandidates();
  };

  const handleStatusFilterChange = (st) => {
    setStatusFilter(st);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Sorting (no server call, so no page reset)
  const handleSort = (columnKey) => {
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key: columnKey, direction: 'asc' };
    });
  };

  // Selection
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = candidates.map((c) => c.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Add Candidate
  const handleAddCandidate = async (candidateInput) => {
    const createdCandidate = await CandidateApi.createCandidate(candidateInput);
    setCurrentPage(1);
    reloadCandidates(); // reload so count and order come from the server
    showToast(`Added candidate "${createdCandidate.fullName}" successfully!`);
  };

  // Delete Selected Candidates - opens confirmation modal
  // const handleDeleteSelected = () => {
  //   if (selectedIds.length === 0) {
  //     const defaultCandidate = candidates[0];
  //     if (defaultCandidate) {
  //       setSelectedIds([defaultCandidate.id]);
  //     }
  //   }
  //   setIsDeleteModalOpen(true);
  // };

  // const handleConfirmDelete = async () => {
  //   let idsToDelete = selectedIds;
  //   if (idsToDelete.length === 0) {
  //     const defaultCandidate = candidates[0];
  //     if (defaultCandidate) {
  //       idsToDelete = [defaultCandidate.id];
  //     }
  //   }

  //   const results = await Promise.allSettled(
  //     idsToDelete.map((candidateId) => CandidateApi.deleteCandidate(candidateId))
  //   );
  //   const deletedIds = idsToDelete.filter((_, index) => results[index].status === 'fulfilled');
  //   const failedCount = results.length - deletedIds.length;

  //   setSelectedIds([]);
  //   setIsDeleteModalOpen(false);

  //   // If the whole page was deleted, go back one page
  //   if (deletedIds.length >= candidates.length && currentPage > 1) {
  //     setCurrentPage((prev) => prev - 1);
  //   } else {
  //     reloadCandidates();
  //   }

  //   if (failedCount > 0) {
  //     showToast(
  //       `Could not delete ${failedCount} candidate${failedCount > 1 ? 's' : ''}.`,
  //       'error'
  //     );
  //   } else if (deletedIds.length > 0) {
  //     showToast(
  //       `Deleted ${deletedIds.length} candidate${deletedIds.length > 1 ? 's' : ''} successfully.`
  //     );
  //   }
  // };


  // Delete button: only opens the modal if rows are selected
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      showToast('Please select at least one candidate to delete.', 'error');
      return;
    }
    setIsDeleteModalOpen(true);
  };

  // Confirm in the modal: delete ONLY the selected rows
  const handleConfirmDelete = async () => {
    const idsToDelete = [...selectedIds];
    if (idsToDelete.length === 0) {
      setIsDeleteModalOpen(false);
      return;
    }

    const results = await Promise.allSettled(
      idsToDelete.map((candidateId) => CandidateApi.deleteCandidate(candidateId))
    );

    const deletedIds = idsToDelete.filter((_, index) => results[index].status === 'fulfilled');
    const failedCount = idsToDelete.length - deletedIds.length;

    // Remove deleted ids from the selection (failed ones stay selected)
    setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
    setIsDeleteModalOpen(false);

    // Close the drawer if the open candidate was deleted
    if (activeCandidateDrawer && deletedIds.includes(activeCandidateDrawer.id)) {
      setActiveCandidateDrawer(null);
    }

    // If every row on this page was deleted, go back one page, otherwise reload
    const deletedOnThisPage = candidates.filter((c) => deletedIds.includes(c.id)).length;
    if (deletedOnThisPage > 0 && deletedOnThisPage >= candidates.length && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    } else {
      reloadCandidates();
    }

    if (failedCount > 0) {
      showToast(
        `Could not delete ${failedCount} candidate${failedCount > 1 ? 's' : ''}.`,
        'error'
      );
    } else {
      showToast(
        `Deleted ${deletedIds.length} candidate${deletedIds.length > 1 ? 's' : ''} successfully.`
      );
    }
  };



  // Delete Single Candidate
  const handleDeleteSingle = (id) => {
    setSelectedIds([id]);
    setIsDeleteModalOpen(true);
  };

  // const handleSendMessage = () => {
  //   showToast('Messaging is not configured. No messages were sent.', 'error');
  // };

  
  //   const handleSendMessage = async (payload) => {
  //   setIsSending(true);
  //   try {
  //     const updatedCandidates = await CandidateApi.sendMessage(payload);

  //     setIsSendMessageModalOpen(false);
  //     setSelectedIds([]);
  //     reloadCandidates(); // table shows the new lastMessage and status

  //     // Keep the open drawer in sync
  //     if (activeCandidateDrawer) {
  //       const updatedActive = updatedCandidates.find((c) => c.id === activeCandidateDrawer.id);
  //       if (updatedActive) setActiveCandidateDrawer(updatedActive);
  //     }

  //     showToast(
  //       `Message saved to ${updatedCandidates.length} candidate${updatedCandidates.length > 1 ? 's' : ''} communication history.`
  //     );
  //   } catch (error) {
  //     showToast(error instanceof Error ? error.message : 'Unable to send message.', 'error');
  //     throw error; // lets the modal keep the typed message
  //   } finally {
  //     setIsSending(false);
  //   }
  // };
  
    const handleSendMessage = async (payload) => {
    setIsSending(true);
    try {
      const outcome = await CandidateApi.sendMessage(payload);
      const { summary, candidates: updated } = outcome;

      setSelectedIds([]);
      reloadCandidates();

      if (activeCandidateDrawer) {
        const fresh = updated.find((c) => c.id === activeCandidateDrawer.id);
        if (fresh) setActiveCandidateDrawer(fresh);
      }

      if (summary.scheduled && summary.scheduled > 0) {
        showToast(`Message scheduled for ${summary.scheduled} candidate${summary.scheduled === 1 ? '' : 's'}.`);
      } else if (summary.queued > 0) {
        showToast(`Message queued for ${summary.queued} candidate${summary.queued === 1 ? '' : 's'}.`);
      } else if (summary.failed === 0) {
        showToast(`Message sent to ${summary.sent} candidate${summary.sent > 1 ? 's' : ''}.`);
      } else if (summary.sent === 0) {
        showToast(
          `Message failed for ${summary.failed} candidate${summary.failed > 1 ? 's' : ''}. Failed messages can be retried from communication history.`,
          'error'
        );
      } else {
        showToast(
          `Sent to ${summary.sent}; failed for ${summary.failed}. Failed messages can be retried from communication history.`,
          'error'
        );
      }

      return outcome;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to send message.', 'error');
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryMessage = async (candidate, item) => {
    try {
      const { candidate: updated, message, ok } = await CandidateApi.retryMessage(item.id);
      setActiveCandidateDrawer(updated);
      reloadCandidates();
      showToast(message, ok ? 'success' : 'error');

      CandidateApi.getProviderHealth()
        .then((h) => setProviderHealth(h))
        .catch(() => {});
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to retry message.', 'error');
    }
  };

  const handleMarkRead = async (candidate, item) => {
    try {
      const { candidate: updated, message, ok } = await CandidateApi.markMessageRead(item.id);
      setActiveCandidateDrawer(updated);
      reloadCandidates();
      showToast(message || 'Message status updated to read.', ok ? 'success' : 'error');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to mark message as read.', 'error');
    }
  };

  // Auto-refresh data when the recruiter returns to this tab (e.g. after reading email in Gmail)
  useEffect(() => {
    const handleWindowFocus = () => {
      CandidateApi.getCandidates({
        page: currentPage,
        pageSize,
        search: debouncedSearch,
        status: statusFilter,
      })
        .then(({ candidates: fresh, totalCount: total }) => {
          setCandidates(fresh);
          setTotalCount(total);
          setActiveCandidateDrawer((prev) =>
            prev ? fresh.find((c) => c.id === prev.id) || prev : prev
          );
        })
        .catch(() => {});
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [currentPage, pageSize, debouncedSearch, statusFilter]);

  const selectedCandidates = useMemo(() => {
    return candidates.filter((c) => selectedIds.includes(c.id));
  }, [candidates, selectedIds]);

  const modalCandidates =
    selectedCandidates.length > 0
      ? selectedCandidates
      : candidates.length > 0
      ? [candidates[0]]
      : [];

  return (
    <div className="candidate-communication-page">
      {/* Top Header & Actions Bar */}
      <HeaderActions
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCount={selectedIds.length}
        onAddCandidate={() => setIsAddModalOpen(true)}
        onDeleteSelected={handleDeleteSelected}
        onSendMessage={() => setIsSendMessageModalOpen(true)}
        onOpenHealth={() => setIsHealthModalOpen(true)}
        providerHealth={providerHealth}
      />

      {/* Data Table */}
      <div className="table-card">
        {isLoadingCandidates ? (
          <div className="candidate-load-state" role="status">Loading candidates...</div>
        ) : candidateLoadError ? (
          <div className="candidate-load-state" role="alert">
            <span>{candidateLoadError}</span>
            <button type="button" onClick={handleRetryLoadCandidates}>Try again</button>
          </div>
        ) : (
          <CandidateTable
            candidates={sortedCandidates}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onCandidateClick={(candidate) => setActiveCandidateDrawer(candidate)}
            sortConfig={sortConfig}
            onSort={handleSort}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
          />
        )}

        {/* Pagination - uses the total count from Django */}
        {!isLoadingCandidates && !candidateLoadError && totalCount > 0 && (
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalCount}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* Add Candidate Modal */}
      <AddCandidateModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddCandidate}
      />

      {/* Delete Candidate Confirmation Modal */}
      <DeleteCandidateModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        selectedCandidates={modalCandidates}
      />

      {/* Send Message Modal */}
      <SendMessageModal
        isOpen={isSendMessageModalOpen}
        onClose={() => setIsSendMessageModalOpen(false)}
        selectedCandidates={selectedCandidates}
        onSend={handleSendMessage}
        isSending={isSending}
        templates={templates}
        onReloadTemplates={handleReloadTemplates}
        providerHealth={providerHealth}
      />

      {/* Candidate Profile Details & History Drawer */}
      <CandidateDrawer
        candidate={activeCandidateDrawer}
        onClose={() => setActiveCandidateDrawer(null)}
        onDelete={handleDeleteSingle}
        onSendMessage={(cList) => {
          setSelectedIds(cList.map((c) => c.id));
          setIsSendMessageModalOpen(true);
        }}
        onRetryMessage={handleRetryMessage}
        onMarkRead={handleMarkRead}
        providerHealth={providerHealth}
      />

      {/* Provider Health Modal */}
      <ProviderHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        health={providerHealth}
        isLoading={isLoadingHealth}
        onRefresh={handleRefreshHealth}
        onToggleOutage={handleToggleOutage}
        isTogglingOutage={isTogglingOutage}
      />

      {/* Feedback Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}