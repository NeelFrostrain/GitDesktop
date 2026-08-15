import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Terminal,
  GitBranch,
  User,
  Globe,
  Shield,
  Activity,
  FolderGit2,
  Layers,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Bug,
} from 'lucide-react';
import { LogCategory, LogEntry, LogLevel } from '../../../core/logging';

interface LogViewerEntryProps {
  entry: LogEntry;
  defaultExpanded?: boolean;
}

function getCategoryIcon(cat: LogCategory) {
  switch (cat) {
    case 'Git':
      return <GitBranch className="w-3.5 h-3.5 text-commito-coral" />;
    case 'Account':
      return <User className="w-3.5 h-3.5 text-blue-400" />;
    case 'Remote':
      return <Globe className="w-3.5 h-3.5 text-emerald-400" />;
    case 'Signing':
      return <Shield className="w-3.5 h-3.5 text-purple-400" />;
    case 'Activity':
      return <Activity className="w-3.5 h-3.5 text-amber-400" />;
    case 'Repo':
      return <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />;
    case 'Terminal':
      return <Terminal className="w-3.5 h-3.5 text-rose-400" />;
    case 'App':
      return <Layers className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function getLevelBadge(level: LogLevel) {
  switch (level) {
    case 'Error':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono border border-border bg-base-3 text-text-primary">
          <AlertCircle className="w-2.5 h-2.5 text-red-400" />
          <span>ERROR</span>
        </span>
      );
    case 'Warn':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono border border-border bg-base-3 text-text-primary">
          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
          <span>WARN</span>
        </span>
      );
    case 'Success':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono border border-border bg-base-3 text-text-primary">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
          <span>SUCCESS</span>
        </span>
      );
    case 'Debug':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono border border-border bg-base-3 text-text-muted">
          <Bug className="w-2.5 h-2.5" />
          <span>DEBUG</span>
        </span>
      );
    case 'Info':
    default:
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono border border-border bg-base-3 text-text-muted">
          <Info className="w-2.5 h-2.5" />
          <span>INFO</span>
        </span>
      );
  }
}

export const LogViewerEntry: React.FC<LogViewerEntryProps> = ({
  entry,
  defaultExpanded = false,
}) => {
  const hasDetails = Boolean(entry.metadata);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = entry.metadata
      ? `${entry.message}\n\nMetadata:\n${JSON.stringify(entry.metadata, null, 2)}`
      : entry.message;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = new Date(entry.at).toLocaleTimeString();

  return (
    <div className="border border-border/80 rounded-lg overflow-hidden bg-base-1 transition hover:border-border-strong text-xs">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={`w-full px-3 py-2 bg-base-2/60 hover:bg-base-2 text-left flex items-center justify-between gap-3 transition select-none ${
          hasDetails ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasDetails ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            )
          ) : (
            <div className="w-3.5 h-3.5 flex-shrink-0" />
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {getCategoryIcon(entry.category)}
            <span className="px-1.5 py-0.2 rounded bg-base-3 border border-border text-[10px] font-semibold text-text-muted">
              {entry.category}
            </span>
          </div>

          <span className="font-sans text-text-primary truncate font-medium">
            {entry.message}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 text-[11px]">
          {getLevelBadge(entry.level)}

          <span className="text-text-muted font-mono text-[10px]">
            {formattedTime}
          </span>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy log entry"
            className="p-1 text-text-muted hover:text-text-primary hover:bg-base-3 rounded border border-border/60 transition cursor-pointer"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </button>

      {/* Expanded Metadata Body */}
      {isExpanded && entry.metadata && (
        <div className="p-3 bg-[#0a0d12] border-t border-border/60 font-mono text-xs overflow-x-auto max-h-72 select-text">
          <pre className="text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
