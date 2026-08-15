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

export interface RemoteInfo {
  name: string;
  url: string;
  push_url?: string | null;
  is_default: boolean;
  ahead: number;
  behind: number;
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

export interface CommitFileStat {
  path: string;
  additions: number;
  deletions: number;
  status: string;
}

export interface CommitInfo {
  sha: string;
  short_sha: string;
  author_name: string;
  author_email: string;
  message: string;
  timestamp: number;
  relative_date: string;
  additions?: number;
  deletions?: number;
}

export interface CommitDetails {
  commit: CommitInfo;
  changed_files: string[];
  total_additions?: number;
  total_deletions?: number;
  file_stats?: CommitFileStat[];
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

export interface LfsFile {
  path: string;
  oid: string;
  size: number;
}

export interface LfsLock {
  id: string;
  path: string;
  owner: string;
  locked_at: string;
}

export interface WorktreeInfo {
  path: string;
  head_sha: string;
  branch: string;
  is_bare: boolean;
  is_detached: boolean;
  is_locked: boolean;
  lock_reason?: string;
}

export interface UnifiedMergeRequest {
  id: string | number;
  iid?: number;
  title: string;
  description: string;
  state: string;
  source_branch: string;
  target_branch: string;
  web_url: string;
  author_name: string;
  author_avatar?: string;
  created_at: string;
}

export type RebaseCommitAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';

export interface RebaseCommitPlanItem {
  sha: string;
  short_sha: string;
  message: string;
  action: RebaseCommitAction;
}

export interface StashEntry {
  index: number;
  sha: string;
  message: string;
  branch: string;
  date: string;
}

export interface TagInfo {
  name: string;
  sha: string;
  message?: string;
  is_annotated: boolean;
  tagger_name?: string;
}

export interface BlameLine {
  line_num: number;
  commit_sha: string;
  short_sha: string;
  author_name: string;
  date: string;
  content: string;
}

export interface ReflogEntry {
  index: number;
  sha: string;
  action: string;
  message: string;
  date: string;
}

export interface ConflictHunk {
  id: string;
  file_path: string;
  ours: string[];
  theirs: string[];
  base: string[];
  start_line: number;
}

export interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  head_sha: string;
  is_dirty: boolean;
  is_initialized: boolean;
}

export interface GitConfigItem {
  key: string;
  value: string;
  scope: 'local' | 'global';
}

export type HistoryOperationType = 'reorder' | 'merge' | 'remove';

export interface ReorderOperation {
  type: 'reorder';
  sourceCommit: CommitInfo;
  targetCommit: CommitInfo;
  position: 'before' | 'after';
}

export interface MergeOperation {
  type: 'merge';
  sourceCommit: CommitInfo;
  targetCommit: CommitInfo;
  newMessage: string;
}

export interface RemoveOperation {
  type: 'remove';
  sourceCommit: CommitInfo;
}

export type HistoryOperation = ReorderOperation | MergeOperation | RemoveOperation;

export interface GpgKeyInfo {
  key_id: string;
  user_id: string;
  email?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
}

export interface SshKeyInfo {
  path: string;
  public_key: string;
  key_type: string;
  comment?: string | null;
  is_agent: boolean;
}

export interface SigningConfig {
  enabled: boolean;
  method: 'gpg' | 'ssh';
  key_id: string;
  scope: 'repo' | 'global';
}

export type VerifyStatus = 'Verified' | 'Unverified' | 'NoSignature' | 'Error';

export interface VerifyResult {
  status: VerifyStatus;
  details?: {
    signer?: string;
    key_id?: string;
    reason?: string;
  } | string;
}
