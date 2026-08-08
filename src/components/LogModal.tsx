import React from 'react';
import { 
  X, 
  Terminal, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  Search,
  Filter
} from 'lucide-react';
import { useLogStore, LogLevel } from '../store/useLogStore';
import { Dropdown } from './Dropdown';

export const LogModal: React.FC = () => {

  const {
    logs,
    isLogModalOpen,
    setIsLogModalOpen,
    clearLogs,
    filterLevel,
    setFilterLevel,
    filterCategory,
    setFilterCategory,
    searchQuery,
    setSearchQuery,
  } = useLogStore();

  const [copied, setCopied] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (!isLogModalOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterCategory !== 'all' && log.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchDet = log.details?.toLowerCase().includes(q) || false;
      const matchCat = log.category.toLowerCase().includes(q);
      return matchMsg || matchDet || matchCat;
    }
    return true;
  });

  const handleCopyLogs = () => {
    const formatted = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}${l.details ? `\n  Details: ${l.details}` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return (
          <span className="px-2 py-0.5 bg-green-950/60 text-green-400 border border-green-800/40 rounded text-[10px] font-semibold flex items-center gap-1">
            <Check className="w-2.5 h-2.5" /> SUCCESS
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 bg-red-950/60 text-red-400 border border-red-800/40 rounded text-[10px] font-semibold flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" /> ERROR
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 bg-yellow-950/60 text-yellow-400 border border-yellow-800/40 rounded text-[10px] font-semibold flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> WARNING
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-blue-950/60 text-blue-400 border border-blue-800/40 rounded text-[10px] font-semibold flex items-center gap-1">
            <Info className="w-2.5 h-2.5" /> INFO
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-base-2 border-2 border-gitlab-orange/40 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-12 bg-base-3 border-b border-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gitlab-orange/20 border border-gitlab-orange/40 rounded-md">
              <Terminal className="w-4 h-4 text-gitlab-orange" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                Activity & Action Logs
                <span className="text-[10px] px-2 py-0.5 bg-base-1 border border-border rounded font-mono text-gitlab-orange">
                  {filteredLogs.length} entries
                </span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="px-2.5 py-1 bg-base-2 hover:bg-base-1 border border-border rounded text-xs text-text-primary flex items-center gap-1.5 transition"
              title="Copy visible logs to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-gitlab-teal" /> : <Copy className="w-3.5 h-3.5 text-text-muted" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={clearLogs}
              className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 rounded text-xs flex items-center gap-1.5 transition"
              title="Clear all logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
            <button
              onClick={() => setIsLogModalOpen(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-base-3 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3 bg-base-2/60 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-full pl-8 pr-3 py-1 bg-base-0 border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-gitlab-orange font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            {/* Level Filter */}
            <Dropdown
              options={[
                { value: 'all', label: 'All Levels' },
                { value: 'success', label: 'Success Only' },
                { value: 'error', label: 'Errors Only' },
                { value: 'warning', label: 'Warnings Only' },
                { value: 'info', label: 'Info Only' },
              ]}
              value={filterLevel}
              onChange={(val) => setFilterLevel(val as any)}
              size="sm"
            />

            {/* Category Filter */}
            <Dropdown
              options={[
                { value: 'all', label: 'All Categories' },
                { value: 'Git', label: 'Git Operations' },
                { value: 'Auth', label: 'Authentication' },
                { value: 'Repo', label: 'Repository' },
                { value: 'System', label: 'System' },
              ]}
              value={filterCategory}
              onChange={(val) => setFilterCategory(val as any)}
              size="sm"
            />
          </div>

        </div>

        {/* Logs List */}
        <div className="p-4 flex-1 overflow-y-auto bg-base-1 space-y-2 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-text-muted space-y-2">
              <Terminal className="w-8 h-8 text-text-faint mx-auto opacity-50" />
              <p>No action logs found.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => log.details && setExpandedId(isExpanded ? null : log.id)}
                  className={`p-2.5 rounded-lg border transition ${
                    log.level === 'error'
                      ? 'bg-red-950/20 border-red-900/40 hover:border-red-700/60'
                      : log.level === 'success'
                      ? 'bg-green-950/15 border-green-900/40 hover:border-green-700/60'
                      : log.level === 'warning'
                      ? 'bg-yellow-950/15 border-yellow-900/40 hover:border-yellow-700/60'
                      : 'bg-base-2/80 border-border hover:border-text-muted'
                  } ${log.details ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-[11px] text-text-faint font-mono">{log.timestamp}</span>
                      {getLevelBadge(log.level)}
                      <span className="px-1.5 py-0.5 bg-base-3 border border-border rounded text-[10px] text-text-muted font-semibold">
                        {log.category}
                      </span>
                      <span className="text-text-primary font-medium break-all">{log.message}</span>
                    </div>

                    {log.details && (
                      <span className="text-[10px] text-gitlab-orange hover:underline flex-shrink-0">
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </span>
                    )}
                  </div>

                  {/* Expanded Details / Stack trace */}
                  {isExpanded && log.details && (
                    <div className="mt-2.5 p-2 bg-base-0 border border-border rounded text-[11px] text-red-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                      {log.details}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
