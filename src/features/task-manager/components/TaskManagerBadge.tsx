import React from 'react';
import { Activity, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const hasRunning = activeTasks.length > 0;
  const hasFailed = failedTasks.length > 0;

  // Primary active task
  const primaryTask = activeTasks[0];
  const activePercent = primaryTask?.progress?.percent ?? 0;
  const activeStage = primaryTask?.progress?.stage || primaryTask?.title || 'Running...';

  // Recently finished task (< 4 seconds ago)
  const recentCompleted = completedTasks.find(
    (t) => t.finishedAt && Date.now() - t.finishedAt < 4000
  );

  return (
    <button
      type="button"
      onClick={toggleModal}
      title={
        hasRunning
          ? `${primaryTask?.title || 'Task'}: ${activeStage} (${Math.round(activePercent)}%) - Click to open Task Manager`
          : hasFailed
          ? `${failedTasks.length} task(s) failed - Click to view details`
          : 'Task Manager & Background Operations'
      }
      className={`titlebar-no-drag relative overflow-hidden h-6.5 px-2.5 flex items-center gap-1.5 rounded-sm border transition cursor-pointer text-xs font-semibold select-none group shadow-2xs outline-none focus:outline-none ${
        isModalOpen
          ? 'bg-commito-coral/20 border-commito-coral text-commito-coral font-bold'
          : hasRunning
          ? 'bg-base-1 hover:bg-base-2 active:bg-base-3 border-commito-coral/50 text-text-primary'
          : hasFailed
          ? 'bg-base-1 hover:bg-base-2 active:bg-base-3 border-git-removed/40 text-git-removed hover:text-text-primary'
          : 'bg-base-1 hover:bg-base-2 active:bg-base-3 border-border text-text-primary'
      } ${className}`}
    >
      {hasRunning ? (
        <>
          <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
          <span className="truncate max-w-[130px] text-text-primary text-[11px] font-medium">
            {activeTasks.length > 1 ? `${activeTasks.length} Tasks` : activeStage}
          </span>
          <span className="px-1 py-0.2 bg-commito-coral/15 text-commito-coral text-[9.5px] font-mono font-bold rounded-xs leading-none">
            {Math.round(activePercent)}%
          </span>

          {/* Micro Progress Bar pinned at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-commito-coral/20 overflow-hidden">
            {activePercent > 0 ? (
              <div
                className="h-full bg-commito-coral transition-all duration-200"
                style={{ width: `${Math.min(100, Math.max(2, activePercent))}%` }}
              />
            ) : (
              <div className="h-full w-2/5 bg-commito-coral animate-pulse" />
            )}
          </div>
        </>
      ) : recentCompleted ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-git-added shrink-0" />
          <span className="text-[11px] font-medium text-git-added truncate max-w-[120px]">
            {recentCompleted.title}
          </span>
          <span className="px-1 py-0.2 bg-git-added-bg text-git-added text-[9.5px] font-mono font-bold rounded-xs leading-none">
            Done
          </span>
        </>
      ) : hasFailed ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-git-removed shrink-0" />
          <span>Tasks</span>
          <span className="px-1 py-0.2 bg-git-removed-bg text-git-removed text-[9.5px] font-mono font-bold rounded-xs leading-none">
            {failedTasks.length}
          </span>
        </>
      ) : (
        <>
          <Activity className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
          <span>Tasks</span>
        </>
      )}
    </button>
  );
};
