import React, { useState, useEffect, useMemo } from 'react';
import { useLogStore, LogCategory } from '../../store/useLogStore';
import { LogConsoleHeader } from './LogConsoleHeader';
import { LogConsoleToolbar } from './LogConsoleToolbar';
import { LogConsoleList } from './LogConsoleList';

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

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Extract dynamic categories present in current log store
  const availableCategories = useMemo(() => {
    const set = new Set<LogCategory>();
    logs.forEach((l) => set.add(l.category));
    return Array.from(set);
  }, [logs]);

  // Filter logs by level, category, and search query
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel !== 'all' && log.level !== filterLevel) return false;
      if (filterCategory !== 'all' && log.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMsg = log.message.toLowerCase().includes(q);
        const matchDet = log.details?.toLowerCase().includes(q) || false;
        const matchCat = log.category.toLowerCase().includes(q);
        const matchTime = log.timestamp.toLowerCase().includes(q);
        return matchMsg || matchDet || matchCat || matchTime;
      }
      return true;
    });
  }, [logs, filterLevel, filterCategory, searchQuery]);

  // Handle Ctrl+F / Esc keyboard shortcuts
  useEffect(() => {
    if (!isLogModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLogModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLogModalOpen, setIsLogModalOpen]);

  if (!isLogModalOpen) return null;

  const handleCopyLogs = () => {
    const formatted = filteredLogs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}${
            l.details ? `\n  Details: ${l.details}` : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(formatted);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterLevel('all');
    setFilterCategory('all');
  };

  const isFiltered =
    filterLevel !== 'all' || filterCategory !== 'all' || Boolean(searchQuery.trim());

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <LogConsoleHeader
          totalCount={logs.length}
          filteredCount={filteredLogs.length}
          onCopy={handleCopyLogs}
          onClear={clearLogs}
          onClose={() => setIsLogModalOpen(false)}
        />

        <LogConsoleToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterLevel={filterLevel}
          onLevelChange={setFilterLevel}
          filterCategory={filterCategory}
          onCategoryChange={setFilterCategory}
          availableCategories={availableCategories}
        />

        <LogConsoleList
          logs={filteredLogs}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
          onClearSearch={handleClearFilters}
          isFiltered={isFiltered}
        />
      </div>
    </div>
  );
};
