/**
 * Represents the modification category of a file in the Git working tree.
 */
export type FileStatusKind =
  'Modified' | 'Staged' | 'Untracked' | 'Deleted' | 'Renamed' | 'Conflicted';

/**
 * Status information for an individual file in a repository.
 */
export interface FileStatus {
  path: string;
  status: FileStatusKind;
  staged: boolean;
}

/**
 * AI Generated commit message and technical report from Commit-AI.
 */
export interface AiCommitSuggestion {
  title_options: string[];
  summary: string;
  report: string;
  model_used: string;
}

/**
 * AI Generated release notes, changelog, and title comparing commit ranges.
 */
export interface AiReleaseNotesResult {
  title: string;
  notes: string;
  model_used: string;
  commits_analyzed: number;
  from_tag?: string | null;
}

/**
 * Branch metadata returned by branch listing operations.
 */
export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

/**
 * Information regarding a configured Git remote.
 */
export interface RemoteInfo {
  name: string;
  url: string;
  push_url?: string | null;
  is_default: boolean;
  ahead: number;
  behind: number;
}

/**
 * Aggregate working directory status and branch tracking state.
 */
export interface RepoStatus {
  current_branch: string;
  ahead: number;
  behind: number;
  files: FileStatus[];
  is_clean: boolean;
  has_conflicts: boolean;
  has_remote?: boolean;
  remote_url?: string | null;
}

export interface NamespaceOption {
  id: string;
  name: string;
  description?: string | null;
  kind: string; // 'personal' | 'org' | 'group' | 'workspace'
  avatar_url?: string | null;
}

export interface PublishResult {
  remote_url: string;
  web_url: string;
  branch: string;
}

export interface RemoteValidationResult {
  has_remote: boolean;
  remote_url: string | null;
  is_valid: boolean;
  is_deleted_or_missing: boolean;
  error_message: string | null;
}

/**
 * Line item in a diff output with line numbering and modification category.
 */
export interface DiffLine {
  line_type: 'addition' | 'deletion' | 'context' | 'header';
  old_line_num: number | null;
  new_line_num: number | null;
  content: string;
}

/**
 * Structured diff result for a file.
 */
export interface DiffResult {
  file_path: string;
  lines: DiffLine[];
  is_binary: boolean;
  is_large_file: boolean;
  file_size_bytes: number;
}

/**
 * Image diff payload with base64 data URLs for side-by-side / onion-skin preview.
 */
export interface ImageDiffData {
  file_path: string;
  current_data_url?: string | null;
  previous_data_url?: string | null;
  current_size_bytes: number;
  previous_size_bytes: number;
  mime_type: string;
  is_new: boolean;
  is_deleted: boolean;
  is_modified: boolean;
}

/**
 * Per-file addition and deletion counters within a commit.
 */
export interface CommitFileStat {
  path: string;
  additions: number;
  deletions: number;
  status: string;
}

/**
 * Metadata for a single Git commit.
 */
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
  parent_shas?: string[];
}

/**
 * Detailed commit inspection including changed files and delta counts.
 */
export interface CommitDetails {
  commit: CommitInfo;
  changed_files: string[];
  total_additions?: number;
  total_deletions?: number;
  file_stats?: CommitFileStat[];
}

/**
 * Result of a remote pull operation.
 */
export interface PullResult {
  success: boolean;
  conflicts: string[];
  commits_pulled: number;
}

/**
 * Standardized application error shape across IPC boundaries.
 */
export interface AppError {
  code: string;
  message: string;
}

/**
 * Git LFS tracked file entry.
 */
export interface LfsFile {
  path: string;
  oid: string;
  size: number;
}

/**
 * Git LFS lock record.
 */
export interface LfsLock {
  id: string;
  path: string;
  owner: string;
  locked_at: string;
}

/**
 * Metadata for a linked or bare Git worktree.
 */
export interface WorktreeInfo {
  path: string;
  head_sha: string;
  branch: string;
  is_bare: boolean;
  is_detached: boolean;
  is_locked: boolean;
  lock_reason?: string;
}

export interface MergeRequestLabel {
  name: string;
  color?: string;
}

