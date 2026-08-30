import { invoke } from '@tauri-apps/api/core';
import { RepoEntry, RepoValidationResult } from '../../types/home';
import {
  RepoStatus,
  FileStatus,
  DiffResult,
  BranchInfo,
  CommitInfo,
  CommitDetails,
  PullResult,
  RemoteInfo,
  WorktreeInfo,
  StashEntry,
  TagInfo,
  BlameLine,
  ReflogEntry,
  SubmoduleInfo,
  GitConfigItem,
  AiCommitSuggestion,
  RemoteValidationResult,
  ImageDiffData,
} from '../../types/git';

/**
 * Options for committing staged changes.
 */
export interface CommitExecutionParams {
  repoPath: string;
  summary: string;
  description?: string | null;
  noVerify?: boolean;
  signOff?: boolean;
  allowEmpty?: boolean;
}

/**
 * Git user identity stored in repository local or global configuration.
 */
export interface GitUserIdentity {
  name?: string;
  email?: string;
}

/**
 * Typed client service for all Tauri backend Git commands.
 */
export class GitService {
  /**
   * Retrieves the current repository status (branches, clean/dirty state, modified/staged files).
   */
  static async getRepoStatus(repoPath: string): Promise<RepoStatus> {
    return invoke<RepoStatus>('get_repo_status', { repoPath });
  }

  /**
   * Retrieves line-by-line diff for a specific file in the working tree.
   */
  static async getFileDiff(
    repoPath: string,
    filePath: string,
    staged: boolean
  ): Promise<DiffResult> {
    return invoke<DiffResult>('get_file_diff', { repoPath, filePath, staged });
  }

  /**
   * Retrieves line-by-line diff for a file in a historical commit.
   */
  static async getCommitFileDiff(
    repoPath: string,
    sha: string,
    filePath: string
  ): Promise<DiffResult> {
    return invoke<DiffResult>('get_commit_file_diff', { repoPath, sha, filePath });
  }

  /**
   * Retrieves image diff and preview payload (base64 data URLs, dimensions, file sizes).
   */
  static async getImageDiffData(
    repoPath: string,
    filePath: string,
    commitSha?: string
  ): Promise<ImageDiffData> {
    return invoke<ImageDiffData>('get_image_diff_data', {
      repoPath,
      filePath,
      commitSha: commitSha || null,
    });
  }

  /**
   * Retrieves text contents for a repository file.
   */
  static async getFileContent(repoPath: string, filePath: string): Promise<string> {
    return invoke<string>('read_file_content_cmd', { repoPath, filePath });
  }

  /**
   * Stages specified files. If files array is empty, all modified files are staged.
   */
  static async stageFiles(repoPath: string, files: string[]): Promise<void> {
    return invoke('stage_files', { repoPath, files });
  }

  /**
   * Unstages specified files from index.
   */
  static async unstageFiles(repoPath: string, files: string[]): Promise<void> {
    return invoke('unstage_files', { repoPath, files });
  }

  /**
   * Commits staged changes to the repository.
   */
  static async commit(params: CommitExecutionParams): Promise<void> {
    return invoke('commit_changes', {
      repoPath: params.repoPath,
      summary: params.summary,
      description: params.description || null,
      noVerify: params.noVerify ?? false,
      signOff: params.signOff ?? false,
      allowEmpty: params.allowEmpty ?? false,
    });
  }

  /**
   * Fetches remote branches and updates references from origin.
   */
  static async fetchRemote(repoPath: string): Promise<void> {
    return invoke('fetch_remote', { repoPath });
  }

  /**
   * Validates whether origin remote exists and is accessible on the server.
   */
  static async validateRemoteOrigin(repoPath: string): Promise<RemoteValidationResult> {
    return invoke<RemoteValidationResult>('validate_remote_origin_cmd', { repoPath });
  }

  /**
   * Pushes the given local branch to its upstream remote.
   */
  static async pushToRemote(repoPath: string, branch: string): Promise<void> {
    return invoke('push_to_remote', { repoPath, branch });
  }

