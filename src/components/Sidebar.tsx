import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  ChevronsUpDown,
  Filter,
  FileText,
  GitCommit,
  Search
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
    activeTab,
    setActiveTab,
    setCurrentNavView,
    selectedCommitSha,
    setSelectedCommitSha,
    setError,
    user,
  } = useGitStore();


  const [isCommitting, setIsCommitting] = useState(false);
  const [fileFilter, setFileFilter] = useState('');
  const [commitFilter, setCommitFilter] = useState('');
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [contextMenu, setContextMenu] = useState<{ commit: CommitInfo; x: number; y: number } | null>(null);
  const [fileContextMenu, setFileContextMenu] = useState<{ filePath: string; x: number; y: number } | null>(null);
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [repoCardRect, setRepoCardRect] = useState<DOMRect | null>(null);

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
    setIsCommitting(true);

    try {
      if (stagedFiles.length === 0) {
        await invoke('stage_all_cmd', { repoPath: activeRepoPath });
      }

      await invoke('commit_cmd', {
        repoPath: activeRepoPath,
        message: commitSummary,
        description: commitDescription || null,
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
  const canCommit = Boolean(commitSummary.trim() && (stagedFiles.length > 0 || allFiles.length > 0));

  const filteredCommits = commits.filter(
    (c) =>
      c.message.toLowerCase().includes(commitFilter.toLowerCase()) ||
      c.author_name.toLowerCase().includes(commitFilter.toLowerCase()) ||
      c.short_sha.toLowerCase().includes(commitFilter.toLowerCase())
  );

  return (
    <aside className="w-80 h-full bg-base-0 border-r border-border flex flex-col flex-shrink-0 select-none">
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
            className={`flex-1 py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === 'changes'
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
            className={`flex-1 py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === 'history'
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
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition ${
                      isSelected
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
              <UserAvatar url={user?.avatar_url} name={user?.name || user?.username} provider={user?.provider} className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
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
              className="w-full px-2.5 py-1.5 bg-base-0 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 resize-none font-sans"
            />

            <button
              onClick={handleCommit}
              disabled={!canCommit || isCommitting}
              className={`w-full py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm ${
                canCommit
                  ? 'bg-commito-coral hover:bg-commito-coralHover text-white cursor-pointer'
                  : 'bg-base-2 text-text-muted cursor-not-allowed border border-border'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              Commit {stagedFiles.length > 0 ? `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}` : ''} to {status?.current_branch || 'main'}
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
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredCommits.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted italic">
                No commits match filter
              </div>
            ) : (
              filteredCommits.map((c) => {
                const isSelected = selectedCommitSha === c.sha;
                return (
                  <div
                    key={c.sha}
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
                    className={`p-2.5 rounded-md cursor-pointer transition border ${
                      isSelected
                        ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText shadow-sm'
                        : 'bg-base-2/60 border-border/60 hover:bg-base-2 hover:border-border text-text-primary'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-xs font-bold truncate leading-snug flex-1">
                        {c.message}
                      </h4>
                      <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded-md text-[10px] font-mono text-text-muted flex-shrink-0">
                        {c.short_sha}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted mt-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <UserAvatar name={c.author_name} email={c.author_email} className="w-4 h-4" iconClassName="w-2.5 h-2.5" />
                        <span className="truncate font-medium text-text-secondary">{c.author_name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-text-faint">{c.relative_date}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {contextMenu && (
        <CommitContextMenu
          commit={contextMenu.commit}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {fileContextMenu && (
        <FileContextMenu
          filePath={fileContextMenu.filePath}
          x={fileContextMenu.x}
          y={fileContextMenu.y}
          onClose={() => setFileContextMenu(null)}
        />
      )}

      <RepoDropdown
        isOpen={isRepoDropdownOpen}
        onClose={() => setIsRepoDropdownOpen(false)}
        triggerRect={repoCardRect}
      />
    </aside>
  );
};



