import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  GitBranch,
  Search,
  RefreshCw,
  Tag,
  Copy,
  Check,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { GitService } from '../../services/git/gitService';
import { CommitInfo, BranchInfo, TagInfo } from '../../types/git';
import { computeGitGraphLayout, LANE_COLORS } from '../sidebar/history/gitGraphLayout';
import { CommitContextMenu } from '../context-menus/CommitContextMenu';
import { Dropdown, DropdownOption } from '../common/Dropdown';
import { Checkbox } from '../common/Checkbox';
import { CommitHoverCard } from '../common/CommitHoverCard';
import { CommitDetailsInspector } from './git-graph/CommitDetailsInspector';

const ROW_HEIGHT = 28;
const LANE_WIDTH = 14;
const NODE_RADIUS = 3.5;
const MERGE_RADIUS = 4;
const PADDING_LEFT = 14;

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
    selectedCommitSha,
    setSelectedCommitSha,
    setCurrentNavView,
  } = useGitStore();

  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
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

  // Load commits from active repo
  const loadCommits = useCallback(async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const log = await GitService.getCommitHistory(activeRepoPath, 500, 0);
      setCommits(log || []);
    } catch {
      setCommits([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeRepoPath]);

  useEffect(() => {
    loadCommits();
  }, [loadCommits]);

  // Copy SHA to clipboard
  const handleCopySha = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 1500);
  };

  // Filter commits based on search query, branch filter, and remote toggle
  const filteredCommits = useMemo(() => {
    let result = commits;

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
  }, [commits, searchQuery]);

  // Compute graph layout
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
      max = Math.max(max, node.lane, ...(node.activeLanes || [0]));
    });
    return Math.max(2, max + 1);
  }, [graphNodes]);

  const graphColWidth = Math.max(64, PADDING_LEFT + maxLaneCount * LANE_WIDTH + 14);

  // Uncommitted changes info
  const uncommittedCount = status?.files?.length || 0;

  // Branch dropdown options
  const branchOptions = useMemo<DropdownOption<string>[]>(() => {
    const opts: DropdownOption<string>[] = [
      { value: 'all', label: 'Show All' },
    ];
    if (status?.current_branch) {
      opts.push({
        value: status.current_branch,
        label: `Current (${status.current_branch})`,
        icon: <GitBranch className="w-3.5 h-3.5 text-commito-coral" />,
      });
    }
    branches.forEach((b) => {
      if (b.name !== status?.current_branch) {
        opts.push({
          value: b.name,
          label: b.name,
          icon: <GitBranch className="w-3.5 h-3.5 text-text-muted" />,
        });
      }
    });
    return opts;
  }, [branches, status?.current_branch]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-base-0 select-none overflow-hidden font-sans">
      {/* Top Header Control Toolbar */}
      <div className="px-3 py-1.5 bg-base-1 border-b border-border flex items-center justify-between gap-3 shrink-0 text-xs">
        {/* Left: Branch Filter & Remote Checkbox */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[11px] font-semibold">Branches:</span>
            <Dropdown<string>
              options={branchOptions}
              value={selectedBranch}
              onChange={setSelectedBranch}
              size="sm"
              className="w-44"
            />
          </div>

          <Checkbox
            checked={showRemoteBranches}
            onChange={setShowRemoteBranches}
            label={<span className="text-[11px] text-text-secondary font-medium">Show Remote branches</span>}
            size="sm"
          />
        </div>

        {/* Right: Search Filter & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-text-muted absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search graph..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 h-6.5 pl-6.5 pr-2 bg-base-0 border border-border hover:border-border-strong focus:border-border-strong rounded-xs text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>

          <span className="text-text-muted font-mono text-[11px] px-1">
            {filteredCommits.length} commits
          </span>

          <button
            type="button"
            onClick={loadCommits}
            disabled={isLoading}
            className="p-1.5 bg-base-0 hover:bg-base-2 border border-border rounded-xs text-text-muted hover:text-text-primary transition cursor-pointer"
            title="Refresh graph"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Git Graph Table Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Table Column Headers */}
        <div className="flex items-center bg-base-1/80 border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider shrink-0 select-none">
          <div style={{ width: `${graphColWidth}px` }} className="px-2 py-1.5 shrink-0 border-r border-border/40">
            Graph
          </div>
          <div className="flex-1 px-3 py-1.5 min-w-0 border-r border-border/40">Description</div>
          <div className="w-36 px-2.5 py-1.5 shrink-0 border-r border-border/40">Date</div>
          <div className="w-32 px-2.5 py-1.5 shrink-0 border-r border-border/40">Author</div>
          <div className="w-20 px-2 py-1.5 shrink-0 text-right pr-3">Commit</div>
        </div>

        {/* Scrollable Table Rows */}
        <div ref={tableContainerRef} className="flex-1 overflow-y-auto font-sans scrollbar-thin">
          {/* Row 0: Uncommitted Changes (if any) */}
          {uncommittedCount > 0 && (
            <div
              onClick={() => setCurrentNavView('changes')}
              className="flex items-center h-7 hover:bg-base-2/60 border-b border-border/40 cursor-pointer text-xs group transition-colors"
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
              <div className="w-32 px-2.5 text-[11px] text-text-muted truncate">You</div>

              {/* Commit */}
              <div className="w-20 px-2 text-right pr-3 text-[11px] text-text-muted font-mono">—</div>
            </div>
          )}

          {/* Commit Rows with Inline Expansion */}
          {filteredCommits.map((c) => {
            const isExpanded = expandedCommitSha === c.sha;
            const isSelected = selectedCommitSha === c.sha || isExpanded;
            const node = graphNodes.get(c.sha);
            const branchChips = branchesByCommit.get(c.sha) || [];
            const tagChips = tagsByCommit.get(c.sha) || [];

            const nodeX = PADDING_LEFT + (node?.lane || 0) * LANE_WIDTH;
            const centerY = ROW_HEIGHT / 2;
            const nodeColor = LANE_COLORS[(node?.colorIndex || 0) % LANE_COLORS.length];

            return (
              <React.Fragment key={c.sha}>
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

                        {/* Incoming line from above (only if connected to child above) */}
                        {node.hasIncoming && (
                          <line
                            x1={nodeX}
                            y1={0}
                            x2={nodeX}
                            y2={centerY}
                            stroke={nodeColor}
                            strokeWidth={2}
                          />
                        )}

                        {/* Outgoing lines to parent commits below */}
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

                          // Mathematically smooth S-curve cubic bezier (pure vertical tangents at start & end)
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

                        {/* Interactive Node Dot (Triggers Hover Card Only on Node Circle) */}
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
                          {/* Invisible larger hit target circle (radius 8px) */}
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

                  {/* 4. Author Column */}
                  <div className="w-32 px-2.5 text-[11px] text-text-muted truncate shrink-0">
                    {c.author_name}
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

                {/* Inline Expansion Inspector Card (Opens directly beneath selected commit) */}
                {isExpanded && activeRepoPath && (
                  <div className="flex border-b border-border bg-base-1 min-h-[220px] max-h-[360px] animate-in fade-in duration-150">
                    {/* Left: Continuous passing railway tracks through the expanded card */}
                    <div
                      style={{ width: `${graphColWidth}px` }}
                      className="shrink-0 relative bg-base-0/30"
                    >
                      <svg width={graphColWidth} height="100%" className="w-full h-full block">
                        {node && (
                          <>
                            {/* Continuing outgoing parent lanes */}
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
                            {/* Passing lanes */}
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
                        onSelectSha={(sha) => {
                          setExpandedCommitSha(sha);
                          setSelectedCommitSha(sha);
                        }}
                        onClose={() => {
                          setExpandedCommitSha(null);
                          setSelectedCommitSha(null);
                        }}
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
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

export default GitGraphView;
