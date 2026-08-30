import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Activity,
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
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setModalOpen(false);
        }
      }}
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-100"
    >
      <div className="w-full max-w-2xl bg-base-0 border border-border-strong rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-base-1 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-sm bg-base-2 border border-border flex items-center justify-center text-commito-coral shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text-primary leading-tight">
                  Task Manager
                </h3>
                {activeTasks.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-commito-coral/15 text-commito-coral text-[10px] font-mono font-bold rounded-xs animate-pulse">
                    {activeTasks.length} Running
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted leading-tight mt-0.5">
                Background Git operations, cloning tasks, and runtime jobs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {tasks.some((t) => t.status !== 'running') && (
              <button
                type="button"
                onClick={clearFinishedTasks}
                className="h-7 px-2.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-[11px] font-medium text-text-secondary hover:text-text-primary transition flex items-center gap-1.5 cursor-pointer"
                title="Clear finished tasks"
              >
                <Trash2 className="w-3 h-3 text-text-muted" />
                <span>Clear Finished</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-base-2 text-text-muted hover:text-text-primary transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="px-5 py-2 bg-base-1/50 border-b border-border/70 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-sm text-xs font-semibold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-base-2 text-commito-coral shadow-2xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              All Tasks ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 rounded-sm text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-base-2 text-commito-coral shadow-2xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>Active</span>
              {activeTasks.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-commito-coral text-white text-[9.5px] flex items-center justify-center font-bold">
                  {activeTasks.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1 rounded-sm text-xs font-semibold transition cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-base-2 text-commito-coral shadow-2xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Completed ({completedTasks.length})
            </button>
          </div>

          <span className="text-[11px] text-text-muted font-mono hidden sm:inline">
            Real-time streaming active
          </span>
        </div>

        {/* Task List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3 min-h-[260px] max-h-[500px]">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-2.5 text-text-muted">
              <div className="w-10 h-10 rounded-sm bg-base-1 border border-border flex items-center justify-center text-text-muted">
                <Clock className="w-5 h-5 opacity-60" />
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
                  className={`p-3.5 rounded-sm border transition bg-base-1/70 space-y-2.5 ${
                    isRunning
                      ? 'border-commito-coral/50 bg-base-1/90 shadow-2xs'
                      : isCompleted
                      ? 'border-border/80 hover:border-border-strong'
                      : 'border-red-500/30 bg-red-950/10'
                  }`}
                >
                  {/* Task Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {isRunning ? (
                          <Loader2 className="w-4 h-4 text-commito-coral animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : isCancelled ? (
                          <XCircle className="w-4 h-4 text-text-muted" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>

                      {/* Title & Path */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-xs text-text-primary truncate">
                            {task.title}
                          </span>
                          <span className="px-1.5 py-0.2 bg-base-2 text-text-muted text-[9.5px] font-mono uppercase tracking-wider rounded-xs border border-border/70 shrink-0">
                            {task.type}
                          </span>
                        </div>

                        {task.localPath && (
                          <div className="text-[11px] text-text-muted font-mono truncate mt-0.5">
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
                        <span className="text-[11px] text-text-muted font-mono">
                          {formatDuration(task.startedAt, task.finishedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Progress Track (if running) */}
                  {isRunning && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="w-full h-1.5 bg-base-2 rounded-full overflow-hidden border border-border/60 relative">
                        <div
                          className="h-full bg-commito-coral transition-all duration-200 ease-out rounded-full relative"
                          style={{ width: `${Math.max(4, task.progress.percent)}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>

                      {/* Detail text & Estimated Time Remaining (ETA) */}
                      <div className="flex items-center justify-between text-[11px] text-text-muted font-mono">
                        <span className="truncate max-w-[70%]">
                          {task.progress.detail || task.progress.stage || 'Downloading repository objects...'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 text-commito-coral">
                          <Clock className="w-3 h-3 shrink-0 opacity-80" />
                          <span className="font-semibold">
                            {formatEta(task.startedAt, task.progress.percent) || 'Estimating...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error display if failed */}
                  {isFailed && task.error && (
                    <div className="p-2 bg-red-950/30 border border-red-500/30 rounded-xs text-[11px] text-red-300 font-mono break-all leading-tight">
                      {task.error}
                    </div>
                  )}

                  {/* Completed Action Shortcuts */}
                  {isCompleted && task.localPath && (
                    <div className="pt-1 flex items-center justify-between gap-2 border-t border-border/40">
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ready in {formatDuration(task.startedAt, task.finishedAt)}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleShowInExplorer(task)}
                          className="h-6.5 px-2 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[11px] text-text-secondary hover:text-text-primary transition flex items-center gap-1 cursor-pointer"
                          title="Open folder in Windows Explorer"
                        >
                          <FolderOpen className="w-3 h-3 text-text-muted" />
                          <span>Show in Explorer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRepo(task)}
                          className="h-6.5 px-2.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-xs text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-98"
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
                    <div className="pt-1 flex items-center justify-end gap-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => cancelTask(task.id)}
                        className="h-6 px-2 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[10.5px] font-medium text-text-muted hover:text-red-400 transition cursor-pointer"
                      >
                        Cancel Task
                      </button>
                    </div>
                  ) : (isFailed || isCancelled) ? (
                    <div className="pt-1 flex items-center justify-end gap-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        className="h-6 px-2 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[10.5px] font-medium text-text-muted hover:text-text-primary transition cursor-pointer"
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

        {/* Footer info bar */}
        <div className="px-5 py-2.5 bg-base-1 border-t border-border flex items-center justify-between text-xs text-text-muted shrink-0">
          <div className="flex items-center gap-2 min-w-0 truncate font-mono text-[11px]">
            <span>{tasks.length} total tasks</span>
            <span>•</span>
            <span className="text-emerald-400">{completedTasks.length} completed</span>
            {failedTasks.length > 0 && (
              <>
                <span>•</span>
                <span className="text-red-400">{failedTasks.length} failed</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="h-7 px-3.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-medium text-text-primary transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
