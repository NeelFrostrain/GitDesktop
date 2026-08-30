import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FolderOpen,
  Trash2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { AppTask, formatEta } from '../types';
import { openRepo } from '../../repos';
import { SystemService } from '../../../services/system/systemService';
import { useGitStore } from '../../../store/useGitStore';

/**
 * Modern Task Manager modal dialog for monitoring background Git operations,
 * repository cloning tasks, and runtime jobs with real-time streaming progress.
 */
export const TaskManagerModal: React.FC = () => {
  const isModalOpen = useTaskStore((s) => s.isModalOpen);
  const setModalOpen = useTaskStore((s) => s.setModalOpen);
  const tasks = useTaskStore((s) => s.tasks);
  const cancelTask = useTaskStore((s) => s.cancelTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const clearFinishedTasks = useTaskStore((s) => s.clearFinishedTasks);
  const setCurrentNavView = useGitStore((s) => s.setCurrentNavView);

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');

  if (!isModalOpen) return null;

  const activeTasks = tasks.filter((t) => t.status === 'running');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const failedTasks = tasks.filter((t) => t.status === 'failed' || t.status === 'cancelled');

  const filteredTasks =
    activeTab === 'active'
      ? activeTasks
      : activeTab === 'completed'
      ? completedTasks
      : tasks;

  const handleOpenRepo = async (task: AppTask) => {
    if (task.localPath) {
      try {
        await openRepo(task.localPath);
        setCurrentNavView('workspace');
        setModalOpen(false);
      } catch (err) {
        console.error('Failed to open repo:', err);
      }
    }
  };

  const handleShowInExplorer = async (task: AppTask) => {
    if (task.localPath) {
      try {
        await SystemService.showInExplorer(task.localPath);
      } catch (err) {
        console.error('Failed to open in explorer:', err);
      }
    }
  };

  const formatDuration = (startedAt: number, finishedAt?: number) => {
    const end = finishedAt || Date.now();
    const sec = Math.max(1, Math.round((end - startedAt) / 1000));
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${min}m ${remSec}s`;
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-manager-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setModalOpen(false);
        }
      }}
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-100"
    >
      <div
        className="w-full max-w-xl bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="px-4 py-2.5 bg-base-1 border-b border-border flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <h2 id="task-manager-title" className="text-xs font-bold text-text-primary leading-none truncate">
              Task Manager
            </h2>
            <span className="text-border">•</span>
            <span className="text-[11px] text-text-muted font-mono leading-none truncate">
              {activeTasks.length > 0
                ? `${activeTasks.length} running • ${tasks.length} total`
                : `${tasks.length} total task${tasks.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {tasks.some((t) => t.status !== 'running') && (
              <button
                type="button"
                onClick={clearFinishedTasks}
                className="h-7 px-2.5 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[11px] font-medium text-text-secondary hover:text-text-primary transition inline-flex items-center justify-center gap-1.5 leading-none cursor-pointer active:scale-98"
                title="Clear finished tasks"
              >
                <Trash2 className="w-3 h-3 text-text-muted" />
                <span>Clear Finished</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
              title="Close (Esc)"
              aria-label="Close dialog"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Filters Bar */}
        <div className="px-4 py-2 bg-base-1/50 border-b border-border flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1 bg-base-0 p-0.5 rounded-xs border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-xs text-[11.5px] font-medium transition cursor-pointer leading-none flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-base-2 text-text-primary font-semibold shadow-2xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] font-mono text-text-muted">{tasks.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-2.5 py-1 rounded-xs text-[11.5px] font-medium transition cursor-pointer leading-none flex items-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-base-2 text-text-primary font-semibold shadow-2xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>Active</span>
              {activeTasks.length > 0 && (
                <span className="px-1 py-0.2 rounded-xs bg-commito-coral text-white text-[9.5px] font-mono font-bold leading-none">
                  {activeTasks.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-2.5 py-1 rounded-xs text-[11.5px] font-medium transition cursor-pointer leading-none flex items-center gap-1.5 ${
                activeTab === 'completed'
                  ? 'bg-base-2 text-text-primary font-semibold shadow-2xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>Completed</span>
              <span className="text-[10px] font-mono text-text-muted">{completedTasks.length}</span>
            </button>
          </div>

          <span className="text-[10.5px] text-text-muted font-mono hidden sm:inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Streaming</span>
          </span>
        </div>

        {/* Task List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2.5 min-h-[220px] max-h-[460px]">
          {filteredTasks.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center justify-center space-y-2 text-text-muted">
              <div className="w-8 h-8 rounded-sm bg-base-1 border border-border flex items-center justify-center text-text-muted">
                <Clock className="w-4 h-4 opacity-60" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">No Tasks Found</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {activeTab === 'active'
                    ? 'No background tasks are currently running.'
                    : 'No tasks registered yet.'}
                </p>
              </div>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isRunning = task.status === 'running';
              const isCompleted = task.status === 'completed';
              const isFailed = task.status === 'failed';
              const isCancelled = task.status === 'cancelled';

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-sm border transition bg-base-1/50 space-y-2 ${
                    isRunning
                      ? 'border-border-strong bg-base-1/80 shadow-2xs'
                      : isCompleted
                      ? 'border-border hover:border-border-strong'
                      : 'border-git-removed/30 bg-git-removed-bg/10'
                  }`}
                >
                  {/* Task Header Row */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {/* Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {isRunning ? (
                          <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isCancelled ? (
                          <XCircle className="w-3.5 h-3.5 text-text-muted" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-git-removed" />
                        )}
                      </div>

                      {/* Title & Path */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-xs text-text-primary truncate">
                            {task.title}
                          </span>
                          <span className="px-1.5 py-0.2 bg-base-0 text-text-muted text-[9.5px] font-mono uppercase tracking-wider rounded-xs border border-border shrink-0">
                            {task.type}
                          </span>
                        </div>

                        {task.localPath && (
                          <div className="text-[10px] text-text-muted font-mono truncate mt-0.5">
                            {task.localPath}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side: Percent badge or Duration */}
                    <div className="text-right shrink-0">
                      {isRunning ? (
                        <span className="font-mono text-commito-coral font-bold text-xs">
                          {task.progress.percent}%
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-text-muted font-mono">
                          {formatDuration(task.startedAt, task.finishedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Progress Track (if running) */}
                  {isRunning && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="w-full h-1 bg-base-0 rounded-full overflow-hidden border border-border/80 relative">
                        <div
                          className="h-full bg-commito-coral transition-all duration-200 ease-out rounded-full relative"
                          style={{ width: `${Math.max(4, task.progress.percent)}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>

                      {/* Detail text & Estimated Time Remaining (ETA) */}
                      <div className="flex items-center justify-between text-[10.5px] text-text-muted font-mono">
                        <span className="truncate max-w-[70%]">
                          {task.progress.detail || task.progress.stage || 'Downloading repository objects...'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 text-commito-coral">
                          <Clock className="w-2.5 h-2.5 shrink-0 opacity-80" />
                          <span className="font-semibold">
                            {formatEta(task.startedAt, task.progress.percent) || 'Estimating...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error display if failed */}
                  {isFailed && task.error && (
                    <div className="p-2 bg-git-removed-bg border border-git-removed/30 rounded-xs text-[10.5px] text-git-removed font-mono break-all leading-tight">
                      {task.error}
                    </div>
                  )}

                  {/* Completed Action Shortcuts */}
                  {isCompleted && task.localPath && (
                    <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-border/60">
                      <span className="text-[10.5px] text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>Ready in {formatDuration(task.startedAt, task.finishedAt)}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleShowInExplorer(task)}
                          className="h-7 px-2.5 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[11px] font-medium text-text-secondary hover:text-text-primary transition inline-flex items-center justify-center gap-1.5 leading-none cursor-pointer active:scale-98"
                          title="Open folder in Windows Explorer"
                        >
                          <FolderOpen className="w-3 h-3 text-text-muted" />
                          <span>Show in Explorer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRepo(task)}
                          className="h-7 px-3 bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white rounded-xs text-[11px] font-medium transition inline-flex items-center justify-center gap-1.5 leading-none cursor-pointer shadow-xs active:scale-98"
                          title="Open in GitDesktop"
                        >
                          <span>Open in GitDesktop</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions for running, failed, or cancelled tasks */}
                  {isRunning ? (
                    <div className="pt-1 flex items-center justify-end gap-2 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => cancelTask(task.id)}
                        className="h-6.5 px-2.5 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[10.5px] font-medium text-text-muted hover:text-git-removed transition inline-flex items-center justify-center leading-none cursor-pointer active:scale-98"
                      >
                        Cancel Task
                      </button>
                    </div>
                  ) : (isFailed || isCancelled) ? (
                    <div className="pt-1 flex items-center justify-end gap-2 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        className="h-6.5 px-2.5 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[10.5px] font-medium text-text-muted hover:text-text-primary transition inline-flex items-center justify-center leading-none cursor-pointer active:scale-98"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Compact Footer Bar */}
        <div className="px-4 py-2.5 bg-base-1 border-t border-border flex items-center justify-between text-xs text-text-muted shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 truncate font-mono text-[11px]">
            <span>{tasks.length} total</span>
            <span>•</span>
            <span className="text-emerald-400">{completedTasks.length} completed</span>
            {failedTasks.length > 0 && (
              <>
                <span>•</span>
                <span className="text-git-removed">{failedTasks.length} failed</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="h-7 px-3.5 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-xs font-medium text-text-primary transition inline-flex items-center justify-center leading-none cursor-pointer active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
