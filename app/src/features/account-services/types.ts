export type ProviderKind = 'gitlab' | 'github' | 'bitbucket' | 'azure' | 'custom';

export type TokenStatus = 'valid' | 'expiring_soon' | 'expired' | 'needs_reauth';

export interface ProviderAccount {
  id: string;
  provider: ProviderKind;
  instance_url: string;
  handle: string;
  display_name: string;
  avatar_url: string;
  commit_email: string;
  is_active: boolean;
  token_status: TokenStatus;
  scopes: string[];
  expires_at?: number | null;
  refresh_token_expires_at?: number | null;
}

export interface AccountPatch {
  display_name?: string;
  commit_email?: string;
  avatar_url?: string;
}

export interface RemoteInfo {
  name: string;
  url: string;
  fetch_url?: string;
  push_url?: string;
  is_default?: boolean;
  ahead?: number;
  behind?: number;
}
