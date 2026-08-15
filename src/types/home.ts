export interface RepoEntry {
  id: string;
  path: string;
  name: string;
  last_opened_at: number;
  pinned: boolean;
}

export interface RepoDashboardStatus {
  current_branch: string;
  ahead: number;
  behind: number;
  dirty_files: number;
  last_commit_summary: string;
  last_commit_at: number;
  last_commit_sha: string;
  remote_name?: string | null;
  remote_provider?: 'gitlab' | 'github' | 'other' | null;
}

export interface CommitActivity {
  type: 'Commit';
  sha: string;
  short_sha: string;
  summary: string;
  author: string;
  author_email: string;
}

export interface PushActivity {
  type: 'Push';
  remote: string;
  branch: string;
  commit_count: number;
}

export interface MergeRequestActivity {
  type: 'MergeRequest';
  title: string;
  state: 'opened' | 'merged' | 'closed' | string;
  url: string;
  author: string;
  source_branch: string;
  target_branch: string;
}

export interface PipelineActivity {
  type: 'Pipeline';
  status: 'success' | 'failed' | 'running' | 'canceled' | string;
  branch: string;
  url: string;
}

export type ActivityKind = CommitActivity | PushActivity | MergeRequestActivity | PipelineActivity;

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  repo_path: string;
  repo_name: string;
  at: number; // Unix timestamp
  relative_date: string;
}
