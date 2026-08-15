import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  History,
  Download,
  Search,
  FileText,
  Calendar,
  Layers,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { ptyBridge } from '../lib/ptyBridge';
import { parseSessionLog } from '../lib/ansiParser';
import { LogSessionSummary, ParsedCommandLog } from '../types';
import { LogViewerEntry } from './LogViewerEntry';
import { useTerminalStore } from '../store/terminalStore';

export const LogViewer: React.FC = () => {
  const { isLogViewerOpen, activeLogRepoId, activeLogSessionId, closeLogViewer } =
    useTerminalStore();

  const [sessions, setSessions] = useState<LogSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [viewMode, setViewMode] = useState<'parsed' | 'raw'>('parsed');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load session list on modal open or repo change
  useEffect(() => {
    if (!isLogViewerOpen || !activeLogRepoId) return;

    setIsLoadingList(true);
    ptyBridge
      .listLogSessions(activeLogRepoId)
      .then((list) => {
        setSessions(list);
        if (list.length > 0) {
          const initialId =
            activeLogSessionId && list.some((s) => s.session_id === activeLogSessionId)
              ? activeLogSessionId
              : list[0].session_id;
          setSelectedSessionId(initialId);
        } else {
          setSelectedSessionId(null);
          setRawTranscript('');
        }
      })
      .catch((err) => {
        console.error('Failed to list log sessions:', err);
      })
      .finally(() => {
        setIsLoadingList(false);
      });
  }, [isLogViewerOpen, activeLogRepoId, activeLogSessionId]);

  // Load selected session transcript
  useEffect(() => {
    if (!activeLogRepoId || !selectedSessionId) {
      setRawTranscript('');
      return;
    }

    setIsLoadingSession(true);
    ptyBridge
      .getLogSession(activeLogRepoId, selectedSessionId)
      .then((content) => {
        setRawTranscript(content);
      })
      .catch((err) => {
        console.error('Failed to load log transcript:', err);
        setRawTranscript('');
      })
      .finally(() => {
        setIsLoadingSession(false);
      });
  }, [activeLogRepoId, selectedSessionId]);

  const parsedEntries: ParsedCommandLog[] = useMemo(() => {
    if (!rawTranscript) return [];
    return parseSessionLog(rawTranscript);
  }, [rawTranscript]);

  const filteredEntries = useMemo(() => {
    if (!searchFilter.trim()) return parsedEntries;
    const q = searchFilter.toLowerCase();
    return parsedEntries.filter(
      (e) =>
        e.command.toLowerCase().includes(q) ||
        (e.output && e.output.toLowerCase().includes(q))
    );
  }, [parsedEntries, searchFilter]);

  const handleExport = async () => {
    if (!activeLogRepoId || !selectedSessionId) return;
    try {
      const destPath = await save({
        filters: [{ name: 'Log File', extensions: ['log', 'txt'] }],
        defaultPath: `${selectedSessionId}.log`,
      });
      if (destPath) {
        await ptyBridge.exportLogSession(activeLogRepoId, selectedSessionId, destPath);
        setStatusMessage('Log session exported successfully!');
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      console.error('Export failed:', err);
      setStatusMessage('Failed to export log.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleRefresh = () => {
    if (!activeLogRepoId) return;
    setIsLoadingList(true);
    ptyBridge
      .listLogSessions(activeLogRepoId)
      .then((list) => {
        setSessions(list);
        if (list.length > 0 && !selectedSessionId) {
          setSelectedSessionId(list[0].session_id);
        }
      })
      .finally(() => setIsLoadingList(false));
  };

  if (!isLogViewerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6 select-none animate-in fade-in duration-150 font-sans">
      <div className="bg-base-0 border border-border rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-base-1 border-b border-border px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-commito-coral" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Repository Terminal Logs
              </h2>
              <p className="text-[11px] text-text-muted font-mono truncate max-w-md">
                {activeLogRepoId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusMessage && (
              <span className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                {statusMessage}
              </span>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoadingList}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
              title="Refresh log sessions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={closeLogViewer}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
              title="Close log viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Left sidebar (Sessions) + Right Pane (Transcript) */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Session List */}
          <div className="w-72 bg-base-1/50 border-r border-border flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-border/70 flex items-center justify-between text-xs text-text-secondary font-medium">
              <span>Past Sessions ({sessions.length})</span>
              <span className="text-[10px] text-text-muted">Retained: Last 20</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-1.5">
              {isLoadingList ? (
                <div className="p-4 text-center text-xs text-text-muted animate-pulse">
                  Loading sessions...
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">
                  <Terminal className="w-8 h-8 mx-auto mb-2 text-text-faint opacity-50" />
                  No past sessions recorded yet for this repository.
                </div>
              ) : (
                sessions.map((sess) => {
                  const isSelected = sess.session_id === selectedSessionId;
                  const dateObj = new Date(sess.date);
                  const formattedDate = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : sess.date;

                  return (
                    <button
                      key={sess.session_id}
                      type="button"
                      onClick={() => setSelectedSessionId(sess.session_id)}
                      className={`w-full p-2.5 rounded-lg text-left transition flex flex-col gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-commito-coral/15 border border-commito-coral/40 text-text-primary'
                          : 'hover:bg-base-2 text-text-secondary border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-commito-coral" />
                          {formattedDate}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">
                          {(sess.size_bytes / 1024).toFixed(1)} KB
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {sess.command_count} command{sess.command_count !== 1 ? 's' : ''}
                        </span>
                        <span className="font-mono text-[9px] truncate max-w-[90px]">
                          {sess.session_id}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Transcript View */}
          <div className="flex-1 flex flex-col min-w-0 bg-base-0 overflow-hidden">
            {selectedSessionId ? (
              <>
                {/* Search & Actions Bar */}
                <div className="h-11 bg-base-1 border-b border-border px-4 flex items-center justify-between gap-3 flex-shrink-0">
                  {/* Search input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter commands or output text..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full bg-base-2 border border-border rounded-md pl-8 pr-3 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commito-coral"
                    />
                    {searchFilter && (
                      <button
                        onClick={() => setSearchFilter('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* View Mode & Export */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-base-2 rounded-md p-0.5 border border-border text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode('parsed')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                          viewMode === 'parsed'
                            ? 'bg-base-0 text-text-primary shadow-sm'
                            : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        Structured
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('raw')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                          viewMode === 'raw'
                            ? 'bg-base-0 text-text-primary shadow-sm'
                            : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        Raw Log
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleExport}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-commito-coral/15 hover:bg-commito-coral/25 border border-commito-coral/40 text-commito-coral text-xs font-medium transition cursor-pointer"
                      title="Export this session transcript to file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                  </div>
                </div>

                {/* Session Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoadingSession ? (
                    <div className="p-8 text-center text-xs text-text-muted animate-pulse">
                      Loading transcript...
                    </div>
                  ) : viewMode === 'raw' ? (
                    <div className="bg-[#0a0d12] border border-border rounded-lg p-4 font-mono text-xs overflow-x-auto select-text">
                      <pre className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {rawTranscript}
                      </pre>
                    </div>
                  ) : filteredEntries.length === 0 ? (
                    <div className="p-8 text-center text-xs text-text-muted">
                      {searchFilter
                        ? `No commands match filter "${searchFilter}"`
                        : 'No command blocks detected in this transcript.'}
                    </div>
                  ) : (
                    filteredEntries.map((entry) => (
                      <LogViewerEntry
                        key={entry.id}
                        entry={entry}
                        searchQuery={searchFilter}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
                <FileText className="w-12 h-12 text-text-faint mb-3 opacity-40" />
                <p className="text-sm font-medium text-text-secondary">
                  No session selected
                </p>
                <p className="text-xs mt-1">
                  Choose a past terminal session from the left sidebar to view its full transcript.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
