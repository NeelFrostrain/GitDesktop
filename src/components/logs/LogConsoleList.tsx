import React, { useRef, useEffect, useState } from 'react';
import { Terminal, ArrowDown } from 'lucide-react';
import { LogEntry } from '../../store/useLogStore';
import { LogConsoleRow } from './LogConsoleRow';

interface LogConsoleListProps {
  logs: LogEntry[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onClearSearch?: () => void;
  isFiltered: boolean;
}

export const LogConsoleList: React.FC<LogConsoleListProps> = ({
  logs,
  expandedId,
  onToggleExpand,
  onClearSearch,
  isFiltered,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const checkIfAtBottom = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 30;
    setIsAtBottom(atBottom);
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  };

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [logs.length]);

  return (
    <div className="relative flex-1 min-h-0 bg-base-0 flex flex-col">
      <div
        ref={containerRef}
        onScroll={checkIfAtBottom}
        className="flex-1 overflow-y-auto divide-y divide-border/20"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-text-muted space-y-2 select-none">
            <Terminal className="w-8 h-8 text-text-faint opacity-40" />
            <h3 className="text-xs font-bold text-text-primary">
              {isFiltered ? 'No matching logs found' : 'No activity logs'}
            </h3>
            <p className="text-[11px] text-text-muted max-w-xs">
              {isFiltered
                ? 'Try clearing your search query or level/category filters.'
                : 'Actions and Git operations will appear here in real time as they happen.'}
            </p>
            {isFiltered && onClearSearch && (
              <button
                type="button"
                onClick={onClearSearch}
                className="mt-2 px-3 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-xs font-semibold text-commito-coral transition cursor-pointer"
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          logs.map((log) => (
            <LogConsoleRow
              key={log.id}
              log={log}
              isExpanded={expandedId === log.id}
              onToggleExpand={() => onToggleExpand(log.id)}
            />
          ))
        )}
      </div>

      {/* Floating button when new activity occurs while scrolled up */}
      {!isAtBottom && logs.length > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 right-5 px-3 py-1 bg-commito-coral hover:bg-commito-coralHover text-white rounded-full text-xs font-bold shadow-lg border border-white/20 flex items-center gap-1.5 transition animate-in fade-in slide-in-from-bottom-2 duration-150 cursor-pointer z-20"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>New activity</span>
        </button>
      )}
    </div>
  );
};
