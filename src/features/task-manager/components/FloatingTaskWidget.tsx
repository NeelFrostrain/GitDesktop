import React from 'react';
import { Loader2, ChevronUp, Clock } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { formatEta } from '../types';
import { useGitStore } from '../../../store/useGitStore';

export const FloatingTaskWidget: React.FC = () => {
  const tasks = useTaskStore((s) => s.tasks);
  const isModalOpen = useTaskStore((s) => s.isModalOpen);
  const setModalOpen = useTaskStore((s) => s.setModalOpen);
  const isCloneModalOpen = useGitStore((s) => s.isCloneRepoModalOpen);

  const activeTasks = tasks.filter((t) => t.status === 'running');

  // Don't show floating widget if there are no active tasks or if full modals are already open
  if (activeTasks.length === 0 || isModalOpen || isCloneModalOpen) {
    return null;
  }

  const primaryTask = activeTasks[0];
  const percent = primaryTask.progress.percent || 0;
  const eta = formatEta(primaryTask.startedAt, percent);

  return (
    <div
      onClick={() => setModalOpen(true)}
      className="fixed bottom-4 right-4 z-9999 max-w-sm w-80 bg-base-1/95 border border-border hover:border-border-strong backdrop-blur-md rounded-sm shadow-2xl p-2.5 space-y-1.5 cursor-pointer transition-all duration-150 animate-in slide-in-from-bottom-3 fade-in group select-none"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
          <span className="font-semibold text-xs text-text-primary truncate">
            {primaryTask.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-commito-coral font-bold text-xs">
            {percent}%
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition shrink-0" />
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1 bg-base-2 rounded-full overflow-hidden border border-border/60 relative">
        <div
          className="h-full bg-commito-coral transition-all duration-200 ease-out rounded-full relative"
          style={{ width: `${Math.max(4, percent)}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse" />
        </div>
      </div>

      {/* Details & ETA */}
      <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
        <span className="truncate max-w-[60%]">
          {primaryTask.progress.detail || primaryTask.progress.stage || 'Downloading objects...'}
        </span>
        {eta && (
          <div className="flex items-center gap-1 text-commito-coral font-semibold shrink-0">
            <Clock className="w-2.5 h-2.5 shrink-0 opacity-80" />
            <span>{eta}</span>
          </div>
        )}
      </div>
    </div>
  );
};
