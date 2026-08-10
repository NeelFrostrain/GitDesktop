import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronsUpDown,
  Filter,
  FileText,
  GitCommit,
  GitMerge,
  Search,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';


import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { CommitInfo, RepoStatus } from '../types/git';
import { UserAvatar } from './UserAvatar';
import { CommitContextMenu } from './CommitContextMenu';
import { FileContextMenu } from './FileContextMenu';
import { Checkbox } from './Checkbox';
import { RepoDropdown } from './RepoDropdown';

export const Sidebar: React.FC = () => {
  const {
    activeRepoPath,
    status,
    setStatus,
    selectedFile,
    setSelectedFile,
    stagedFiles,
    toggleStageFile,
    setAllStaged,
    commitSummary,
    setCommitSummary,
    commitDescription,
    setCommitDescription,
    commitOptions,
    setCommitOptions,
    activeTab,

    setActiveTab,
    setCurrentNavView,
    selectedCommitSha,
    setSelectedCommitSha,
    setError,
    user,
    setPendingHistoryOp,
    setIsRewriteModalOpen,
    setIsUserConfigModalOpen,
    setPendingCommitData,
  } = useGitStore();





  const [isCommitting, setIsCommitting] = useState(false);
  const [fileFilter, setFileFilter] = useState('');
  const [commitFilter, setCommitFilter] = useState('');
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [contextMenu, setContextMenu] = useState<{ commit: CommitInfo; x: number; y: number } | null>(null);
  const [fileContextMenu, setFileContextMenu] = useState<{ filePath: string; x: number; y: number } | null>(null);
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [repoCardRect, setRepoCardRect] = useState<DOMRect | null>(null);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const commitListRef = useRef<HTMLDivElement>(null);

  // History Mouse Drag & Drop State
  const [draggedSha, setDraggedSha] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ sha: string; dropZone: 'before' | 'after' | 'merge' } | null>(null);

  const handleMouseDownOnCommit = (e: React.MouseEvent, commit: CommitInfo) => {
    if (e.button !== 0) return; // Primary click only
    const startX = e.clientX;
    const startY = e.clientY;
    let currentX = startX;
    let currentY = startY;
    let isDraggingStarted = false;
    let currentTarget: { sha: string; dropZone: 'before' | 'after' | 'merge' } | null = null;
    let animFrameId: number | null = null;

    const updateTargetFromPoint = (x: number, y: number) => {
      const elemBelow = document.elementFromPoint(x, y);
      if (!elemBelow) {
        currentTarget = null;
        setDragTarget(null);
        return;
      }

      const cardElem = elemBelow.closest('[data-commit-sha]') as HTMLElement | null;
      if (!cardElem) {
        currentTarget = null;
        setDragTarget(null);
        return;
      }

      const targetSha = cardElem.getAttribute('data-commit-sha');
      if (!targetSha || targetSha === commit.sha) {
        currentTarget = null;
        setDragTarget(null);
        return;
      }

      const rect = cardElem.getBoundingClientRect();
      const relativeY = y - rect.top;
      const ratio = relativeY / rect.height;

      let dropZone: 'before' | 'after' | 'merge' = 'merge';
      if (ratio < 0.35) {
        dropZone = 'before';
      } else if (ratio > 0.65) {
        dropZone = 'after';
      }

      currentTarget = { sha: targetSha, dropZone };
      setDragTarget(currentTarget);
    };

    const autoScrollLoop = () => {
      const container = commitListRef.current;
      if (container && isDraggingStarted) {
        const rect = container.getBoundingClientRect();
        const topThreshold = rect.top + 45;
        const bottomThreshold = rect.bottom - 45;

        let scrollDelta = 0;
        if (currentY < topThreshold) {
          scrollDelta = -Math.min(12, Math.max(3, (topThreshold - currentY) / 3));
        } else if (currentY > bottomThreshold) {
          scrollDelta = Math.min(12, Math.max(3, (currentY - bottomThreshold) / 3));
        }

        if (scrollDelta !== 0) {
          container.scrollTop += scrollDelta;
          updateTargetFromPoint(currentX, currentY);
        }
      }

      animFrameId = requestAnimationFrame(autoScrollLoop);
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      currentX = moveEvent.clientX;
      currentY = moveEvent.clientY;

      const dist = Math.hypot(currentX - startX, currentY - startY);
      if (!isDraggingStarted) {
        if (dist > 4) {
          isDraggingStarted = true;
          setDraggedSha(commit.sha);
          animFrameId = requestAnimationFrame(autoScrollLoop);
        } else {
          return;
        }
      }

      updateTargetFromPoint(currentX, currentY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }

      if (isDraggingStarted && currentTarget) {
        const sourceCommit = commit;
        const targetCommit = commits.find((c) => c.sha === currentTarget!.sha);

        if (targetCommit) {
          if (currentTarget.dropZone === 'before' || currentTarget.dropZone === 'after') {
            setPendingHistoryOp({
              type: 'reorder',
              sourceCommit,
              targetCommit,
              position: currentTarget.dropZone,
            });
            setIsRewriteModalOpen(true);
          } else if (currentTarget.dropZone === 'merge') {
            setPendingHistoryOp({
              type: 'merge',
              sourceCommit,
              targetCommit,
              newMessage: '',
            });
            setIsRewriteModalOpen(true);
          }
        }
      }

      setDraggedSha(null);
      setDragTarget(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };




  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sidebar_width');
      return saved ? Math.max(240, Math.min(520, parseInt(saved, 10))) : 320;
    } catch {
      return 320;
    }
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(240, Math.min(520, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
      } catch { }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, sidebarWidth]);

  const repoCardRef = useRef<HTMLDivElement>(null);


  const activeRepoName = activeRepoPath ? activeRepoPath.split(/[/\\]/).pop() || 'NicolasN_BunnyMP' : 'NicolasN_BunnyMP';

  const handleOpenRepoSwitcher = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (repoCardRef.current) {
      setRepoCardRect(repoCardRef.current.getBoundingClientRect());
    }
    setIsRepoDropdownOpen(!isRepoDropdownOpen);
  };


  // Sample fallback commits
  const sampleCommits: CommitInfo[] = [
    {
      sha: '2488b368a1f73b64c129e9240',
      short_sha: '2488b36',
      author_name: user?.name || 'NeelFrostrain',
      author_email: 'neelfrostrain@github.com',
      message: 'feat(auth): implement GitHub authentication and API interactions',
      timestamp: Date.now() / 1000 - 3600,
      relative_date: '1 hour ago',
    },
    {
      sha: 'e49d22340b19284cf728e9182',
      short_sha: 'e49d223',
      author_name: user?.name || 'NeelFrostrain',
      author_email: 'neelfrostrain@github.com',
      message: 'style(ui): redesign top titlebar and header controls matching CommitO',
      timestamp: Date.now() / 1000 - 7200,
      relative_date: '2 hours ago',
    },
    {
      sha: 'b069604f283818e38573b98c2',
      short_sha: 'b069604',
      author_name: user?.name || 'NeelFrostrain',
      author_email: 'neelfrostrain@github.com',
      message: 'fix(git): sanitize git remote credentials and enable dynamic basic auth',
      timestamp: Date.now() / 1000 - 14400,
      relative_date: '4 hours ago',
    },
  ];

  // Fetch commits when switching to history tab
  useEffect(() => {
    if (activeTab !== 'history') return;

    if (!activeRepoPath) {
      setCommits(sampleCommits);
      if (sampleCommits.length > 0 && !selectedCommitSha) {
        setSelectedCommitSha(sampleCommits[0].sha);
      }
      return;
    }

    invoke<CommitInfo[]>('get_commit_history', { repoPath: activeRepoPath, limit: 50, offset: 0 })
      .then((res) => {
        if (res && res.length > 0) {
          setCommits(res);
          if (!selectedCommitSha) setSelectedCommitSha(res[0].sha);
        } else {
          setCommits(sampleCommits);
        }
      })
      .catch(() => {
        setCommits(sampleCommits);
      });
  }, [activeTab, activeRepoPath]);

  const handleCommit = async () => {
    if (!activeRepoPath || !commitSummary.trim()) return;

    // Check Git user identity first
    try {
      const identity = await invoke<{ name?: string; email?: string }>('get_git_user_identity_cmd', {
        repoPath: activeRepoPath,
      });

      if (!identity?.name || !identity?.email || !identity.name.trim() || !identity.email.trim()) {
        setPendingCommitData({
          summary: commitSummary,
          description: commitDescription,
        });
        setIsUserConfigModalOpen(true);
        return;
      }
    } catch { }

    setIsCommitting(true);

    try {
      await invoke('commit_changes', {
        repoPath: activeRepoPath,
        summary: commitSummary,
        description: commitDescription || null,
        noVerify: commitOptions.bypassHooks,
        signOff: commitOptions.signOff,
        allowEmpty: commitOptions.allowEmpty,
      });

      setCommitSummary('');
      setCommitDescription('');
      useLogStore.getState().addLog('success', 'Git', `Committed: ${commitSummary}`);

      const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(res);
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    } finally {
      setIsCommitting(false);
    }
  };


  const allFiles = status?.files || [];
  const filteredFiles = allFiles.filter((f) => f.path.toLowerCase().includes(fileFilter.toLowerCase()));
  const isAllStaged = allFiles.length > 0 && stagedFiles.length === allFiles.length;
  const hasActiveOptions = commitOptions.bypassHooks || commitOptions.signOff || commitOptions.allowEmpty;
  const canCommit = Boolean(commitSummary.trim() && (stagedFiles.length > 0 || allFiles.length > 0 || commitOptions.allowEmpty));


  const filteredCommits = commits.filter(
    (c) =>
      c.message.toLowerCase().includes(commitFilter.toLowerCase()) ||
      c.author_name.toLowerCase().includes(commitFilter.toLowerCase()) ||
      c.short_sha.toLowerCase().includes(commitFilter.toLowerCase())
  );

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative h-full bg-base-0 border-r border-border flex flex-col flex-shrink-0 select-none group/sidebar"
    >
      {/* Resizable handle bar */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => setSidebarWidth(320)}
        title="Drag to resize sidebar • Double-click to reset"
        className={`absolute top-0 right-0 w-0.5 h-full cursor-col-resize z-30 transition-colors flex items-center justify-center ${isResizing ? 'bg-commito-coral' : 'hover:bg-commito-coral/60'
          }`}
      >
        <div className={`w-0.5 h-8 rounded-full transition-colors ${isResizing ? 'bg-white' : 'bg-border group-hover/sidebar:bg-commito-coral/80'
          }`} />
      </div>

      {/* Top Repo Switcher Card */}

      <div className="p-3 border-b border-border">
        <div
          ref={repoCardRef}
          onClick={handleOpenRepoSwitcher}
          className="p-2.5 bg-commito-card border border-border hover:border-border-strong rounded-md flex items-center justify-between cursor-pointer transition shadow-sm"
        >

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-text-primary truncate">{activeRepoName}</h3>
              <p className="text-[10px] text-text-muted font-mono truncate">
                {status?.current_branch || 'main'} • 1 branch
              </p>
            </div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        </div>
      </div>

      {/* Changes vs History Dual Tab Bar */}
      <div className="px-3 pt-2 pb-1 border-b border-border">
        <div className="flex items-center gap-1 bg-base-2 border border-border rounded-md p-0.5 w-full">
          <button
            onClick={() => {
              setActiveTab('changes');
              setCurrentNavView('changes');
            }}
            className={`flex-1 py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${activeTab === 'changes'
              ? 'bg-commito-activeBg text-commito-activeText shadow-sm'
              : 'text-text-muted hover:text-text-primary'
              }`}
          >
            Changes ({allFiles.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setCurrentNavView('history');
            }}
            className={`flex-1 py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${activeTab === 'history'
              ? 'bg-commito-activeBg text-commito-activeText shadow-sm'
              : 'text-text-muted hover:text-text-primary'
              }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Tab Content: Changes Tab */}
      {activeTab === 'changes' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* File Filter & Select All */}
          <div className="px-3 py-2 border-b border-border space-y-2">
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter changed files..."
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                className="w-full pl-8 pr-2 py-1 bg-base-1 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted px-1">
              <Checkbox
                checked={isAllStaged}
                indeterminate={stagedFiles.length > 0 && stagedFiles.length < allFiles.length}
                onChange={setAllStaged}
                label={`${allFiles.length} changed file${allFiles.length === 1 ? '' : 's'}`}
              />
            </div>
          </div>

          {/* Changed Files List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredFiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted italic">
                No files changed in working copy
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFile === file.path;
                const isStaged = stagedFiles.includes(file.path);
                return (
                  <div
                    key={file.path}
                    onClick={() => setSelectedFile(file.path)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedFile(file.path);
                      setFileContextMenu({ filePath: file.path, x: e.clientX, y: e.clientY });
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition ${isSelected
                      ? 'bg-commito-activeBg text-commito-activeText font-semibold border border-commito-activeText/20'
                      : 'hover:bg-base-2 text-text-secondary'
                      }`}
                  >
                    <Checkbox
                      checked={isStaged}
                      onChange={() => toggleStageFile(file.path)}
                    />
                    <FileText className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="truncate flex-1 font-mono text-[11px]">{file.path}</span>
                  </div>
                );
              })
            )}
          </div>


          {/* Commit Box at Bottom */}
          <div className="p-3 border-t border-border bg-base-1 space-y-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsUserConfigModalOpen(true)}
                title="Configure Git User Identity & Avatar"
                className="rounded-full hover:ring-2 hover:ring-commito-coral/50 transition cursor-pointer flex-shrink-0"
              >
                <UserAvatar url={user?.avatar_url} name={user?.name || user?.username} provider={user?.provider} className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
              </button>
              <input
                type="text"
                placeholder="Summary (required)"
                value={commitSummary}
                onChange={(e) => setCommitSummary(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-base-0 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
              />
            </div>

            <textarea
              placeholder="Description"
              rows={2}
              value={commitDescription}
              onChange={(e) => setCommitDescription(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-base-0 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 resize-y min-h-[48px] max-h-[160px] font-sans"
            />

            {/* Compact Controls Row above Commit Button */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1.5">
                {/* Options Menu Trigger */}
                <div className="relative" ref={optionsMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                    title="Commit Options (Bypass Hooks, Sign-off, Allow Empty)"
                    className={`px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      hasActiveOptions
                        ? 'bg-commito-coral/20 border-commito-coral text-commito-coral shadow-xs'
                        : 'bg-base-2/80 border-border hover:bg-base-3 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Options</span>
                    {hasActiveOptions && <span className="w-1.5 h-1.5 rounded-full bg-commito-coral animate-pulse" />}
                  </button>

                  {/* Options Popover Menu */}
                  {isOptionsMenuOpen && (
                    <div className="absolute left-0 bottom-full mb-1.5 w-60 bg-base-1 border border-border rounded-md shadow-2xl z-50 py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100 font-sans">
                      <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-text-muted border-b border-border mb-1">
                        Commit Options
                      </div>

                      <label className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-2 cursor-pointer text-text-primary">
                        <input
                          type="checkbox"
                          checked={commitOptions.bypassHooks}
                          onChange={(e) => setCommitOptions({ bypassHooks: e.target.checked })}
                          className="rounded border-border text-commito-coral focus:ring-0 accent-commito-coral cursor-pointer"
                        />
                        <span className="font-medium text-xs">Bypass Commit Hooks</span>
                      </label>

                      <label className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-2 cursor-pointer text-text-primary">
                        <input
                          type="checkbox"
                          checked={commitOptions.signOff}
                          onChange={(e) => setCommitOptions({ signOff: e.target.checked })}
                          className="rounded border-border text-commito-coral focus:ring-0 accent-commito-coral cursor-pointer"
                        />
                        <span className="font-medium text-xs">Add Signed-off-by Trailer</span>
                      </label>

                      <label className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-2 cursor-pointer text-text-primary">
                        <input
                          type="checkbox"
                          checked={commitOptions.allowEmpty}
                          onChange={(e) => setCommitOptions({ allowEmpty: e.target.checked })}
                          className="rounded border-border text-commito-coral focus:ring-0 accent-commito-coral cursor-pointer"
                        />
                        <span className="font-medium text-xs">Allow Empty Commit</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Clear Commit Message Button */}
                {(commitSummary || commitDescription) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCommitSummary('');
                      setCommitDescription('');
                    }}
                    title="Clear Commit Message"
                    className="p-1 rounded-md bg-base-2/80 border border-border hover:bg-base-3 text-text-muted hover:text-red-400 transition cursor-pointer text-xs flex items-center gap-1 px-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="text-[10px] font-medium">Clear</span>
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleCommit}
              disabled={!canCommit || isCommitting}
              className={`w-full py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm ${canCommit
                ? 'bg-commito-coral hover:bg-commito-coralHover text-white cursor-pointer'
                : 'bg-base-2 text-text-muted cursor-not-allowed border border-border'
                }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>
                Commit {stagedFiles.length > 0 ? `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}` : ''} to {status?.current_branch || 'main'}
              </span>
              {hasActiveOptions && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" title="Custom options active" />
              )}
            </button>
          </div>

        </div>
      ) : (

    /* Tab Content: History Tab */
    <div className="flex-1 flex flex-col min-h-0">
      {/* Commit Filter */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter commits by message or SHA..."
            value={commitFilter}
            onChange={(e) => setCommitFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-base-1 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
          />
        </div>
      </div>

      {/* Commit Timeline List */}
      <div ref={commitListRef} className="flex-1 overflow-y-auto p-2 space-y-1">

        {filteredCommits.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted italic">
            No commits match filter
          </div>
        ) : (
          filteredCommits.map((c) => {
            const isSelected = selectedCommitSha === c.sha;
            const isDragging = draggedSha === c.sha;
            const isTarget = dragTarget?.sha === c.sha;
            const dropZone = isTarget ? dragTarget.dropZone : null;

            return (
              <div
                key={c.sha}
                data-commit-sha={c.sha}
                onMouseDown={(e) => handleMouseDownOnCommit(e, c)}
                onClick={() => {
                  setSelectedCommitSha(c.sha);
                  setCurrentNavView('history');
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedCommitSha(c.sha);
                  setContextMenu({ commit: c, x: e.clientX, y: e.clientY });
                }}
                className={`p-2.5 rounded-md cursor-pointer transition-all border relative select-none ${isDragging
                    ? 'opacity-40 border-dashed border-commito-coral scale-[0.98]'
                    : isTarget && dropZone === 'merge'
                      ? 'bg-commito-coral/20 border-commito-coral text-commito-coral shadow-lg ring-1 ring-commito-coral/50'
                      : isSelected
                        ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText shadow-sm'
                        : 'bg-base-2/60 border-border/60 hover:bg-base-2 hover:border-border text-text-primary'
                  }`}
              >
                {/* Top Border Line Indicator for Drop Before */}
                {isTarget && dropZone === 'before' && (
                  <div className="absolute inset-x-0 -top-1 h-1 bg-commito-coral rounded-full shadow-[0_0_8px_rgba(255,107,107,0.9)] z-20 pointer-events-none flex items-center justify-center">
                    <span className="px-2 py-0.5 text-[9px] font-extrabold text-white bg-commito-coral rounded-full shadow-md -translate-y-2 uppercase tracking-wider">
                      MOVE ABOVE
                    </span>
                  </div>
                )}

                {/* Bottom Border Line Indicator for Drop After */}
                {isTarget && dropZone === 'after' && (
                  <div className="absolute inset-x-0 -bottom-1 h-1 bg-commito-coral rounded-full shadow-[0_0_8px_rgba(255,107,107,0.9)] z-20 pointer-events-none flex items-center justify-center">
                    <span className="px-2 py-0.5 text-[9px] font-extrabold text-white bg-commito-coral rounded-full shadow-md translate-y-2 uppercase tracking-wider">
                      MOVE BELOW
                    </span>
                  </div>
                )}

                {/* Card Header & Content */}
                <div className="flex items-start justify-between gap-2 mb-1 pointer-events-none">
                  <h4 className="text-xs font-bold truncate leading-snug flex-1">
                    {c.message}
                  </h4>
                  <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded-md text-[10px] font-mono text-text-muted flex-shrink-0">
                    {c.short_sha}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-text-muted mt-1.5 pointer-events-none">
                  <div className="flex items-center gap-1.5 truncate">
                    <UserAvatar name={c.author_name} email={c.author_email} className="w-4 h-4" iconClassName="w-2.5 h-2.5" />
                    <span className="truncate font-medium text-text-secondary">{c.author_name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-text-faint">{c.relative_date}</span>
                </div>

                {/* Drop to Merge Overlay */}
                {isTarget && dropZone === 'merge' && (
                  <div className="absolute inset-0 bg-commito-coral/25 backdrop-blur-[1px] border-2 border-commito-coral rounded-md flex items-center justify-center gap-1.5 text-[10px] font-extrabold text-white uppercase tracking-wider z-20 pointer-events-none shadow-lg">
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>DROP TO MERGE COMMITS</span>
                  </div>
                )}
              </div>
            );
          })


        )}
      </div>
    </div>
  )
}

{
  contextMenu && (
    <CommitContextMenu
      commit={contextMenu.commit}
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={() => setContextMenu(null)}
    />
  )
}

{
  fileContextMenu && (
    <FileContextMenu
      filePath={fileContextMenu.filePath}
      x={fileContextMenu.x}
      y={fileContextMenu.y}
      onClose={() => setFileContextMenu(null)}
    />
  )
}

<RepoDropdown
  isOpen={isRepoDropdownOpen}
  onClose={() => setIsRepoDropdownOpen(false)}
  triggerRect={repoCardRect}
/>
    </aside >
  );
};



