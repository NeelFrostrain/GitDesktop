import React from 'react';
import { Check, AlertCircle, AlertTriangle, Info, ChevronRight, ChevronDown } from 'lucide-react';
import { LogEntry, LogLevel } from '../../store/useLogStore';

interface LogConsoleRowProps {
  log: LogEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const LogConsoleRow: React.FC<LogConsoleRowProps> = ({
  log,
  isExpanded,
  onToggleExpand,
}) => {
  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return (
          <span className="w-20 px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-extrabold flex items-center justify-center gap-1 flex-shrink-0 uppercase tracking-wider">
            <Check className="w-3 h-3 stroke-[3]" /> SUCCESS
          </span>
        );
      case 'error':
        return (
          <span className="w-20 px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded text-[10px] font-extrabold flex items-center justify-center gap-1 flex-shrink-0 uppercase tracking-wider">
            <AlertCircle className="w-3 h-3 stroke-[2.5]" /> ERROR
          </span>
        );
      case 'warning':
        return (
          <span className="w-20 px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded text-[10px] font-extrabold flex items-center justify-center gap-1 flex-shrink-0 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3 stroke-[2.5]" /> WARN
          </span>
        );
      default:
        return (
          <span className="w-20 px-1.5 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded text-[10px] font-semibold flex items-center justify-center gap-1 flex-shrink-0 uppercase tracking-wider">
            <Info className="w-3 h-3" /> INFO
          </span>
        );
    }
  };

  const hasDetails = Boolean(log.details);

  return (
    <div
      onClick={hasDetails ? onToggleExpand : undefined}
      className={`px-3 py-1.5 border-b border-border/40 transition text-xs select-none ${
        log.level === 'error'
          ? 'bg-red-950/10 hover:bg-red-950/20'
          : log.level === 'success'
            ? 'bg-emerald-950/10 hover:bg-emerald-950/20'
            : log.level === 'warning'
              ? 'bg-amber-950/10 hover:bg-amber-950/20'
              : 'hover:bg-base-2/80'
      } ${hasDetails ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Timestamp fixed column */}
        <span className="w-24 text-[11px] text-text-muted font-mono flex-shrink-0">
          {log.timestamp}
        </span>

        {/* Level badge fixed column */}
        {getLevelBadge(log.level)}

        {/* Category tag */}
        <span className="px-1.5 py-0.5 bg-base-3 border border-border rounded text-[10px] text-text-muted font-mono font-medium flex-shrink-0">
          {log.category}
        </span>

        {/* Message flexible text */}
        <span className="text-text-primary font-sans text-xs truncate flex-1 min-w-0">
          {log.message}
        </span>

        {/* Details toggle chevron indicator */}
        {hasDetails && (
          <div className="flex items-center gap-1 text-[10px] text-commito-coral hover:underline flex-shrink-0 ml-auto font-sans font-semibold">
            <span>Details</span>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </div>
        )}
      </div>

      {/* Expanded details stack trace box */}
      {isExpanded && log.details && (
        <div className="mt-2 p-2.5 bg-base-0 border border-border rounded-sm text-[11px] text-red-300 font-mono whitespace-pre-wrap break-all overflow-x-auto shadow-inner">
          {log.details}
        </div>
      )}
    </div>
  );
};
