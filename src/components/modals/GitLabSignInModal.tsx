import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  Globe,
  Key,
  Shield,
  ExternalLink,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAccountStore } from '../../store/accountStore';
import { useGitStore } from '../../store/useGitStore';
import { gitLabUserToUnified, GitLabUser } from '../../types/gitlab';
import { getErrorMessage } from '../../shared/utils/errorUtils';

/**
 * Modal dialogue for authenticating with GitLab via OAuth 2.0 PKCE loopback or Personal Access Tokens (PAT).
 */
export const GitLabSignInModal: React.FC = () => {
  const { isSignInModalOpen, setIsSignInModalOpen, fetchAccounts } = useAccountStore();
  const { setUser } = useGitStore();

  const [authMode, setAuthMode] = useState<'oauth' | 'pat'>('oauth');
  const [serverUrl, setServerUrl] = useState('https://gitlab.com');
  const [clientId, setClientId] = useState('');
  const [patToken, setPatToken] = useState('');
  const [customCaPem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isSignInModalOpen) return null;

  const handleStartOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanUrl = serverUrl.trim().replace(/\/$/, '');
    if (!cleanUrl) {
      setLocalError('Please enter a valid GitLab instance URL');
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setLocalError('URL must start with https:// or http://');
      return;
    }

    setIsLoading(true);
    try {
      const pkce = await invoke<{ verifier: string; challenge: string }>('generate_pkce_cmd');
      sessionStorage.setItem('oauth_verifier', pkce.verifier);
      sessionStorage.setItem('oauth_server_url', cleanUrl);

      await invoke('start_oauth_login', {
        serverUrl: cleanUrl,
        challenge: pkce.challenge,
        verifier: pkce.verifier,
        clientId: clientId.trim() ? clientId.trim() : null,
        clientSecret: null,
        useLoopback: true,
      });
    } catch (error: unknown) {
      setLocalError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanUrl = serverUrl.trim().replace(/\/$/, '');
    const cleanToken = patToken.trim();

    if (!cleanUrl) {
      setLocalError('Please enter a valid GitLab instance URL');
      return;
    }
    if (!cleanToken) {
      setLocalError('Please enter your Personal Access Token');
      return;
    }

    setIsLoading(true);
    try {
      const user = await invoke<GitLabUser>('login_gitlab_pat', {
        serverUrl: cleanUrl,
        token: cleanToken,
        customCaPem: customCaPem.trim() ? customCaPem.trim() : null,
      });

      setUser(gitLabUserToUnified(user));
      await fetchAccounts();
      setIsSignInModalOpen(false);
    } catch (error: unknown) {
      setLocalError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-base-1 border border-border rounded-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-base-0 border-b border-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center font-bold text-xs">
              GL
            </div>
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Sign in to GitLab
            </h2>
          </div>
          <button
            onClick={() => setIsSignInModalOpen(false)}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: OAuth PKCE vs Personal Access Token */}
        <div className="p-3 bg-base-0/50 border-b border-border">
          <div className="flex items-center gap-1 bg-base-2 border border-border rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setAuthMode('oauth')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMode === 'oauth'
                  ? 'bg-commito-coral hover:bg-commito-coralLight text-white shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>OAuth 2.0 (PKCE)</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('pat')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMode === 'pat'
                  ? 'bg-commito-coral hover:bg-commito-coralLight text-white shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Access Token (PAT)</span>
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="p-5 space-y-4">
          {localError && (
            <div className="p-3 bg-git-removed-bg border border-git-removed/40 rounded-md flex items-start gap-2.5 text-xs text-git-removed">
              <AlertCircle className="w-4 h-4 text-git-removed flex-shrink-0 mt-0.5" />
              <div className="flex-1">{localError}</div>
            </div>
          )}

          {authMode === 'oauth' ? (
            <form onSubmit={handleStartOAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary flex items-center justify-between">
                  <span>GitLab Instance URL</span>
                  <span className="text-[10px] text-text-muted font-normal">e.g. https://gitlab.com</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://gitlab.com"
                    className="w-full bg-base-2 border border-border rounded-md pl-9 pr-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition font-mono"
                    required
                  />
                </div>
              </div>

              {serverUrl.trim() !== 'https://gitlab.com' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-primary flex items-center justify-between">
                    <span>Custom Client ID (Optional)</span>
                    <span className="text-[10px] text-text-muted font-normal">for self-hosted app</span>
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Leave empty for default"
                    className="w-full bg-base-2 border border-border rounded-md px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition font-mono"
                  />
                </div>
              )}

              <div className="p-3 bg-base-2 border border-border rounded-md text-xs text-text-muted space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-text-secondary">
                  <CheckCircle2 className="w-3.5 h-3.5 text-git-added" />
                  <span>Secure Browser Sign-In</span>
                </div>
                <p className="text-[11px] leading-relaxed text-text-muted">
                  Clicking below will open your default browser to authorize Git Desktop. After approving, you will be redirected back automatically.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Opening Browser...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Sign in with GitLab Browser</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePatLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">GitLab Instance URL</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://gitlab.com"
                    className="w-full bg-base-2 border border-border rounded-md pl-9 pr-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">Personal Access Token (PAT)</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    value={patToken}
                    onChange={(e) => setPatToken(e.target.value)}
                    placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-base-2 border border-border rounded-md pl-9 pr-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition font-mono"
                    required
                  />
                </div>
                <p className="text-[10px] text-text-muted">
                  Requires scopes: <code className="text-commito-coral">api</code> or <code className="text-commito-coral">read_user</code>, <code className="text-commito-coral">write_repository</code>.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Sign in with Token</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
