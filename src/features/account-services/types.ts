export type ProviderKind = 'gitlab' | 'github';

export type TokenStatus = 'valid' | 'expiring_soon' | 'expired';

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
}

export interface AccountPatch {
  display_name?: string;
  commit_email?: string;
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
