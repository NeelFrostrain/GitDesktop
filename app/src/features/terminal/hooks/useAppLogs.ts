import { useState, useEffect, useCallback, useMemo } from 'react';
import { LogEntry, LogFilter, useAppLogStore } from '../../../core/logging';

export function useAppLogs(repoId?: string | null) {
  const {
    recentLogs,
    filter,
    setFilter,
    resetFilter,
    queryLogs,
    exportLogsDialog,
    clearLogs,
    initEventListener,
  } = useAppLogStore();

  const [persistedLogs, setPersistedLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  // Initialize event listener for real-time live events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    initEventListener().then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [initEventListener]);

  // Query logs from disk whenever filter or repoId changes
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeFilter: LogFilter = {
        ...filter,
        repo_id: repoId || undefined,
      };
      const results = await queryLogs(activeFilter, PAGE_SIZE, page * PAGE_SIZE);
      setPersistedLogs(results);
    } finally {
      setIsLoading(false);
    }
  }, [filter, repoId, page, queryLogs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  // Combine live stream recent logs with queried disk logs (deduplicating by id and signature)
  const combinedLogs = useMemo(() => {
    const map = new Map<string, LogEntry>();
    const seenSignatures = new Set<string>();

    const getSignature = (log: LogEntry) =>
      `${log.level}_${log.category}_${log.message}_${Math.floor(new Date(log.at).getTime() / 2000)}`;

    for (const log of recentLogs) {
      if (!repoId || !filter.this_repo_only || log.repo_id === repoId) {
        const sig = getSignature(log);
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          map.set(log.id, log);
        }
      }
    }
    for (const log of persistedLogs) {
      if (!map.has(log.id)) {
        const sig = getSignature(log);
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          map.set(log.id, log);
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
    );
  }, [recentLogs, persistedLogs, repoId, filter.this_repo_only]);

  const handleClearAllLogs = useCallback(async () => {
    setPersistedLogs([]);
    await clearLogs(repoId || undefined);
  }, [clearLogs, repoId]);

  return {
    logs: combinedLogs,
    filter,
    setFilter,
    resetFilter,
    isLoading,
    refresh: fetchLogs,
    exportLogs: () => exportLogsDialog({ ...filter, repo_id: repoId || undefined }),
    clearAllLogs: handleClearAllLogs,
    page,
    setPage,
  };
}
