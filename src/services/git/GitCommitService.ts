import { invoke } from '@tauri-apps/api/core';
import { RepoStatus } from '../../types/git';

export interface CommitParams {
  repoPath: string;
  summary: string;
  description?: string | null;
  noVerify?: boolean;
  signOff?: boolean;
  allowEmpty?: boolean;
}

export interface GitUserIdentity {
  name?: string;
  email?: string;
}

export class GitCommitService {
  static async getIdentity(repoPath: string): Promise<GitUserIdentity | null> {
    try {
      return await invoke<GitUserIdentity>('get_git_user_identity_cmd', { repoPath });
    } catch {
      return null;
    }
  }

  static async commit(params: CommitParams): Promise<void> {
    await invoke('commit_changes', {
      repoPath: params.repoPath,
      summary: params.summary,
      description: params.description || null,
      noVerify: params.noVerify ?? false,
      signOff: params.signOff ?? false,
      allowEmpty: params.allowEmpty ?? false,
    });
  }

  static async getStatus(repoPath: string): Promise<RepoStatus> {
    return await invoke<RepoStatus>('get_repo_status', { repoPath });
  }
}
