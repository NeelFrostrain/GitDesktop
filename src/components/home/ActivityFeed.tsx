import React, { useState } from 'react';
import {
  Activity,
  RefreshCw,
  Clock,
  Loader2,
} from 'lucide-react';
import { useActivityStore } from '../../store/activityStore';
import { ActivityItem } from './ActivityItem';

export const ActivityFeed: React.FC = () => {
  const { events, isLoadingLocal, isLoadingRemote, refresh, loadLocal } = useActivityStore();
  const [limit, setLimit] = useState(30);

  const handleLoadMore = () => {
    const nextLimit = limit + 20;
    setLimit(nextLimit);
    loadLocal(nextLimit);
  };

  const isBusy = isLoadingLocal || isLoadingRemote;

  return (
    <div className="bg-base-2/60 border border-border rounded-sm p-4 space-y-3 select-none flex flex-col flex-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gitlab-teal" />
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Recent Activity
          </h3>
          {isLoadingRemote && (
            <span className="text-[10px] text-text-muted flex items-center gap-1 font-mono">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              syncing remote...
            </span>
          )}
        </div>

        <button
          onClick={() => refresh()}
          disabled={isBusy}
          className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-3 transition cursor-pointer"
          title="Refresh activity"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-commito-coral ${isBusy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Feed List */}
      {events.length > 0 ? (
        <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[420px] pr-1">
          {events.map((event) => (
            <ActivityItem key={event.id} event={event} />
          ))}

          {/* Load More Button */}
          <div className="pt-2 text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingLocal}
              className="px-3 py-1 bg-base-1 hover:bg-base-3 border border-border rounded-sm text-[11px] text-text-secondary font-medium transition cursor-pointer"
            >
              {isLoadingLocal ? 'Loading...' : 'Load older events'}
            </button>
          </div>
        </div>
      ) : isLoadingLocal ? (
        /* Skeleton loading */
        <div className="space-y-2 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 bg-base-1 border border-border rounded-sm animate-pulse flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-base-3 flex-shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-3 bg-base-3 rounded w-3/4" />
                <div className="h-2 bg-base-3 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-6 bg-base-1 border border-border rounded-sm text-center space-y-2">
          <Clock className="w-6 h-6 mx-auto text-text-muted opacity-40" />
          <p className="text-[11px] text-text-muted">
            No recent activity recorded across your repositories.
          </p>
        </div>
      )}
    </div>
  );
};
