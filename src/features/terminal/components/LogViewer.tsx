import React from 'react';
import { X, History, RefreshCw, ScrollText } from 'lucide-react';
import { useTerminalStore } from '../store/terminalStore';
import { LogFilterBar } from './LogFilterBar';
import { LogViewerEntry } from './LogViewerEntry';
import { useAppLogs } from '../hooks/useAppLogs';

export const LogViewer: React.FC = () => {
  const { isLogViewerOpen, activeLogRepoId, closeLogViewer } = useTerminalStore();
  const {
    logs,
    filter,
    setFilter,
    isLoading,
    refresh,
    exportLogs,
    clearAllLogs,
  } = useAppLogs(activeLogRepoId);

  if (!isLogViewerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6 select-none animate-in fade-in duration-150 font-sans">
      <div className="bg-base-0 border border-border rounded-sm shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-base-1 border-b border-border px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-commito-coral" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Application Activity & System Logs
              </h2>
              {activeLogRepoId && (
                <p className="text-[11px] text-text-muted font-mono truncate max-w-md">
                  Active Repo: {activeLogRepoId}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-sm border border-border transition cursor-pointer"
              title="Refresh logs from disk"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={closeLogViewer}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-sm border border-border transition cursor-pointer"
              title="Close log viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <LogFilterBar
          filter={filter}
          onChange={setFilter}
          onClear={clearAllLogs}
          onExport={exportLogs}
          activeRepoId={activeLogRepoId}
        />

        {/* Content Body: Stream of Log Entries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-base-0">
          {isLoading && logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted animate-pulse font-mono">
              Fetching application logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted">
              <ScrollText className="w-12 h-12 text-text-faint mb-3 opacity-40" />
              <p className="text-sm font-medium text-text-secondary">No log entries found</p>
              <p className="text-xs mt-1">
                {filter.search || (filter.categories && filter.categories.length > 0)
                  ? 'Try broadening your search or resetting active filters.'
                  : 'Actions across Git, Accounts, Remotes, Signing, and Terminal will appear here.'}
              </p>
            </div>
          ) : (
            logs.map((entry) => (
              <LogViewerEntry key={entry.id} entry={entry} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="h-8 bg-base-1 border-t border-border px-4 flex items-center justify-between text-[11px] text-text-muted flex-shrink-0">
          <span>Showing {logs.length} entries</span>
          <span className="font-mono text-[10px]">Auto-streaming live events</span>
        </div>
      </div>
    </div>
  );
};
