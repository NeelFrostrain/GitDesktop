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
  const hasRunning = activeTasks.length > 0;
  const hasFailed = tasks.some((t) => t.status === 'failed');

  // Primary active task
  const primaryTask = activeTasks[0];
  const activePercent = primaryTask?.progress?.percent ?? 0;

  return (
    <button
      type="button"
      onClick={toggleModal}
      title={
        hasRunning
          ? `${activeTasks.length} active task${activeTasks.length > 1 ? 's' : ''} running (${activePercent}%)`
          : 'Task Manager & Background Operations'
      }
      className={`h-7 px-2.5 rounded-sm border flex items-center gap-1.5 transition text-xs font-medium cursor-pointer shadow-2xs select-none ${
        isModalOpen
          ? 'bg-commito-coral/20 border-commito-coral text-commito-coral font-bold'
          : hasRunning
          ? 'bg-base-1 hover:bg-base-2 border-commito-coral/50 text-text-primary'
          : hasFailed
          ? 'bg-base-1 hover:bg-base-2 border-red-500/40 text-text-secondary hover:text-text-primary'
          : 'bg-base-1 hover:bg-base-2 border-border text-text-muted hover:text-text-primary'
      } ${className}`}
    >
      {hasRunning ? (
        <>
          <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
          <span className="font-semibold text-text-primary text-[11.5px]">
            {activeTasks.length > 1 ? `${activeTasks.length} Tasks` : 'Task'}
          </span>
          <span className="px-1 py-0.2 bg-commito-coral/15 text-commito-coral text-[10px] font-mono font-bold rounded-xs">
            {activePercent}%
          </span>
        </>
      ) : hasFailed ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-[11.5px] text-text-secondary">Tasks</span>
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
