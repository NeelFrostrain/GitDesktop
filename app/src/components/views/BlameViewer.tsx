import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, RefreshCw } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useShallow } from 'zustand/react/shallow';
import { useGitStore } from '../../store/useGitStore';
import { BlameLine } from '../../types/git';
import { GitService } from '../../services/git/gitService';

/**
 * Line-by-line file blame viewer for inspecting commit authorship, dates, and jump-to-commit navigation
 * with virtualized line rendering for handling huge files smoothly.
 */
export const BlameViewer: React.FC = () => {
  const {
    activeRepoPath,
    blameFile,
    isBlameModalOpen,
    setIsBlameModalOpen,
    setSelectedCommitSha,
    setCurrentNavView,
  } = useGitStore(
    useShallow((s) => ({
      activeRepoPath: s.activeRepoPath,
      blameFile: s.blameFile,
      isBlameModalOpen: s.isBlameModalOpen,
      setIsBlameModalOpen: s.setIsBlameModalOpen,
      setSelectedCommitSha: s.setSelectedCommitSha,
      setCurrentNavView: s.setCurrentNavView,
    }))
  );

  const [blameLines, setBlameLines] = useState<BlameLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: blameLines.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 28,
    overscan: 20,
  });

  useEffect(() => {
    if (!isBlameModalOpen || !activeRepoPath || !blameFile) return;

    setIsLoading(true);
    GitService.getFileBlame(activeRepoPath, blameFile)
      .then((res) => setBlameLines(res || []))
      .catch(() => setBlameLines([]))
      .finally(() => setIsLoading(false));
  }, [isBlameModalOpen, activeRepoPath, blameFile]);

  if (!isBlameModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-sm bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-primary leading-tight truncate">
                File Blame Explorer — {blameFile}
              </h2>
              <p className="text-[11px] text-text-muted">
                Line-by-line commit authorship and date timeline ({blameLines.length} lines)
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsBlameModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition flex-shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Virtualized Blame List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto font-mono text-xs select-text bg-base-0"
        >
          {isLoading ? (
            <div className="p-12 text-center text-text-muted italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-commito-coral" />
              <span>Analyzing line blame history...</span>
            </div>
          ) : blameLines.length === 0 ? (
            <div className="p-12 text-center text-text-muted italic">
              No blame history available for {blameFile}
            </div>
          ) : (
            <div
              className="w-full relative divide-y divide-border/40"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const line = blameLines[virtualRow.index];
                return (
                  <div
                    key={line.line_num}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-stretch hover:bg-base-2 transition group h-[28px]"
                  >
                    {/* Left Column: Author & Commit Meta */}
                    <div className="w-64 px-3 py-1 bg-base-1 border-r border-border flex items-center justify-between flex-shrink-0 select-none text-[11px] text-text-muted">
                      <div className="truncate min-w-0 pr-2">
                        <span className="font-semibold text-text-secondary truncate block leading-tight">
                          {line.author_name}
                        </span>
                        <span className="text-[10px] text-text-faint">{line.date}</span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedCommitSha(line.commit_sha);
                          setIsBlameModalOpen(false);
                          setCurrentNavView('history');
                        }}
                        className="px-1.5 py-0.2 bg-base-3 hover:bg-base-0 border border-border rounded text-[10px] font-mono text-commito-coral transition flex-shrink-0 cursor-pointer"
                        title={`Inspect commit ${line.commit_sha}`}
                      >
                        {line.short_sha}
                      </button>
                    </div>

                    {/* Line Number */}
                    <div className="w-12 py-1 px-2 text-right text-text-faint bg-base-1/50 border-r border-border flex-shrink-0 select-none text-[11px] flex items-center justify-end">
                      {line.line_num}
                    </div>

                    {/* Line Code Content */}
                    <div className="flex-1 px-3 py-1 whitespace-pre text-text-primary text-[12px] flex items-center overflow-hidden">
                      {line.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
