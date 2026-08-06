export type FileStatusKind = 'Modified' | 'Staged' | 'Untracked' | 'Deleted' | 'Renamed' | 'Conflicted';

export interface FileStatus {
  path: string;
  status: FileStatusKind;
  staged: boolean;
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

export interface RepoStatus {
  current_branch: string;
  ahead: number;
  behind: number;
  files: FileStatus[];
  is_clean: boolean;
  has_conflicts: boolean;
}

export interface DiffLine {
  line_type: 'addition' | 'deletion' | 'context' | 'header';
  old_line_num: number | null;
  new_line_num: number | null;
  content: string;
}

export interface DiffResult {
  file_path: string;
  lines: DiffLine[];
  is_binary: boolean;
  is_large_file: boolean;
  file_size_bytes: number;
}

export interface CommitInfo {
  sha: string;
  short_sha: string;
  author_name: string;
  author_email: string;
  message: string;
  timestamp: number;
  relative_date: string;
}

export interface CommitDetails {
  commit: CommitInfo;
  changed_files: string[];
}

export interface PullResult {
  success: boolean;
  conflicts: string[];
  commits_pulled: number;
}

export interface AppError {
  code: string;
  message: string;
}
