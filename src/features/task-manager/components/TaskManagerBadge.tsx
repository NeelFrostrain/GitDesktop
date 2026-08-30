import React from 'react';
import { Activity, Loader2, AlertCircle } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface TaskManagerBadgeProps {
  className?: string;
}

export const TaskManagerBadge: React.FC<TaskManagerBadgeProps> = ({ className = '' }) => {
  const tasks = useTaskStore((s) => s.tasks);
  const toggleModal = useTaskStore((s) => s.toggleModal);
  const isModalOpen = useTaskStore((s) => s.isModalOpen);

  const activeTasks = tasks.filter((t) => t.status === 'running');
  const failedTasks = tasks.filter((t) => t.status === 'failed');
  const hasRunning = activeTasks.length > 0;
  const hasFailed = failedTasks.length > 0;

  // Primary active task
  const primaryTask = activeTasks[0];
  const activePercent = primaryTask?.progress?.percent ?? 0;

  return (
    <button
      type="button"
      onClick={toggleModal}
      title={
        hasRunning
          ? `${primaryTask?.title || 'Task'} (${activePercent}%) - Click to open Task Manager`
          : 'Task Manager & Background Operations'
      }
      className={`h-6.5 px-2 rounded-sm border flex items-center gap-1.5 transition text-xs font-semibold cursor-pointer shadow-2xs select-none ${
        isModalOpen
          ? 'bg-commito-coral/20 border-commito-coral text-commito-coral font-bold'
          : hasRunning
          ? 'bg-base-1 hover:bg-base-2 border-commito-coral/50 text-text-primary'
          : hasFailed
          ? 'bg-base-1 hover:bg-base-2 border-git-removed/40 text-git-removed hover:text-text-primary'
          : 'bg-base-1 hover:bg-base-2 border-border text-text-muted hover:text-text-primary'
      } ${className}`}
    >
      {hasRunning ? (
        <>
          <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
          <span className="text-text-primary text-[11px] font-semibold truncate max-w-[120px]">
            {activeTasks.length > 1 ? `${activeTasks.length} Tasks` : primaryTask?.title || 'Task'}
          </span>
          <span className="px-1 py-0.2 bg-commito-coral/15 text-commito-coral text-[9.5px] font-mono font-bold rounded-xs leading-none">
            {activePercent}%
          </span>
        </>
      ) : hasFailed ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-git-removed shrink-0" />
          <span className="text-[11.5px] text-text-secondary">Tasks</span>
          <span className="px-1 py-0.2 bg-git-removed-bg text-git-removed text-[9.5px] font-mono font-bold rounded-xs leading-none">
            {failedTasks.length}
          </span>
        </>
      ) : (
        <>
          <Activity className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="text-[11.5px]">Tasks</span>
          {tasks.length > 0 && (
            <span className="text-[10px] text-text-muted font-mono opacity-80">
              ({tasks.length})
            </span>
          )}
        </>
      )}
    </button>
  );
};
