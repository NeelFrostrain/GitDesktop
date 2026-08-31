/**
 * Stored repository registry item.
 */
export interface RepoEntry {
  id: string;
  path: string;
  name: string;
  last_opened_at: number;
  pinned: boolean;
}

/**
 * Summary status displayed for a repository on the Home Dashboard.
 */
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
  is_valid?: boolean;
  error_type?: 'folder_missing' | 'not_a_git_repo' | 'corrupt_git_repo' | string | null;
  error_message?: string | null;
}

/**
 * Result of checking a repository folder and .git structure validity.
 */
export interface RepoValidationResult {
  path: string;
  is_valid: boolean;
  error_type?: string | null;
  error_message?: string | null;
}

/**
 * Local or remote Git commit activity event payload.
 */
export interface CommitActivity {
  type: 'Commit';
  sha: string;
  short_sha: string;
  summary: string;
  author: string;
  author_email: string;
}

/**
 * Remote branch push activity event payload.
 */
export interface PushActivity {
  type: 'Push';
  remote: string;
  branch: string;
  commit_count: number;
}

/**
 * Merge request / Pull request lifecycle activity event.
 */
export interface MergeRequestActivity {
  type: 'MergeRequest';
  title: string;
  state: 'opened' | 'merged' | 'closed' | string;
  url: string;
  author: string;
  source_branch: string;
  target_branch: string;
}

/**
 * CI/CD pipeline run activity event.
 */
export interface PipelineActivity {
  type: 'Pipeline';
  status: 'success' | 'failed' | 'running' | 'canceled' | string;
  branch: string;
  url: string;
}

/**
 * Union of all activity event payload kinds.
 */
export type ActivityKind = CommitActivity | PushActivity | MergeRequestActivity | PipelineActivity;

/**
 * Unified activity feed entry displaying timestamped events across repositories.
 */
export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  repo_path: string;
  repo_name: string;
  /** Unix timestamp in milliseconds or seconds */
  at: number;
  relative_date: string;
}
