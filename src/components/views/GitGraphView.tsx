import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  GitBranch,
  Search,
  RefreshCw,
  Tag,
  Copy,
  Check,
  Loader2,
  User,
  FilterX,
  Layers,
  X,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useGitStore } from '../../store/useGitStore';
import { GitService } from '../../services/git/gitService';
import { CommitInfo, BranchInfo, TagInfo } from '../../types/git';
import { computeGitGraphLayout, LANE_COLORS } from '../sidebar/history/gitGraphLayout';
import { CommitContextMenu } from '../context-menus/CommitContextMenu';
import { Dropdown, DropdownOption } from '../common/Dropdown';
import { Checkbox } from '../common/Checkbox';
import { CommitHoverCard } from '../common/CommitHoverCard';
import { CommitDetailsInspector } from './git-graph/CommitDetailsInspector';
import { UserAvatar } from '../common/UserAvatar';

const ROW_HEIGHT = 28;
const LANE_WIDTH = 14;
const NODE_RADIUS = 3.5;
const MERGE_RADIUS = 4;
const PADDING_LEFT = 14;
const PAGE_SIZE = 60;

type DateFilterOption = 'all' | 'today' | '7d' | '30d' | '90d' | '1y';

function formatGraphDate(timestamp: number): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${mins}`;
}

export const GitGraphView: React.FC = () => {
  const {
    activeRepoPath,
    status,
    branches,
    tags,
    user,
    selectedCommitSha,
    setSelectedCommitSha,
    setCurrentNavView,
  } = useGitStore();

  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<DateFilterOption>('all');
  const [showRemoteBranches, setShowRemoteBranches] = useState<boolean>(true);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [expandedCommitSha, setExpandedCommitSha] = useState<string | null>(null);
  const [hoveredCommit, setHoveredCommit] = useState<{
    commit: CommitInfo;
    coords: { x: number; y: number };
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    commit: CommitInfo;
    x: number;
    y: number;
  } | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isFetchingMoreRef = useRef(false);

  // 1. Initial Batch Load (incorporating selected branch and all-branches flag)
  const loadInitialCommits = useCallback(async () => {
    if (!activeRepoPath) return;
    setIsLoadingInitial(true);
    setHasMore(true);
    try {
      const isAll = selectedBranch === 'all';
      const branchParam = isAll ? null : selectedBranch;
      const res = await GitService.getCommitHistory(
        activeRepoPath,
        PAGE_SIZE,
        0,
        branchParam,
        isAll
      );

      if (res && res.length > 0) {
        setCommits(res);
        setHasMore(res.length === PAGE_SIZE);
      } else {
        setCommits([]);
        setHasMore(false);
      }
    } catch {
      setCommits([]);
      setHasMore(false);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [activeRepoPath, selectedBranch]);

  // 2. Infinite Scroll Load More
  const loadMoreCommits = useCallback(async () => {
    if (!activeRepoPath || !hasMore || isLoadingMore || isFetchingMoreRef.current) return;
    isFetchingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const offset = commits.length;
      const isAll = selectedBranch === 'all';
      const branchParam = isAll ? null : selectedBranch;
      const res = await GitService.getCommitHistory(
        activeRepoPath,
        PAGE_SIZE,
        offset,
        branchParam,
        isAll
      );

      if (res && res.length > 0) {
        setCommits((prev) => {
          const existingShas = new Set(prev.map((c) => c.sha));
          const uniqueNew = res.filter((c) => !existingShas.has(c.sha));
          return [...prev, ...uniqueNew];
        });
        setHasMore(res.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
      isFetchingMoreRef.current = false;
    }
  }, [activeRepoPath, hasMore, isLoadingMore, commits.length, selectedBranch]);

  useEffect(() => {
    loadInitialCommits();
  }, [loadInitialCommits]);

  // Copy SHA to clipboard
  const handleCopySha = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 1500);
  };

  // Author options derived from loaded commits
  const authorOptions = useMemo<DropdownOption<string>[]>(() => {
    const counts = new Map<string, number>();
    commits.forEach((c) => {
      const authorKey = c.author_name || c.author_email || 'Unknown';
      counts.set(authorKey, (counts.get(authorKey) || 0) + 1);
    });

    const opts: DropdownOption<string>[] = [
      { value: 'all', label: `All Authors (${commits.length})`, icon: <User className="w-3.5 h-3.5 text-text-muted" /> },
    ];

    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([author, count]) => {
        opts.push({
          value: author,
          label: `${author} (${count})`,
          icon: <User className="w-3.5 h-3.5 text-text-muted" />,
        });
      });

    return opts;
  }, [commits]);

  // Date range filter options
  const dateRangeOptions: DropdownOption<DateFilterOption>[] = [
    { value: 'all', label: 'All Time', icon: <CalendarIcon className="w-3.5 h-3.5 text-text-muted" /> },
    { value: 'today', label: 'Today', icon: <CalendarIcon className="w-3.5 h-3.5 text-text-muted" /> },
    { value: '7d', label: 'Last 7 Days', icon: <CalendarIcon className="w-3.5 h-3.5 text-text-muted" /> },
    { value: '30d', label: 'Last 30 Days', icon: <CalendarIcon className="w-3.5 h-3.5 text-text-muted" /> },
    { value: '90d', label: 'Last 3 Months', icon: <CalendarIcon className="w-3.5 h-3.5 text-text-muted" /> },
    { value: '1y', label: 'Past Year', icon: <CalendarIcon className="w-3.5 h-3.5 text-text-muted" /> },
  ];

  // Filter commits based on search query, author, and date range
  const filteredCommits = useMemo(() => {
    let result = commits;

    // 1. Author Filter
    if (selectedAuthor !== 'all') {
      result = result.filter(
        (c) => c.author_name === selectedAuthor || c.author_email === selectedAuthor
      );
    }

    // 2. Date Range Filter
    if (selectedDateRange !== 'all') {
      const now = Date.now() / 1000;
      let threshold = 0;
      if (selectedDateRange === 'today') threshold = now - 86400;
      else if (selectedDateRange === '7d') threshold = now - 7 * 86400;
      else if (selectedDateRange === '30d') threshold = now - 30 * 86400;
      else if (selectedDateRange === '90d') threshold = now - 90 * 86400;
      else if (selectedDateRange === '1y') threshold = now - 365 * 86400;

      result = result.filter((c) => c.timestamp >= threshold);
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.message.toLowerCase().includes(q) ||
          c.author_name.toLowerCase().includes(q) ||
          c.author_email.toLowerCase().includes(q) ||
          c.sha.toLowerCase().includes(q) ||
          c.short_sha.toLowerCase().includes(q)
      );
    }

    return result;
  }, [commits, selectedAuthor, selectedDateRange, searchQuery]);

  // Compute railway graph layout metadata
  const graphNodes = useMemo(() => computeGitGraphLayout(filteredCommits), [filteredCommits]);

  // Map branches and tags to commit SHAs for badge rendering
  const branchesByCommit = useMemo(() => {
    const map = new Map<string, BranchInfo[]>();
    branches.forEach((b) => {
      if (!showRemoteBranches && b.is_remote) return;
      if (b.is_current && commits[0]) {
        const list = map.get(commits[0].sha) || [];
        list.push(b);
        map.set(commits[0].sha, list);
      }
    });
    return map;
  }, [branches, showRemoteBranches, commits]);

  const tagsByCommit = useMemo(() => {
    const map = new Map<string, TagInfo[]>();
    tags.forEach((t) => {
      if (t.sha) {
        const list = map.get(t.sha) || [];
        list.push(t);
        map.set(t.sha, list);
      }
    });
    return map;
  }, [tags]);

  // Calculate max lane count for SVG column width
  const maxLaneCount = useMemo(() => {
    let max = 0;
    graphNodes.forEach((node) => {
      max = Math.max(
        max,
        node.lane,
        ...(node.activeLanes || [0]),
        ...((node.inSegments || []).map((s) => s.fromLane)),
        ...((node.outSegments || []).map((s) => s.toLane))
      );
    });
    return Math.max(2, max + 1);
  }, [graphNodes]);

  const graphColWidth = Math.max(72, PADDING_LEFT + maxLaneCount * LANE_WIDTH + 14);

  // Uncommitted changes info
  const uncommittedCount = status?.files?.length || 0;
  const hasUncommittedRow = uncommittedCount > 0;
  const totalItemCount = (hasUncommittedRow ? 1 : 0) + filteredCommits.length;

  // React Virtualizer for 60fps high performance rendering
  const rowVirtualizer = useVirtualizer({
    count: totalItemCount,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: (index) => {
      if (hasUncommittedRow && index === 0) return ROW_HEIGHT;
      const commitIndex = hasUncommittedRow ? index - 1 : index;
      const c = filteredCommits[commitIndex];
      if (c && expandedCommitSha === c.sha) {
        return 320; // Expanded inline inspector height
      }
      return ROW_HEIGHT;
    },
    overscan: 12,
  });

  // Jump to specific commit and focus in virtualizer
  const handleJumpToCommit = useCallback(
    (targetSha: string) => {
      const targetIndex = filteredCommits.findIndex(
        (c) => c.sha === targetSha || c.sha.startsWith(targetSha)
      );
      if (targetIndex !== -1) {
        const rowIdx = (hasUncommittedRow ? 1 : 0) + targetIndex;
        rowVirtualizer.scrollToIndex(rowIdx, { align: 'center', behavior: 'smooth' });
        setExpandedCommitSha(targetSha);
        setSelectedCommitSha(targetSha);
      }
    },
    [filteredCommits, hasUncommittedRow, rowVirtualizer, setSelectedCommitSha]
  );

  // Dynamic onScroll listener
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore || isLoadingMore || isLoadingInitial) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 350) {
      loadMoreCommits();
    }
  };

  // Branch dropdown options
  const branchOptions = useMemo<DropdownOption<string>[]>(() => {
    const opts: DropdownOption<string>[] = [
      { value: 'all', label: 'All Branches (Graph)', icon: <Layers className="w-3.5 h-3.5 text-blue-400" /> },
    ];
    if (status?.current_branch) {
      opts.push({
        value: status.current_branch,
        label: `HEAD (${status.current_branch})`,
        icon: <GitBranch className="w-3.5 h-3.5 text-commito-coral" />,
      });
    }
    branches.forEach((b) => {
      if (b.name !== status?.current_branch) {
        if (!showRemoteBranches && b.is_remote) return;
        opts.push({
          value: b.name,
          label: b.name,
          icon: <GitBranch className={`w-3.5 h-3.5 ${b.is_remote ? 'text-purple-400' : 'text-text-muted'}`} />,
        });
      }
    });
    return opts;
  }, [branches, status?.current_branch, showRemoteBranches]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedAuthor !== 'all' || selectedDateRange !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAuthor('all');
    setSelectedDateRange('all');
  };

  // Global Escape key listener to close graph or collapse inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expandedCommitSha) {
          setExpandedCommitSha(null);
        } else {
          setCurrentNavView('history');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedCommitSha, setCurrentNavView]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-base-0 select-none overflow-hidden font-sans">
      {/* Top Header Control Toolbar */}
      <div className="h-10 px-3 bg-base-0 border-b border-border flex items-center justify-between gap-3 shrink-0 text-xs select-none z-10">
        {/* Left: Section Badge & Filter Controls */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {/* Section Indicator */}
          <div className="flex items-center gap-1.5 shrink-0 pr-2.5 border-r border-border">
            <div className="w-6 h-6 rounded-xs bg-commito-coral/15 text-commito-coral flex items-center justify-center border border-commito-coral/30">
              <GitBranch className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-text-primary text-xs tracking-tight">
              Git Graph
            </span>
          </div>

          {/* Branch Dropdown */}
          <Dropdown<string>
            options={branchOptions}
            value={selectedBranch}
            onChange={setSelectedBranch}
            size="sm"
            className="w-38 shrink-0"
          />

          {/* Author Dropdown */}
          <Dropdown<string>
            options={authorOptions}
            value={selectedAuthor}
            onChange={setSelectedAuthor}
            size="sm"
            className="w-36 shrink-0"
          />

          {/* Date Dropdown */}
          <Dropdown<DateFilterOption>
            options={dateRangeOptions}
            value={selectedDateRange}
            onChange={setSelectedDateRange}
            size="sm"
            className="w-28 shrink-0"
          />

          {/* Remote Branches Toggle */}
          <div className="shrink-0 pl-0.5">
            <Checkbox
              checked={showRemoteBranches}
              onChange={setShowRemoteBranches}
              label={<span className="text-[11px] text-text-secondary font-medium whitespace-nowrap">Remote</span>}
              size="sm"
            />
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-6.5 px-2 bg-base-1 hover:bg-base-2 text-text-muted hover:text-commito-coral border border-border rounded-xs text-[10.5px] font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 shadow-2xs"
              title="Reset all filters"
            >
              <FilterX className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Search, Commit Counter, Refresh & Close */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-text-muted absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search graph..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 sm:w-44 h-7 pl-6.5 pr-6 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-xs text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 p-0.5 text-text-muted hover:text-text-primary rounded-xs transition cursor-pointer"
                title="Clear search"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          <span className="px-2 py-0.5 rounded-xs bg-base-1 border border-border text-text-muted font-mono text-[10.5px] shrink-0">
            {filteredCommits.length} {hasMore ? '+' : ''} commits
          </span>

          <button
            type="button"
            onClick={loadInitialCommits}
            disabled={isLoadingInitial}
            className="w-7 h-7 flex items-center justify-center bg-base-1 hover:bg-base-2 border border-border rounded-xs text-text-muted hover:text-text-primary transition cursor-pointer shadow-2xs shrink-0"
            title="Refresh graph"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInitial ? 'animate-spin' : ''}`} />
          </button>

          <div className="h-4 w-px bg-border/80 mx-0.5" />

          {/* Close Graph View Button */}
          <button
            type="button"
            onClick={() => setCurrentNavView('history')}
            className="h-7 px-2.5 bg-base-1 hover:bg-base-2 text-text-secondary hover:text-text-primary border border-border rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
            title="Close Graph View (Esc)"
          >
            <X className="w-3.5 h-3.5 text-text-muted" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Main Git Graph Virtualized Table Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Table Column Headers */}
        <div className="flex items-center bg-base-1/90 border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider shrink-0 select-none">
          <div style={{ width: `${graphColWidth}px` }} className="px-2 py-1.5 shrink-0 border-r border-border/40">
            Graph
          </div>
          <div className="flex-1 px-3 py-1.5 min-w-0 border-r border-border/40">Description</div>
          <div className="w-36 px-2.5 py-1.5 shrink-0 border-r border-border/40">Date</div>
          <div className="w-40 px-2.5 py-1.5 shrink-0 border-r border-border/40">Author</div>
          <div className="w-20 px-2 py-1.5 shrink-0 text-right pr-3">Commit</div>
        </div>

        {/* Scrollable Virtualized Container */}
        <div
          ref={tableContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto font-sans scrollbar-thin relative"
        >
          {isLoadingInitial && commits.length === 0 ? (
            <div className="flex items-center justify-center p-12 text-xs text-text-muted gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-commito-coral" />
              <span>Loading commit graph...</span>
            </div>
          ) : filteredCommits.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-xs text-text-muted gap-2">
              <span>No commits match your active filters.</span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 bg-base-1 hover:bg-base-2 border border-border rounded-xs text-text-primary text-xs cursor-pointer transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const isUncommittedRowItem = hasUncommittedRow && virtualRow.index === 0;

                if (isUncommittedRowItem) {
                  return (
                    <div
                      key="uncommitted-row"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => setCurrentNavView('changes')}
                      className="flex items-center hover:bg-base-2/60 border-b border-border/40 cursor-pointer text-xs group transition-colors"
                    >
                      {/* Graph SVG Column */}
                      <div style={{ width: `${graphColWidth}px` }} className="h-full shrink-0 relative pointer-events-none">
                        <svg width={graphColWidth} height={ROW_HEIGHT} className="block overflow-visible">
                          <line
                            x1={PADDING_LEFT}
                            y1={ROW_HEIGHT / 2}
                            x2={PADDING_LEFT}
                            y2={ROW_HEIGHT}
                            stroke={LANE_COLORS[0]}
                            strokeWidth={2}
                            strokeDasharray="2 2"
                          />
                          <circle
                            cx={PADDING_LEFT}
                            cy={ROW_HEIGHT / 2}
                            r={NODE_RADIUS}
                            fill="#111113"
                            stroke={LANE_COLORS[0]}
                            strokeWidth={1.75}
                          />
                        </svg>
                      </div>

                      {/* Description Column */}
                      <div className="flex-1 px-3 min-w-0 flex items-center gap-2">
                        <span className="font-semibold text-commito-coral truncate">
                          Uncommitted Changes ({uncommittedCount})
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-commito-coral/20 text-commito-coral border border-commito-coral/40 font-mono">
                          Working Tree
                        </span>
                      </div>

                      {/* Date */}
                      <div className="w-36 px-2.5 text-[11px] text-text-muted font-mono truncate">Current</div>

                      {/* Author */}
                      <div className="w-40 px-2.5 text-[11px] text-text-muted truncate flex items-center gap-1.5">
                        <UserAvatar
                          name={user?.name || user?.username}
                          email={user?.email || undefined}
                          url={user?.avatar_url}
                          provider={user?.provider}
                          className="w-4.5 h-4.5 text-[9px] shrink-0"
                        />
                        <span className="truncate group-hover:text-text-primary transition-colors">
                          {user?.name || 'You'}
                        </span>
                      </div>

                      {/* Commit */}
                      <div className="w-20 px-2 text-right pr-3 text-[11px] text-text-muted font-mono">—</div>
                    </div>
                  );
                }

                const commitIndex = hasUncommittedRow ? virtualRow.index - 1 : virtualRow.index;
                const c = filteredCommits[commitIndex];
                if (!c) return null;

                const isExpanded = expandedCommitSha === c.sha;
                const isSelected = selectedCommitSha === c.sha || isExpanded;
                const node = graphNodes.get(c.sha);
                const branchChips = branchesByCommit.get(c.sha) || [];
                const tagChips = tagsByCommit.get(c.sha) || [];

                const nodeX = PADDING_LEFT + (node?.lane || 0) * LANE_WIDTH;
                const centerY = ROW_HEIGHT / 2;
                const nodeColor = LANE_COLORS[(node?.colorIndex || 0) % LANE_COLORS.length];

                return (
                  <div
                    key={c.sha}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex flex-col"
                  >
                    {/* Commit Row Bar */}
                    <div
                      onClick={() => {
                        const next = isExpanded ? null : c.sha;
                        setExpandedCommitSha(next);
                        setSelectedCommitSha(next);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedCommitSha(c.sha);
                        setContextMenu({ commit: c, x: e.clientX, y: e.clientY });
                      }}
                      className={`flex items-center h-7 border-b border-border/30 cursor-pointer text-xs transition-colors group ${
                        isSelected ? 'bg-base-2 text-text-primary' : 'hover:bg-base-2/50 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {/* 1. Graph Column */}
                      <div
                        style={{ width: `${graphColWidth}px` }}
                        className="h-full shrink-0 relative"
                      >
                        {node && (
                          <svg width={graphColWidth} height={ROW_HEIGHT} className="block overflow-visible">
                            {/* Passing vertical lanes */}
                            {node.activeLanes.map((lIdx) => {
                              const x = PADDING_LEFT + lIdx * LANE_WIDTH;
                              const color = LANE_COLORS[lIdx % LANE_COLORS.length];
                              return (
                                <line
                                  key={`pass-${lIdx}`}
                                  x1={x}
                                  y1={0}
                                  x2={x}
                                  y2={ROW_HEIGHT}
                                  stroke={color}
                                  strokeWidth={2}
                                  strokeOpacity={0.75}
                                />
                              );
                            })}

                            {/* Incoming lines from above */}
                            {(node.inSegments || []).map((inSeg, inIdx) => {
                              const fromX = PADDING_LEFT + inSeg.fromLane * LANE_WIDTH;
                              const toX = nodeX;
                              const segColor = LANE_COLORS[inSeg.colorIndex % LANE_COLORS.length] || nodeColor;

                              if (fromX === toX) {
                                return (
                                  <line
                                    key={`in-${inIdx}`}
                                    x1={fromX}
                                    y1={0}
                                    x2={toX}
                                    y2={centerY}
                                    stroke={segColor}
                                    strokeWidth={2}
                                  />
                                );
                              }

                              const midY = centerY / 2;
                              const pathData = `M ${fromX} 0 C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${centerY}`;
                              return (
                                <path
                                  key={`in-curve-${inIdx}`}
                                  d={pathData}
                                  fill="none"
                                  stroke={segColor}
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              );
                            })}

                            {/* Outgoing lines to parent commits */}
                            {node.outSegments.map((seg, sIdx) => {
                              const fromX = nodeX;
                              const toX = PADDING_LEFT + seg.toLane * LANE_WIDTH;
                              const segColor = LANE_COLORS[seg.colorIndex % LANE_COLORS.length] || nodeColor;

                              if (fromX === toX) {
                                return (
                                  <line
                                    key={`out-${sIdx}`}
                                    x1={fromX}
                                    y1={centerY}
                                    x2={toX}
                                    y2={ROW_HEIGHT}
                                    stroke={segColor}
                                    strokeWidth={2}
                                  />
                                );
                              }

                              // Smooth symmetric cubic S-curve bezier
                              const dy = ROW_HEIGHT - centerY;
                              const cp1Y = centerY + dy * 0.55;
                              const cp2Y = ROW_HEIGHT - dy * 0.55;
                              const pathData = `M ${fromX} ${centerY} C ${fromX} ${cp1Y}, ${toX} ${cp2Y}, ${toX} ${ROW_HEIGHT}`;
                              return (
                                <path
                                  key={`curve-${sIdx}`}
                                  d={pathData}
                                  fill="none"
                                  stroke={segColor}
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              );
                            })}

                            {/* Interactive Node Dot */}
                            <g
                              className="cursor-pointer"
                              onMouseEnter={(e) => {
                                e.stopPropagation();
                                setHoveredCommit({
                                  commit: c,
                                  coords: { x: e.clientX, y: e.clientY },
                                });
                              }}
                              onMouseMove={(e) => {
                                e.stopPropagation();
                                setHoveredCommit({
                                  commit: c,
                                  coords: { x: e.clientX, y: e.clientY },
                                });
                              }}
                              onMouseLeave={(e) => {
                                e.stopPropagation();
                                setHoveredCommit(null);
                              }}
                            >
                              {/* Invisible hit target circle (radius 8px) */}
                              <circle
                                cx={nodeX}
                                cy={centerY}
                                r={8}
                                fill="transparent"
                              />

                              {node.isMerge ? (
                                <>
                                  <circle
                                    cx={nodeX}
                                    cy={centerY}
                                    r={MERGE_RADIUS + 1.5}
                                    fill="none"
                                    stroke={nodeColor}
                                    strokeWidth={1.5}
                                    strokeOpacity={0.6}
                                  />
                                  <circle
                                    cx={nodeX}
                                    cy={centerY}
                                    r={MERGE_RADIUS}
                                    fill={isSelected ? '#ffffff' : nodeColor}
                                    stroke="#0d0c10"
                                    strokeWidth={1.5}
                                  />
                                </>
                              ) : (
                                <>
                                  {node.isHead && (
                                    <circle
                                      cx={nodeX}
                                      cy={centerY}
                                      r={NODE_RADIUS + 2.5}
                                      fill={nodeColor}
                                      fillOpacity={0.25}
                                      className="animate-pulse"
                                    />
                                  )}
                                  <circle
                                    cx={nodeX}
                                    cy={centerY}
                                    r={NODE_RADIUS}
                                    fill={isSelected ? '#ffffff' : nodeColor}
                                    stroke="#0d0c10"
                                    strokeWidth={1.5}
                                  />
                                </>
                              )}
                            </g>
                          </svg>
                        )}
                      </div>

                      {/* 2. Description Column with Badges */}
                      <div className="flex-1 px-3 min-w-0 flex items-center gap-1.5 overflow-hidden">
                        {/* Branch Badges */}
                        {branchChips.map((b) => (
                          <span
                            key={b.name}
                            className={`px-1.5 py-0.2 rounded-xs text-[10px] font-mono font-semibold flex items-center gap-1 shrink-0 ${
                              b.is_current
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                : 'bg-base-2 text-text-secondary border border-border'
                            }`}
                          >
                            <GitBranch className="w-2.5 h-2.5 shrink-0" />
                            <span>{b.name}</span>
                          </span>
                        ))}

                        {/* Tag Badges */}
                        {tagChips.map((t) => (
                          <span
                            key={t.name}
                            className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          >
                            <Tag className="w-2.5 h-2.5 shrink-0" />
                            <span>{t.name}</span>
                          </span>
                        ))}

                        {/* Commit Message */}
                        <span className="truncate text-xs font-medium text-text-primary">
                          {c.message}
                        </span>
                      </div>

                      {/* 3. Date Column */}
                      <div className="w-36 px-2.5 text-[11px] text-text-muted font-mono truncate shrink-0">
                        {formatGraphDate(c.timestamp)}
                      </div>

                      {/* 4. Author Column with Avatar */}
                      <div className="w-40 px-2.5 text-[11px] text-text-muted truncate shrink-0 flex items-center gap-1.5">
                        <UserAvatar
                          name={c.author_name}
                          email={c.author_email}
                          className="w-4.5 h-4.5 text-[9px] shrink-0"
                        />
                        <span className="truncate group-hover:text-text-primary transition-colors">
                          {c.author_name}
                        </span>
                      </div>

                      {/* 5. Commit SHA Column */}
                      <div className="w-20 px-2 text-right pr-3 shrink-0 flex items-center justify-end gap-1 font-mono text-[11px] text-text-muted">
                        <span>{c.short_sha}</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopySha(c.sha, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-text-primary transition-opacity cursor-pointer"
                          title="Copy SHA"
                        >
                          {copiedSha === c.sha ? (
                            <Check className="w-3 h-3 text-git-added" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Inline Expansion Inspector Card */}
                    {isExpanded && activeRepoPath && (
                      <div className="flex border-b border-border bg-base-1 min-h-[220px] max-h-[360px] animate-in fade-in duration-150">
                        {/* Left: Continuous passing railway tracks */}
                        <div
                          style={{ width: `${graphColWidth}px` }}
                          className="shrink-0 relative bg-base-0/30"
                        >
                          <svg width={graphColWidth} height="100%" className="w-full h-full block">
                            {node && (
                              <>
                                {node.outSegments.map((seg, sIdx) => {
                                  const toX = PADDING_LEFT + seg.toLane * LANE_WIDTH;
                                  const segColor = LANE_COLORS[seg.colorIndex % LANE_COLORS.length] || nodeColor;
                                  return (
                                    <line
                                      key={`inline-out-${sIdx}`}
                                      x1={toX}
                                      y1={0}
                                      x2={toX}
                                      y2="100%"
                                      stroke={segColor}
                                      strokeWidth={2}
                                      strokeOpacity={0.75}
                                    />
                                  );
                                })}
                                {node.activeLanes.map((lIdx) => {
                                  const x = PADDING_LEFT + lIdx * LANE_WIDTH;
                                  const color = LANE_COLORS[lIdx % LANE_COLORS.length];
                                  return (
                                    <line
                                      key={`inline-pass-${lIdx}`}
                                      x1={x}
                                      y1={0}
                                      x2={x}
                                      y2="100%"
                                      stroke={color}
                                      strokeWidth={2}
                                      strokeOpacity={0.75}
                                    />
                                  );
                                })}
                              </>
                            )}
                          </svg>
                        </div>

                        {/* Right: Commit Details & Files Inspector */}
                        <div className="flex-1 min-w-0 border-l border-border/50">
                          <CommitDetailsInspector
                            repoPath={activeRepoPath}
                            commitSha={c.sha}
                            onSelectSha={handleJumpToCommit}
                            onClose={() => {
                              setExpandedCommitSha(null);
                              setSelectedCommitSha(null);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading More Indicator */}
          {isLoadingMore && (
            <div className="py-2.5 flex items-center justify-center gap-2 text-xs text-text-muted bg-base-1/50 border-t border-border/40">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
              <span>Loading more commits...</span>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <CommitContextMenu
          commit={contextMenu.commit}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Hover Info Tooltip Card */}
      <CommitHoverCard
        commit={hoveredCommit?.commit || null}
        branches={hoveredCommit ? branchesByCommit.get(hoveredCommit.commit.sha) : undefined}
        tags={hoveredCommit ? tagsByCommit.get(hoveredCommit.commit.sha) : undefined}
        coords={hoveredCommit?.coords || null}
      />
    </div>
  );
};
