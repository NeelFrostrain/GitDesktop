import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check, Terminal, Clock } from 'lucide-react';
import { ParsedCommandLog } from '../types';

interface LogViewerEntryProps {
  entry: ParsedCommandLog;
  searchQuery?: string;
  defaultExpanded?: boolean;
}

export const LogViewerEntry: React.FC<LogViewerEntryProps> = ({
  entry,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.output || entry.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSuccess = entry.exitCode === 0 || entry.exitCode === undefined;

  return (
    <div className="border border-border/80 rounded-lg overflow-hidden bg-base-1 transition hover:border-border-strong">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-base-2/60 hover:bg-base-2 text-left flex items-center justify-between gap-3 text-xs transition cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          )}
          <Terminal className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
          <span className="font-mono font-semibold text-text-primary truncate">
            {entry.command}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 text-[11px]">
          {entry.timestamp && (
            <span className="flex items-center gap-1 text-text-muted">
              <Clock className="w-3 h-3" />
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          )}

          {entry.exitCode !== undefined && (
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold border ${
                isSuccess
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                  : 'bg-red-950/50 text-red-400 border-red-800/60'
              }`}
            >
              Exit {entry.exitCode}
            </span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            title="Copy command output"
            className="p-1 text-text-muted hover:text-text-primary hover:bg-base-3 rounded border border-border/60 transition cursor-pointer"
          >
            {copied ? (
              <Check className="w-3 h-3 text-gitlab-teal" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </button>

      {/* Expanded Output Body */}
      {isExpanded && (
        <div className="p-3 bg-[#0a0d12] border-t border-border/60 font-mono text-xs overflow-x-auto max-h-72 select-text">
          {entry.output ? (
            <pre className="text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
              {entry.output}
            </pre>
          ) : (
            <span className="text-text-muted italic text-[11px]">
              (No standard output recorded)
            </span>
          )}
        </div>
      )}
    </div>
  );
};
