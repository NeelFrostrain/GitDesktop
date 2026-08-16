import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  GitBranch,
  Search,
  Plus,
  Check,
  ChevronDown,
  X,
  Globe,
  Loader2,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { BranchInfo } from '../../types/git';
import { toAppError } from '../../shared/utils/errorUtils';
import { BranchCheckoutModal } from '../modals/BranchCheckoutModal';

/**
 * Dropdown component displaying current branch, local/remote branch search lists,
 * inline branch creation, and dirty working tree safe-checkout confirmation.
 */
export const BranchDropdown: React.FC = () => {
  const { activeRepoPath, status, setStatus, branches, setBranches, setError } = useGitStore();

  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  // New branch modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Pending target branch for safe checkout with uncommitted changes
  const [pendingTargetBranch, setPendingTargetBranch] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentBranch = status?.current_branch || 'main';
  const uncommittedFilesCount = status?.files?.length || 0;

  const loadBranches = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const res = await GitService.listBranches(activeRepoPath);
      setBranches(res || []);
    } catch {
      // Silently ignore background branch fetch errors
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBranches();
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, activeRepoPath]);

  // Handle click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const handleSelectBranch = (branchName: string) => {
    setIsOpen(false);
    if (branchName === currentBranch) return;

    if (uncommittedFilesCount > 0) {
      setPendingTargetBranch(branchName);
    } else {
      executeDirectCheckout(branchName);
    }
  };

  const executeDirectCheckout = async (branchName: string) => {
    if (!activeRepoPath) return;
    try {
      await GitService.checkoutBranch(activeRepoPath, branchName);
      useLogStore.getState().addLog('success', 'Git', `Checked out branch '${branchName}'`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadBranches();
    } catch (error: unknown) {
      setError(toAppError(error, 'CHECKOUT_ERROR'));
    }
  };

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !newBranchName.trim()) return;
    setIsCreating(true);

    try {
      await GitService.createBranch(activeRepoPath, newBranchName.trim());
      useLogStore.getState().addLog('success', 'Git', `Created branch '${newBranchName.trim()}' and checked out`);
      setNewBranchName('');
      setShowCreateModal(false);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadBranches();
    } catch (error: unknown) {
      setError(toAppError(error, 'CREATE_BRANCH_ERROR'));
    } finally {
      setIsCreating(false);
    }
  };

  // Branch Filtering
  const queryLower = filterQuery.trim().toLowerCase();

  const localBranches = useMemo(() => {
    return branches
      .filter((b: BranchInfo) => !b.is_remote)
      .filter((b: BranchInfo) => b.name.toLowerCase().includes(queryLower));
  }, [branches, queryLower]);

  const remoteBranches = useMemo(() => {
    return branches
      .filter((b: BranchInfo) => b.is_remote)
      .filter((b: BranchInfo) => b.name.toLowerCase().includes(queryLower));
  }, [branches, queryLower]);

  const menuWidth = 320;
  const leftPos = triggerRect
    ? Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - 12)
    : 0;
  const topPos = triggerRect ? triggerRect.bottom + 6 : 0;

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="px-2.5 py-1 rounded-md bg-base-2 hover:bg-base-3 border border-border text-text-primary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer select-none"
        title={`Current branch: ${currentBranch}`}
      >
        <GitBranch className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
        <span className="truncate max-w-[130px] font-mono">{currentBranch}</span>
        <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
      </button>

      {/* Dropdown Menu Portal */}
      {isOpen &&
        triggerRect &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              left: `${leftPos}px`,
              top: `${topPos}px`,
              width: `${menuWidth}px`,
            }}
            className="fixed z-[9999] bg-base-1 border border-border rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[460px] text-xs font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {/* Header Bar */}
            <div className="px-3 py-2 border-b border-border bg-base-0 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-commito-coral" />
                <span className="font-extrabold text-xs text-text-primary">Switch Branch</span>
                {isLoading && <Loader2 className="w-3 h-3 text-commito-coral animate-spin ml-1" />}
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-2 py-0.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                title="Create new branch"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-2 border-b border-border bg-base-0/50 flex-shrink-0">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter branches..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1 bg-base-2 border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition font-mono"
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    className="absolute right-2 text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Branch List */}
            <div className="flex-1 overflow-y-auto py-1 space-y-2 min-h-0">
              {/* Local Branches Section */}
              <div>
                <div className="px-3 pt-1.5 pb-1 select-none flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                    LOCAL BRANCHES
                  </span>
                  <span className="text-[10px] font-mono text-text-muted bg-base-2 px-1.5 py-0.2 rounded border border-border">
                    {localBranches.length}
                  </span>
                </div>

                {localBranches.length === 0 ? (
                  <div className="px-3 py-2 text-text-muted text-[11px] italic">
                    {filterQuery ? 'No local branches match search.' : 'No local branches.'}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {localBranches.map((branchItem: BranchInfo) => {
                      const isCurrent = branchItem.name === currentBranch;
                      return (
                        <div
                          key={branchItem.name}
                          onClick={() => handleSelectBranch(branchItem.name)}
                          className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 mx-1.5 rounded-md cursor-pointer transition ${
                            isCurrent
                              ? 'bg-commito-activeBg text-commito-activeText font-semibold border border-commito-coral/30'
                              : 'hover:bg-base-2 text-text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GitBranch
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isCurrent ? 'text-commito-coral' : 'text-text-muted group-hover:text-text-secondary'
                              }`}
                            />
                            <span className="truncate text-xs font-mono">{branchItem.name}</span>
                          </div>

                          {isCurrent && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-commito-coral/20 text-commito-coral border border-commito-coral/30">
                                CURRENT
                              </span>
                              <Check className="w-3.5 h-3.5 text-commito-coral" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Remote Branches Section */}
              {remoteBranches.length > 0 && (
                <div className="pt-1 border-t border-border/40">
                  <div className="px-3 pt-1.5 pb-1 select-none flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                      REMOTE BRANCHES
                    </span>
                    <span className="text-[10px] font-mono text-text-muted bg-base-2 px-1.5 py-0.2 rounded border border-border">
                      {remoteBranches.length}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {remoteBranches.map((remoteBranchItem: BranchInfo) => (
                      <div
                        key={remoteBranchItem.name}
                        onClick={() => handleSelectBranch(remoteBranchItem.name)}
                        className="group flex items-center gap-2 px-2.5 py-1.5 mx-1.5 rounded-md hover:bg-base-2 text-text-primary cursor-pointer transition"
                      >
                        <Globe className="w-3.5 h-3.5 text-gitlab-blue flex-shrink-0" />
                        <span className="truncate text-xs font-mono">{remoteBranchItem.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Create New Branch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center p-4 select-none font-sans">
          <form
            onSubmit={handleCreateBranchSubmit}
            className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-4 py-3 bg-base-0 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-commito-coral" />
                <h3 className="text-xs font-bold text-text-primary">Create Branch</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-text-muted block mb-1">Branch Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="feature/new-feature"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-2 border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition font-mono"
                />
              </div>
            </div>

            <div className="px-4 py-2.5 bg-base-0 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-xs font-semibold text-text-secondary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newBranchName.trim() || isCreating}
                className="px-3 py-1 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 text-white rounded text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Create & Checkout</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Uncommitted Changes Checkout Modal */}
      {pendingTargetBranch && (
        <BranchCheckoutModal
          isOpen={Boolean(pendingTargetBranch)}
          targetBranch={pendingTargetBranch}
          currentBranch={currentBranch}
          uncommittedCount={uncommittedFilesCount}
          onClose={() => setPendingTargetBranch(null)}
          onSuccess={() => {
            setPendingTargetBranch(null);
            loadBranches();
          }}
        />
      )}
    </>
  );
};
