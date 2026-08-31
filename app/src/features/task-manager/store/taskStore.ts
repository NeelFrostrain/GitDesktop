import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AppTask, TaskProgress, TaskType, CloneProgressPayload } from '../types';

let isListening = false;

export const initTaskManagerListener = async () => {
  if (isListening) return;
  isListening = true;

  try {
    await listen<CloneProgressPayload>('git:clone:progress', (event) => {
      const { tasks, activeTaskId } = useTaskStore.getState();
      const activeTask = activeTaskId
        ? tasks.find((t) => t.id === activeTaskId && t.status === 'running')
        : tasks.find((t) => t.status === 'running' && t.type === 'clone');

      if (activeTask) {
        useTaskStore.getState().updateTaskProgress(activeTask.id, {
          stage: event.payload.stage,
          percent: event.payload.percent,
          detail: event.payload.detail,
          message: event.payload.message,
        });
      }
    });
  } catch (err) {
    console.warn('Failed to init Task Manager listener:', err);
  }
};

// Automatically start listening on import
if (typeof window !== 'undefined') {
  initTaskManagerListener().catch(() => {});
}

interface TaskState {
  tasks: AppTask[];
  isModalOpen: boolean;
  activeTaskId: string | null;

  // Actions
  addTask: (params: {
    type: TaskType;
    title: string;
    description?: string;
    repoName?: string;
    remoteUrl?: string;
    localPath?: string;
    cancellable?: boolean;
  }) => string;

  updateTaskProgress: (id: string, progress: Partial<TaskProgress>) => void;
  completeTask: (id: string) => void;
  failTask: (id: string, error: string) => void;
  cancelTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearFinishedTasks: () => void;

  setModalOpen: (open: boolean) => void;
  toggleModal: () => void;
  setActiveTaskId: (id: string | null) => void;

  // Computed / Selectors
  getActiveTasks: () => AppTask[];
  getCompletedTasks: () => AppTask[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isModalOpen: false,
  activeTaskId: null,

  addTask: (params) => {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newTask: AppTask = {
      id,
      type: params.type,
      title: params.title,
      description: params.description,
      repoName: params.repoName,
      remoteUrl: params.remoteUrl,
      localPath: params.localPath,
      status: 'running',
      progress: {
        stage: 'Initializing',
        percent: 0,
        detail: 'Starting operation...',
        message: 'Starting operation...',
      },
      startedAt: Date.now(),
      cancellable: params.cancellable ?? true,
    };

    set((state) => ({
      tasks: [newTask, ...state.tasks],
      activeTaskId: id,
    }));

    return id;
  },

  updateTaskProgress: (id, progress) => {
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            progress: {
              ...t.progress,
              ...progress,
            },
          };
        }
        return t;
      }),
    }));
  },

  completeTask: (id) => {
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            status: 'completed',
            finishedAt: Date.now(),
            progress: {
              ...t.progress,
              stage: 'Completed',
              percent: 100,
              detail: 'Operation completed successfully.',
            },
          };
        }
        return t;
      }),
      activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
    }));
  },

  failTask: (id, error) => {
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            status: 'failed',
            error,
            finishedAt: Date.now(),
            progress: {
              ...t.progress,
              stage: 'Failed',
              detail: error,
            },
          };
        }
        return t;
      }),
      activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
    }));
  },

  cancelTask: async (id) => {
    try {
      await invoke('cancel_git_operation');
    } catch (err) {
      console.warn('Failed to kill active git process:', err);
    }

    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            status: 'cancelled',
            finishedAt: Date.now(),
            progress: {
              ...t.progress,
              stage: 'Cancelled',
              detail: 'Operation cancelled by user.',
            },
          };
        }
        return t;
      }),
      activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
    }));
  },

  removeTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
    }));
  },

  clearFinishedTasks: () => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status === 'running'),
    }));
  },

  setModalOpen: (open) => set({ isModalOpen: open }),
  toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
  setActiveTaskId: (id) => set({ activeTaskId: id }),

  getActiveTasks: () => {
    return get().tasks.filter((t) => t.status === 'running');
  },

  getCompletedTasks: () => {
    return get().tasks.filter((t) => t.status !== 'running');
  },
}));
