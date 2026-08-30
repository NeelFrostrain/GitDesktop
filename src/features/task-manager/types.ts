export type TaskType =
  | 'clone'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'checkout'
  | 'commit'
  | 'stash'
  | 'publish'
  | 'index'
  | 'submodule';

export type TaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskProgress {
  stage: string;
  percent: number;
  detail?: string;
  speed?: string;
  bytesDownloaded?: string;
  totalBytes?: string;
  message?: string;
}

export interface AppTask {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  repoName?: string;
  remoteUrl?: string;
  localPath?: string;
  status: TaskStatus;
  progress: TaskProgress;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  cancellable?: boolean;
}

export interface CloneProgressPayload {
  stage: string;
  percent: number;
  detail: string;
  message: string;
}

export const formatEta = (startedAt: number, percent: number): string | null => {
  if (percent <= 0 || percent >= 100) return null;
  const elapsedSec = (Date.now() - startedAt) / 1000;
  if (elapsedSec < 3) return 'Calculating ETA...';

  const totalSec = (elapsedSec / percent) * 100;
  const remainingSec = Math.max(1, Math.round(totalSec - elapsedSec));

  if (remainingSec < 60) {
    return `~${remainingSec}s left`;
  }
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `~${hours}h ${remMins}m left`;
  }
  return secs > 0 ? `~${mins}m ${secs}s left` : `~${mins}m left`;
};