  /**
   * Pushes branch to origin with upstream configuration.
   */
  static async pushBranch(repoPath: string, branch: string, setUpstream = true): Promise<void> {
    return invoke('push_branch', { repoPath, branch, setUpstream });
  }

  /**
   * Pulls latest changes from remote for the current branch.
   */
  static async pullFromRemote(repoPath: string, branch: string): Promise<PullResult> {
    return invoke<PullResult>('pull_from_remote', { repoPath, branch });
  }

  /**
   * Fetches paginated commit log history with optional branch/all filtering and topological sorting.
   */
  static async getCommitHistory(
    repoPath: string,
    limit = 50,
    offset = 0,
    branch?: string | null,
    all?: boolean | null
  ): Promise<CommitInfo[]> {
    return invoke<CommitInfo[]>('get_commit_history', {
      repoPath,
      limit,
      offset,
      branch: branch ?? null,
      all: all ?? null,
    });
  }

  /**
   * Fetches full commit details including affected file stats and parents.
   */
  static async getCommitDetails(repoPath: string, sha: string): Promise<CommitDetails> {
    return invoke<CommitDetails>('get_commit_details', { repoPath, sha });
  }

  /**
   * Lists all local and remote branches for the repository.
   */
  static async listBranches(repoPath: string): Promise<BranchInfo[]> {
    return invoke<BranchInfo[]>('list_branches', { repoPath });
  }

  /**
   * Checks out an existing branch.
   */
  static async checkoutBranch(repoPath: string, branch: string): Promise<void> {
    return invoke('checkout_branch', { repoPath, branch });
  }

  /**
   * Creates and checks out a new branch.
   */
  static async createBranch(repoPath: string, branch: string, startPoint?: string): Promise<void> {
    return invoke('create_branch', { repoPath, branch, startPoint: startPoint || null });
  }

  /**
   * Renames an existing branch.
   */
  static async renameBranch(repoPath: string, oldName: string, newName: string): Promise<void> {
    return invoke('rename_branch', { repoPath, oldName, newName });
  }

  /**
   * Deletes a local branch.
   */
  static async deleteBranch(repoPath: string, branch: string, force = false): Promise<void> {
    return invoke('delete_branch', { repoPath, branch, force });
  }

  /**
   * Discards uncommitted changes for a file in working directory.
   */
  static async discardFileChanges(repoPath: string, filePath: string): Promise<void> {
    return invoke('discard_file_changes_cmd', { repoPath, filePath });
  }

  /**
   * Reads the configured Git identity for a repository.
   */
  static async getUserIdentity(repoPath: string): Promise<GitUserIdentity | null> {
    try {
      return await invoke<GitUserIdentity>('get_git_user_identity_cmd', { repoPath });
    } catch {
      return null;
    }
  }

  /**
   * Stages selected lines or hunks as a unified patch into the Git index.
   */
  static async stagePatch(repoPath: string, patchContent: string): Promise<void> {
    return invoke('stage_patch_cmd', { repoPath, patchContent });
  }

  /**
   * Unstages selected lines or hunks as a unified patch from the Git index.
   */
  static async unstagePatch(repoPath: string, patchContent: string): Promise<void> {
    return invoke('unstage_patch_cmd', { repoPath, patchContent });
  }

  /**
   * Discards selected lines or hunks directly from working copy.
   */
  static async discardPatch(repoPath: string, patchContent: string): Promise<void> {
    return invoke('discard_patch_cmd', { repoPath, patchContent });
  }

  /**
   * Sets a Git configuration key in the repository's local config.
   */
  static async setRepoConfig(repoPath: string, key: string, value: string): Promise<void> {
    return invoke('set_repo_git_config_cmd', { repoPath, key, value });
  }

  /**
   * Retrieves all Git configuration settings for the repository.
   */
  static async getRepoConfig(repoPath: string): Promise<GitConfigItem[]> {
    return invoke<GitConfigItem[]>('get_repo_git_config_cmd', { repoPath });
  }

