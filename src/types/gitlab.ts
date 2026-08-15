export type Provider = 'gitlab' | 'github';

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  web_url: string;
  server_url: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  html_url: string;
  server_url: string;
}

export interface TokenInfo {
  scope: string[];
  created_at?: number | null;
  expires_in_seconds?: number | null;
  resource_owner_id?: number | null;
}

/** Unified user shape used in the store — covers both GitLab and GitHub */
export interface UnifiedUser {
  id: number;
  /** Display name */
  name: string;
  /** Username / login handle */
  username: string;
  email: string | null;
  avatar_url: string | null;
  /** Profile URL */
  web_url: string;
  server_url: string;
  provider: Provider;
}

export interface SavedAccount {
  id: string;
  server_url: string;
  token: string;
  name: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  provider: Provider;
  refresh_token?: string | null;
  expires_at?: number | null;
  scopes?: string[] | null;
  created_at?: number | null;
}

/** Unified repository shape from backend — works for both GitLab and GitHub */
export interface UnifiedRepo {
  id: number;
  name: string;
  path_with_namespace: string;
  http_url_to_repo: string;
  ssh_url_to_repo: string;
  web_url: string;
  default_branch: string | null;
  star_count: number;
  visibility: string;
  provider: Provider;
}

/** Legacy alias for GitLab-only code paths that still use GitLabProject */
export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  http_url_to_repo: string;
  ssh_url_to_repo: string;
  web_url: string;
  default_branch: string | null;
  star_count: number;
  visibility: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  total_pages: number;
}

export interface MergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  source_branch: string;
  target_branch: string;
  web_url: string;
  created_at: string;
}

// Helpers
export function gitLabUserToUnified(user: GitLabUser): UnifiedUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar_url: user.avatar_url,
    web_url: user.web_url,
    server_url: user.server_url,
    provider: 'gitlab',
  };
}

export function gitHubUserToUnified(user: GitHubUser): UnifiedUser {
  return {
    id: user.id,
    name: user.name || user.login,
    username: user.login,
    email: user.email,
    avatar_url: user.avatar_url,
    web_url: user.html_url,
    server_url: user.server_url,
    provider: 'github',
  };
}