export interface MergeRequestMember {
  name?: string;
  username?: string;
  avatar_url?: string;
}

/**
 * Unified Merge Request / Pull Request representation.
 */
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
  assignees?: MergeRequestMember[];
  reviewers?: MergeRequestMember[];
  labels?: MergeRequestLabel[];
  milestone?: string;
  is_draft?: boolean;
  repo_full_name?: string;
  total_count?: number;
}

/**
 * Pull request / merge request comment or review item.
 */
export interface PullRequestComment {
  id: number;
  author_name: string;
  author_username: string;
  author_avatar?: string;
  body: string;
  created_at: string;
}

/**
 * Branch comparison between base and head branches.
 */
export interface BranchComparisonResult {
  commits: CommitInfo[];
  files: CommitFileStat[];
  total_additions: number;
  total_deletions: number;
}

/**
 * Action verb applied to a commit during interactive rebase.
 */
export type RebaseCommitAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';

/**
 * Rebase instruction plan row item.
 */
export interface RebaseCommitPlanItem {
  sha: string;
  short_sha: string;
  message: string;
  action: RebaseCommitAction;
}

/**
 * Git stash record.
 */
export interface StashEntry {
  index: number;
  sha: string;
  message: string;
  branch: string;
  date: string;
}

/**
 * Git tag metadata.
 */
export interface TagInfo {
  name: string;
  sha: string;
  message?: string;
  is_annotated: boolean;
  tagger_name?: string;
}

/**
 * Single line blame metadata.
 */
export interface BlameLine {
  line_num: number;
  commit_sha: string;
  short_sha: string;
  author_name: string;
  date: string;
  content: string;
}

/**
 * Git reflog history entry.
 */
export interface ReflogEntry {
  index: number;
  sha: string;
  action: string;
  message: string;
  date: string;
}

/**
 * Three-way conflict hunk in a merge conflict file.
 */
export interface ConflictHunk {
  id: string;
  file_path: string;
  ours: string[];
  theirs: string[];
  base: string[];
  start_line: number;
}

/**
 * Git submodule tracking information.
 */
export interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  head_sha: string;
  is_dirty: boolean;
  is_initialized: boolean;
}

/**
 * Key-value pair in Git repository or global config.
 */
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

/**
 * GPG cryptographic key info.
 */
export interface GpgKeyInfo {
  key_id: string;
  user_id: string;
  email?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
}

/**
 * SSH signing key information.
 */
export interface SshKeyInfo {
  path: string;
  public_key: string;
  key_type: string;
  comment?: string | null;
  is_agent: boolean;
}

/**
 * Commit cryptographic signing configuration.
 */
export interface SigningConfig {
  enabled: boolean;
  method: 'gpg' | 'ssh';
  key_id: string;
  scope: 'repo' | 'global';
}

export type VerifyStatus = 'Verified' | 'Unverified' | 'NoSignature' | 'Error';

/**
 * Cryptographic signature verification result for a commit.
 */
export interface VerifyResult {
  status: VerifyStatus;
  details?:
    | {
        signer?: string;
        key_id?: string;
        reason?: string;
      }
    | string;
}

/**
 * Release asset link and download metadata.
 */
export interface ReleaseAsset {
  name: string;
  url: string;
  size?: number;
  direct_asset_url?: string;
}

/**
 * Git repository Release with release notes, tag association, and publish status.
 */
export interface ReleaseInfo {
  id?: string | number;
  tag_name: string;
  name: string;
  description: string;
  created_at: string;
  released_at?: string;
  author_name?: string;
  author_avatar?: string;
  commit_sha?: string;
  is_draft?: boolean;
  is_prerelease?: boolean;
  is_latest?: boolean;
  upcoming_release?: boolean;
  web_url?: string;
  assets?: ReleaseAsset[];
}

/**
 * Git repository hook information.
 */
export interface GitHookInfo {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  exists: boolean;
  is_executable: boolean;
  script_content: string;
  file_path: string;
  default_template?: string;
}

/**
 * Execution result from running a test Git hook script.
 */
export interface HookTestResult {
  exit_code: number;
  success: boolean;
  stdout: string;
  stderr: string;
  duration_ms: number;
}