  /**
   * Returns blame data line by line for a file.
   */
  static async getFileBlame(repoPath: string, filePath: string): Promise<BlameLine[]> {
    return invoke<BlameLine[]>('get_file_blame_cmd', { repoPath, filePath });
  }

  /**
   * Lists all reflog entries for HEAD.
   */
  static async listReflog(repoPath: string, limit = 100): Promise<ReflogEntry[]> {
    return invoke<ReflogEntry[]>('list_reflog_cmd', { repoPath, limit });
  }

  // ── Stashes ──────────────────────────────────────────────────────────────────

  /**
   * Lists all stashes.
   */
  static async listStashes(repoPath: string): Promise<StashEntry[]> {
    return invoke<StashEntry[]>('list_stashes_cmd', { repoPath });
  }

  /**
   * Creates a new stash entry.
   */
  static async createStash(
    repoPath: string,
    message?: string,
    includeUntracked = true
  ): Promise<void> {
    return invoke('create_stash_cmd', { repoPath, message: message || null, includeUntracked });
  }

  /**
   * Applies a stash entry without removing it.
   */
  static async applyStash(repoPath: string, index: number): Promise<void> {
    return invoke('apply_stash_cmd', { repoPath, index });
  }

  /**
   * Applies and drops a stash entry.
   */
  static async popStash(repoPath: string, index: number): Promise<void> {
    return invoke('pop_stash_cmd', { repoPath, index });
  }

  /**
   * Drops a stash entry.
   */
  static async dropStash(repoPath: string, index: number): Promise<void> {
    return invoke('drop_stash_cmd', { repoPath, index });
  }

  /**
   * Lists the files modified in a stash entry.
   */
  static async getStashFiles(repoPath: string, index: number): Promise<FileStatus[]> {
    return invoke<FileStatus[]>('get_stash_files_cmd', { repoPath, index });
  }

  /**
   * Gets the diff of a specific file in a stash entry.
   */
  static async getStashFileDiff(
    repoPath: string,
    index: number,
    filePath: string
  ): Promise<DiffResult> {
    return invoke<DiffResult>('get_stash_file_diff_cmd', { repoPath, index, filePath });
  }

  /**
   * Retrieves diff representation of a stash entry.
   */
  static async getStashDiff(repoPath: string, index: number): Promise<string> {
    return invoke<string>('get_stash_diff_cmd', { repoPath, index });
  }

  // ── Tags ─────────────────────────────────────────────────────────────────────

  /**
   * Lists all tags.
   */
  static async listTags(repoPath: string): Promise<TagInfo[]> {
    return invoke<TagInfo[]>('list_tags_cmd', { repoPath });
  }

  /**
   * Fetches all tags from remote (cloud).
   */
  static async fetchTags(repoPath: string, remote?: string | null): Promise<void> {
    return invoke('fetch_tags_cmd', { repoPath, remote: remote || null });
  }

  /**
   * Creates a tag.
   */
  static async createTag(
    repoPath: string,
    name: string,
    message?: string,
    targetSha?: string | null
  ): Promise<void> {
    return invoke('create_tag_cmd', {
      repoPath,
      name,
      message: message || null,
      targetSha: targetSha || null,
    });
  }

  /**
   * Deletes a tag.
   */
  static async deleteTag(repoPath: string, name: string): Promise<void> {
    return invoke('delete_tag_cmd', { repoPath, name });
  }

  /**
   * Pushes all local tags to remote (default: origin).
   */
  static async pushTags(repoPath: string, remote?: string | null): Promise<void> {
    return invoke('push_tags_cmd', { repoPath, remote: remote || null });
  }

  /**
   * Pushes a specific tag to remote.
   */
  static async pushSpecificTag(
    repoPath: string,
    tagName: string,
    remote?: string | null
  ): Promise<void> {
    return invoke('push_specific_tag_cmd', { repoPath, tagName, remote: remote || null });
  }

  /**
   * Deletes a tag on the remote repository.
   */
  static async deleteRemoteTag(
    repoPath: string,
    tagName: string,
    remote?: string | null
  ): Promise<void> {
    return invoke('delete_remote_tag_cmd', { repoPath, tagName, remote: remote || null });
  }

