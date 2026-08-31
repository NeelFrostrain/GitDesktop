import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { useTerminalStore } from './store/terminalStore';
import { useRepoTerminal } from './hooks/useRepoTerminal';
import { TerminalTabBar } from './TerminalTabBar';
import { AutocompletePopup } from './components/AutocompletePopup';
import { LogViewer } from './components/LogViewer';
import { useAppLogs } from './hooks/useAppLogs';
import { LOG_LEVEL_TERMINAL_COLOR, LOG_LEVEL_TERMINAL_TAG } from '../../core/logging';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

const LOG_DISPLAY_LIMIT = 500;

interface LogEntryRowProps {
  entry: ReturnType<typeof useAppLogs>['logs'][number] & { metaJson?: string };
  isExpanded: boolean;
  copiedId: string | null;
  onToggle: (id: string) => void;
  onCopy: (e: React.MouseEvent, id: string, text: string) => void;
}

const LogEntryRow = memo(({ entry, isExpanded, copiedId, onToggle, onCopy }: LogEntryRowProps) => {
  const timeStr = new Date(entry.at).toLocaleTimeString();
  const levelTag = LOG_LEVEL_TERMINAL_TAG[entry.level];
  const levelColor = LOG_LEVEL_TERMINAL_COLOR[entry.level];
  const hasMeta = Boolean(entry.metadata);

  return (
    <div className="leading-snug hover:bg-base-2/60 px-1.5 py-0.5 rounded transition group/entry flex flex-col">
      <div className="flex items-start gap-2 break-all">
        <span className="text-text-muted select-none flex-shrink-0 font-mono text-[11px]">
          [{timeStr}]
        </span>

        <span style={{ color: levelColor }} className="font-bold flex-shrink-0 text-[11px]">
          [{levelTag}]
        </span>

        <span className="text-text-muted select-none flex-shrink-0 text-[11px]">
          [{entry.category}]
        </span>

        <span className="text-text-primary flex-1">{entry.message}</span>

        {hasMeta && (
          <button
            type="button"
            onClick={() => onToggle(entry.id)}
            className="text-text-muted hover:text-text-primary p-0.5 flex-shrink-0 cursor-pointer select-none"
            title="Toggle metadata detail"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={(e) =>
            onCopy(e, entry.id, `[${timeStr}] [${levelTag}] [${entry.category}] ${entry.message}`)
          }
          className="opacity-0 group-hover/entry:opacity-100 text-text-muted hover:text-text-primary p-0.5 flex-shrink-0 transition cursor-pointer select-none"
          title="Copy line"
        >
          {copiedId === entry.id ? (
            <Check className="w-3 h-3 text-git-added" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      </div>

      {isExpanded && entry.metadata && (
        <div className="mt-1 ml-6 p-2.5 bg-base-1 border border-border rounded text-xs text-text-muted overflow-x-auto select-text font-mono">
          <pre className="text-text-primary whitespace-pre-wrap break-words">
            {entry.metaJson ?? JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
});
LogEntryRow.displayName = 'LogEntryRow';

export const TerminalPanel: React.FC = () => {
  const { activeRepoPath, status } = useGitStore();
  const { isOpen, panelHeight, searchQuery } = useTerminalStore();
  const [activeTab, setActiveTab] = useState<'shell' | 'app_log'>('shell');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync active repo id in terminal store for logs
  useEffect(() => {
    if (activeRepoPath) {
      useTerminalStore.setState({ activeLogRepoId: activeRepoPath });
    }
  }, [activeRepoPath]);

  const isShellActive = isOpen && activeTab === 'shell' && Boolean(activeRepoPath);

  const {
    terminalContainerRef,
    isSessionAlive,
    autocomplete,
    cursorPixelPos,
    clearTerminal,
    restartTerminal,
    fitTerminal,
    searchInTerminal,
    applySuggestion,
  } = useRepoTerminal(
    isShellActive ? activeRepoPath : null,
    isShellActive ? activeRepoPath : null,
    isShellActive
  );

  // Re-fit xterm whenever tab switches or panel opens
  useEffect(() => {
    if (activeTab === 'shell' && isOpen) {
      const raf = requestAnimationFrame(() => {
        fitTerminal();
      });
      const timer = setTimeout(() => {
        fitTerminal();
      }, 50);
      const timer2 = setTimeout(() => {
        fitTerminal();
      }, 150);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        clearTimeout(timer2);
      };
    }
  }, [activeTab, isOpen, fitTerminal]);

  // App Logs hook for the streaming view
  const { logs: appLogs, clearAllLogs } = useAppLogs(activeRepoPath);

  // Pre-serialize metadata outside filter — avoids JSON.stringify in the hot filter path
  const logsWithMeta = useMemo(() => {
    return appLogs.map((l) => ({
      ...l,
      metaJson: l.metadata ? JSON.stringify(l.metadata, null, 2) : undefined,
      metaSearch: l.metadata ? JSON.stringify(l.metadata).toLowerCase() : undefined,
    }));
  }, [appLogs]);

  // Filter logs by search query if set
  const displayedLogs = useMemo(() => {
    const filtered = !searchQuery.trim()
      ? logsWithMeta
      : (() => {
          const q = searchQuery.toLowerCase();
          return logsWithMeta.filter(
            (l) =>
              l.message.toLowerCase().includes(q) ||
              l.category.toLowerCase().includes(q) ||
              l.level.toLowerCase().includes(q) ||
              (l.metaSearch && l.metaSearch.includes(q))
          );
        })();
    return showAllLogs ? filtered : filtered.slice(-LOG_DISPLAY_LIMIT);
  }, [logsWithMeta, searchQuery, showAllLogs]);

  const totalFilteredCount = useMemo(() => {
    if (!searchQuery.trim()) return appLogs.length;
    const q = searchQuery.toLowerCase();
    return appLogs.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.level.toLowerCase().includes(q)
    ).length;
  }, [appLogs, searchQuery]);

  // Auto-scroll to bottom when new logs arrive in App Log view
  useEffect(() => {
    if (activeTab === 'app_log' && autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [displayedLogs, activeTab, autoScroll]);

  const toggleLogExpand = useCallback((id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleCopyLog = useCallback((e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  if (!activeRepoPath) {
    return <LogViewer />;
  }

  const repoName =
    activeRepoPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'Repository';

  return (
    <>
      <div
        style={{
          height: `${panelHeight}px`,
          display: isOpen ? 'flex' : 'none',
        }}
        className="relative w-full bg-base-0 border-x border-t  border-border/80 flex-col flex-shrink-0 select-none group/terminal z-20 shadow-2xs overflow-hidden"
      >
        {/* Header bar with Shell / App Log tab selector */}
        <TerminalTabBar
          repoName={repoName}
          branchName={status?.current_branch}
          isAlive={isSessionAlive}
          activeTab={activeTab}
          onTabChange={(tab: 'shell' | 'app_log') => {
            setActiveTab(tab);
            if (tab === 'shell') {
              setTimeout(fitTerminal, 20);
            }
          }}
          onClear={activeTab === 'shell' ? clearTerminal : clearAllLogs}
          onRestart={restartTerminal}
          onSearch={(q: string) => {
            if (activeTab === 'shell') {
              searchInTerminal(q, true);
            }
          }}
          autoScroll={autoScroll}
          onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
          logCount={displayedLogs.length}
        />

        {/* Viewport Area: Both views stay mounted in DOM to preserve state and stream buffer */}
        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-base-0">
          {/* 1. Shell View (xterm.js PTY) */}
          <div
            className={`relative w-full h-full p-2 bg-base-0 overflow-hidden ${
              activeTab === 'shell' ? 'flex flex-col' : 'hidden'
            }`}
          >
            <div
              ref={terminalContainerRef}
              className="w-full h-full font-mono [&_.xterm]:font-mono [&_.xterm-viewport]:bg-base-0 [&_.xterm-rows]:font-mono"
            />

            {/* Ghost Text Overlay if available */}
            {autocomplete.ghostText && autocomplete.isVisible && (
              <div className="absolute right-4 bottom-2 pointer-events-none text-xs font-mono text-text-muted bg-base-2/90 px-2.5 py-1 rounded-sm border border-border shadow-md">
                Suggestion remainder:{' '}
                <span className="text-text-primary font-semibold">{autocomplete.ghostText}</span>
              </div>
            )}

            {/* Autocomplete Popup list */}
            {autocomplete.isVisible && (
              <AutocompletePopup
                suggestions={autocomplete.suggestions}
                selectedIndex={autocomplete.selectedIndex}
                onSelect={(item) =>
                  applySuggestion(item.value, autocomplete.suggestions.length === 1)
                }
                position={cursorPixelPos}
                containerRef={terminalContainerRef}
              />
            )}
          </div>

          {/* 2. App Log View (Colorized live streaming logger) */}
          <div
            className={`relative w-full h-full flex-col bg-base-0 text-xs font-mono select-text ${
              activeTab === 'app_log' ? 'flex' : 'hidden'
            }`}
          >
            {/* Log Stream Output */}
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-base-3 bg-base-0"
            >
              {displayedLogs.length === 0 ? (
                <div className="p-8 text-center text-text-muted italic select-none">
                  No log entries recorded for this repository yet.
                </div>
              ) : (
                <>
                  {!showAllLogs && totalFilteredCount > LOG_DISPLAY_LIMIT && (
                    <div className="px-2 py-1.5 text-center text-[11px] text-text-muted border-b border-border/60 bg-base-1 sticky top-0">
                      Showing last {LOG_DISPLAY_LIMIT} of {totalFilteredCount} entries.{' '}
                      <button
                        type="button"
                        onClick={() => setShowAllLogs(true)}
                        className="text-commito-coral hover:underline cursor-pointer"
                      >
                        Show all
                      </button>
                    </div>
                  )}
                  {displayedLogs.map((entry) => (
                    <LogEntryRow
                      key={entry.id}
                      entry={entry}
                      isExpanded={Boolean(expandedLogIds[entry.id])}
                      copiedId={copiedId}
                      onToggle={toggleLogExpand}
                      onCopy={handleCopyLog}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log Viewer Modal */}
      <LogViewer />
    </>
  );
};
