export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  web_url: string;
  server_url: string;
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
}

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