  // ── Submodules ───────────────────────────────────────────────────────────────

  /**
   * Lists submodules configured in the repository.
   */
  static async listSubmodules(repoPath: string): Promise<SubmoduleInfo[]> {
    return invoke<SubmoduleInfo[]>('list_submodules_cmd', { repoPath });
  }

  /**
   * Initializes registered submodules.
   */
  static async initSubmodules(repoPath: string): Promise<void> {
    return invoke('init_submodules_cmd', { repoPath });
  }

  /**
   * Recursively updates submodules.
   */
  static async updateSubmodules(repoPath: string): Promise<void> {
    return invoke('update_submodules_cmd', { repoPath });
  }

  /**
   * Synchronizes submodule remote URLs with .gitmodules.
   */
  static async syncSubmodules(repoPath: string): Promise<void> {
    return invoke('sync_submodules_cmd', { repoPath });
  }

  // ── Git LFS ──────────────────────────────────────────────────────────────────

  // ── Worktrees ────────────────────────────────────────────────────────────────

  /**
   * Lists active worktrees.
   */
  static async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    return invoke<WorktreeInfo[]>('list_worktrees', { repoPath });
  }

  // ── AI Commit ────────────────────────────────────────────────────────────────

  /**
   * Analyzes git diff changes and generates commit message titles and report using Commit-AI / Google Gemini API.
   */
  static async generateAiCommitMessage(
    repoPath: string,
    stagedOnly = false,
    customApiKey?: string,
    model?: string
  ): Promise<AiCommitSuggestion> {
    return invoke<AiCommitSuggestion>('generate_ai_commit_message_cmd', {
      repoPath,
      stagedOnly,
      customApiKey: customApiKey || null,
      model: model || null,
    });
  }

  // ── File Content & Editing ──────────────────────────────────────────────────

  /**
   * Reads raw file content from the local working repository.
   */
  static async readFileContent(repoPath: string, filePath: string): Promise<string> {
    return invoke<string>('read_file_content_cmd', { repoPath, filePath });
  }

  /**
   * Saves raw file content back to the local repository.
   */
  static async saveFileContent(repoPath: string, filePath: string, content: string): Promise<void> {
    return invoke<void>('save_file_content_cmd', { repoPath, filePath, content });
  }

  /**
   * Creates a directory in the local working repository.
   */
  static async createDirectory(repoPath: string, folderPath: string): Promise<void> {
    return invoke<void>('create_directory_cmd', { repoPath, folderPath });
  }

  /**
   * Renames or moves a file in the local working repository.
   */
  static async renameFile(repoPath: string, oldPath: string, newPath: string): Promise<void> {
    return invoke<void>('rename_file_cmd', { repoPath, oldPath, newPath });
  }

  /**
   * Lists all configured Git remotes for the repository.
   */
  static async listRemotes(repoPath: string): Promise<RemoteInfo[]> {
    return invoke<RemoteInfo[]>('list_remotes_cmd', { repoPath });
  }

  /**
   * Compares two branches and returns the commits and changed files.
   */
  static async getBranchComparison(
    repoPath: string,
    baseBranch: string,
    headBranch: string
  ): Promise<import('../../types/git').BranchComparisonResult> {
    return invoke<import('../../types/git').BranchComparisonResult>('get_branch_comparison', {
      repoPath,
      baseBranch,
      headBranch,
    });
  }

  /**
   * Lists available namespaces/organizations/groups for a provider account.
   */
  static async listNamespaces(
    accountId: string
  ): Promise<import('../../types/git').NamespaceOption[]> {
    return invoke<import('../../types/git').NamespaceOption[]>('accounts_list_namespaces', {
      accountId,
    });
  }

  /**
   * Publishes a local repository to a remote provider (GitHub, GitLab, or Bitbucket).
   */
  static async publishRepository(params: {
    repoPath: string;
    accountId: string;
    name: string;
    description?: string | null;
    isPrivate: boolean;
    namespaceId?: string | null;
  }): Promise<import('../../types/git').PublishResult> {
    return invoke<import('../../types/git').PublishResult>('repo_publish', {
      repoPath: params.repoPath,
      accountId: params.accountId,
      name: params.name,
      description: params.description || null,
      isPrivate: params.isPrivate,
      namespaceId: params.namespaceId || null,
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Git LFS Operations                                                         */
  /* -------------------------------------------------------------------------- */

  /**
   * Checks if Git LFS is installed in system PATH.
   */
  static async checkLfsInstalled(): Promise<boolean> {
    return invoke<boolean>('check_lfs_installed');
  }

  /**
   * Installs Git LFS hooks in the repository.
   */
  static async installLfs(repoPath: string): Promise<void> {
    return invoke<void>('install_lfs', { repoPath });
  }

  /**
   * Lists all Git LFS tracked files in the repository.
   */
  static async listLfsFiles(repoPath: string): Promise<import('../../types/git').LfsFile[]> {
    return invoke<import('../../types/git').LfsFile[]>('list_lfs_files', { repoPath });
  }

  /**
   * Tracks a pattern with Git LFS.
   */
  static async trackLfsPattern(repoPath: string, pattern: string): Promise<void> {
    return invoke<void>('track_lfs_pattern', { repoPath, pattern });
  }

  /**
   * Untracks a pattern from Git LFS.
   */
  static async untrackLfsPattern(repoPath: string, pattern: string): Promise<void> {
    return invoke<void>('untrack_lfs_pattern', { repoPath, pattern });
  }

  /**
   * Lists all currently tracked LFS patterns from .gitattributes.
   */
  static async listLfsTrackedPatterns(repoPath: string): Promise<string[]> {
    return invoke<string[]>('list_lfs_tracked_patterns', { repoPath });
  }

  /**
   * Pulls all Git LFS objects for the current branch.
   */
  static async lfsPull(repoPath: string): Promise<string> {
    return invoke<string>('lfs_pull', { repoPath });
  }

  /**
   * Fetches Git LFS objects.
   */
  static async lfsFetch(repoPath: string, remote?: string): Promise<string> {
    return invoke<string>('lfs_fetch', { repoPath, remote: remote || null });
  }

  /**
   * Pushes Git LFS objects to remote.
   */
  static async lfsPush(repoPath: string, remote?: string): Promise<string> {
    return invoke<string>('lfs_push', { repoPath, remote: remote || null });
  }

  /**
   * Lists all active Git LFS locks.
   */
  static async listLfsLocks(repoPath: string): Promise<import('../../types/git').LfsLock[]> {
    return invoke<import('../../types/git').LfsLock[]>('list_lfs_locks', { repoPath });
  }

  /**
   * Locks a file in Git LFS.
   */
  static async lockLfsFile(repoPath: string, path: string): Promise<void> {
    return invoke<void>('lock_lfs_file', { repoPath, path });
  }

  /**
   * Unlocks a file in Git LFS.
   */
  static async unlockLfsFile(repoPath: string, path: string, force = false): Promise<void> {
    return invoke<void>('unlock_lfs_file', { repoPath, path, force });
  }

  /* -------------------------------------------------------------------------- */
  /* Repository Path Validation & Registry Management                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Validates if a directory exists and has a valid .git repository.
   */
  static async validateRepoPath(path: string): Promise<RepoValidationResult> {
    return invoke<RepoValidationResult>('validate_repo_path_cmd', { path });
  }

  /**
   * Relocates an existing registered repository to a new filesystem path.
   */
  static async relocateRepo(oldPath: string, newPath: string): Promise<RepoEntry> {
    return invoke<RepoEntry>('relocate_repo_cmd', { oldPath, newPath });
  }

  /**
   * Scans all known repositories in registry and removes ones whose paths/git are invalid.
   */
  static async removeInvalidRepos(): Promise<string[]> {
    return invoke<string[]>('remove_invalid_repos_cmd');
  }
}
