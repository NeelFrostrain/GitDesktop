import { invoke } from '@tauri-apps/api/core';
import { UnifiedMergeRequest } from '../../types/git';

/**
 * Service for fetching and creating GitHub Pull Requests and GitLab Merge Requests.
 */
export class PullRequestService {
  /**
   * Fetches open pull requests (GitHub) or merge requests (GitLab) for a repository.
   */
  static async listOpenPullRequests(
    projectIdOrPath: string,
    serverUrl?: string,
    provider?: string
  ): Promise<UnifiedMergeRequest[]> {
    const res = await invoke<Record<string, unknown>[]>('get_open_merge_requests', {
      projectId: projectIdOrPath,
      serverUrl: serverUrl || null,
      provider: provider || null,
    });

    if (!Array.isArray(res)) return [];

    return res.map((mr) => {
      const author = (mr.author as Record<string, unknown>) || {};
      const prNumber = (mr.iid as number) || (mr.id as number) || 1;
      return {
        id: prNumber,
        iid: prNumber,
        title: (mr.title as string) || '',
        description: (mr.description as string) || '',
        state: (mr.state as string) || 'open',
        source_branch: (mr.source_branch as string) || '',
        target_branch: (mr.target_branch as string) || 'main',
        web_url: (mr.web_url as string) || '#',
        author_name: (author.name as string) || (author.username as string) || 'Git User',
        author_avatar: (author.avatar_url as string) || undefined,
        created_at: (mr.created_at as string) || new Date().toISOString(),
      };
    });
  }

  /**
   * Creates a new pull/merge request.
   */
  static async createPullRequest(
    projectIdOrPath: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string,
    serverUrl?: string,
    provider?: string
  ): Promise<{ web_url?: string }> {
    return invoke<{ web_url?: string }>('create_merge_request', {
      projectId: projectIdOrPath,
      sourceBranch,
      targetBranch,
      title,
      description: description || null,
      serverUrl: serverUrl || null,
      provider: provider || null,
    });
  }

  /**
   * Updates an existing pull/merge request (title, description, target branch, state).
   */
  static async updatePullRequest(
    projectIdOrPath: string,
    mrId: number,
    params: {
      title?: string;
      description?: string;
      targetBranch?: string;
      state?: 'open' | 'closed';
      serverUrl?: string;
      provider?: string;
    }
  ): Promise<UnifiedMergeRequest> {
    return invoke<UnifiedMergeRequest>('update_merge_request', {
      projectId: projectIdOrPath,
      mrId,
      title: params.title || null,
      description: params.description ?? null,
      targetBranch: params.targetBranch || null,
      state: params.state || null,
      serverUrl: params.serverUrl || null,
      provider: params.provider || null,
    });
  }
}

/**
 * Utility to parse repository path (owner/repo or group/subgroup/repo) and provider from remote URL.
 */
export function parseRemoteRepoInfo(remoteUrl?: string | null): {
  projectPath: string;
  provider: 'github' | 'gitlab' | 'unknown';
  serverUrl?: string;
} | null {
  if (!remoteUrl) return null;
  let clean = remoteUrl.trim().replace(/\.git\/?$/, '');

  // 1. Match HTTPS/HTTP format: https://github.com/owner/repo or https://gitlab.com/group/project
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const url = new URL(clean);
      const host = url.hostname.toLowerCase();
      const projectPath = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      const isGitHub = host.includes('github');
      const isGitLab = host.includes('gitlab');
      const provider = isGitHub ? 'github' : isGitLab ? 'gitlab' : 'unknown';
      const serverUrl = isGitHub ? 'https://github.com' : `${url.protocol}//${url.host}`;
      return { projectPath, provider, serverUrl };
    } catch {
      return null;
    }
  }

  // 2. Match SSH Protocol format: ssh://git@github.com/owner/repo or git+ssh://...
  if (clean.startsWith('ssh://') || clean.startsWith('git+ssh://')) {
    try {
      const stripped = clean.replace(/^(?:git\+)?ssh:\/\//, '');
      const slashIdx = stripped.indexOf('/');
      if (slashIdx !== -1) {
        let host = stripped.substring(0, slashIdx);
        if (host.includes('@')) host = host.split('@')[1];
        if (host.includes(':')) host = host.split(':')[0];
        const projectPath = stripped.substring(slashIdx + 1).replace(/^\/+/, '').replace(/\/+$/, '');
        const isGitHub = host.toLowerCase().includes('github');
        const isGitLab = host.toLowerCase().includes('gitlab');
        const provider = isGitHub ? 'github' : isGitLab ? 'gitlab' : 'unknown';
        const serverUrl = isGitHub ? 'https://github.com' : `https://${host}`;
        return { projectPath, provider, serverUrl };
      }
    } catch {
      return null;
    }
  }

  // 3. Match SCP-like SSH format: git@github.com:owner/project or git@gitlab.com:group/project
  const scpMatch = clean.match(/^(?:[\w.-]+@)?([^:/]+):(?:\d+\/)?(.+)$/);
  if (scpMatch) {
    const host = scpMatch[1].toLowerCase();
    const projectPath = scpMatch[2].replace(/^\/+/, '').replace(/\/+$/, '');
    const isGitHub = host.includes('github');
    const isGitLab = host.includes('gitlab');
    const provider = isGitHub ? 'github' : isGitLab ? 'gitlab' : 'unknown';
    const serverUrl = isGitHub ? 'https://github.com' : `https://${host}`;
    return { projectPath, provider, serverUrl };
  }

  return null;
}
