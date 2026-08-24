import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Key, Globe, AlertCircle, ExternalLink, RefreshCw, Lock } from 'lucide-react';
import { Provider, GitLabUser, GitHubUser, gitLabUserToUnified, gitHubUserToUnified } from '../../../types/gitlab';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';
import { getErrorMessage, toAppError } from '../../../shared/utils/errorUtils';

interface AddAccountTabProps {
  onAccountAdded: () => Promise<void>;
}

interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * Tab component for connecting new GitLab or GitHub accounts via OAuth PKCE or Personal Access Tokens (PAT).
 */
export const AddAccountTab: React.FC<AddAccountTabProps> = ({ onAccountAdded }) => {
  const { setUser, setError } = useGitStore();

  const [provider, setProvider] = useState<Provider>('gitlab');
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('git_desktop_server_url') || 'https://gitlab.com';
  });
  const [patToken, setPatToken] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [customCaPem, setCustomCaPem] = useState('');
  const [showCustomCa, setShowCustomCa] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isGithubAuthenticating, setIsGithubAuthenticating] = useState(false);
  const [isOauthLoading, setIsOauthLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleStartOAuth = async () => {
    setIsOauthLoading(true);
    setLoginError(null);
    try {
      localStorage.setItem('git_desktop_server_url', serverUrl);
      const pkce = await invoke<PkcePair>('generate_pkce_cmd');
      sessionStorage.setItem('oauth_verifier', pkce.verifier);

      const clientId = import.meta.env.VITE_GITLAB_CLIENT_ID || 'gloas-37b1b096e127882b4ea65b3acd3f502d37bcf79ccf6d471367d0910eec5351df';
      const redirectUri = 'http://127.0.0.1:8585/oauth/callback';
      const authUrl = `${serverUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&state=xyz&code_challenge=${pkce.challenge}&code_challenge_method=S256&scope=api+read_user+openid+profile+email+write_repository+read_repository`;

      await openUrl(authUrl);
      useLogStore.getState().addLog('info', 'Auth', `Opened browser for OAuth authorization at ${serverUrl}`);

      // Background listener handles redirect loopback
      invoke<GitLabUser>('start_oauth_login', {
        serverUrl,
        clientId,
        clientSecret: import.meta.env.VITE_GITLAB_CLIENT_SECRET || null,
        verifier: pkce.verifier,
        redirectUri,
      })
        .then(async (loggedUser) => {
          setUser(gitLabUserToUnified(loggedUser));
          await onAccountAdded();
          sessionStorage.removeItem('oauth_verifier');
          setIsOauthLoading(false);
          useGitStore.setState({ isRepoModalOpen: false, error: null });
        })
        .catch((err: unknown) => {
          setIsOauthLoading(false);
          setLoginError(getErrorMessage(err));
        });
    } catch (error: unknown) {
      setIsOauthLoading(false);
      setLoginError(getErrorMessage(error));
    }
  };

  const handleManualCodeSubmit = async () => {
    if (!manualCode.trim()) return;
    setIsOauthLoading(true);
    setLoginError(null);
    try {
      const verifier = sessionStorage.getItem('oauth_verifier') || '';
      let codeToUse = manualCode.trim();
      if (codeToUse.includes('code=')) {
        try {
          const parsed = new URL(codeToUse.startsWith('http') ? codeToUse : `http://dummy/${codeToUse}`);
          codeToUse = parsed.searchParams.get('code') || codeToUse;
        } catch {
          // Keep original code if URL parse fails
        }
      }

      const loggedUser = await invoke<GitLabUser>('complete_oauth_login', {
        serverUrl,
        code: codeToUse,
        verifier,
        clientId: import.meta.env.VITE_GITLAB_CLIENT_ID || null,
        clientSecret: import.meta.env.VITE_GITLAB_CLIENT_SECRET || null,
      });

      setUser(gitLabUserToUnified(loggedUser));
      await onAccountAdded();
      sessionStorage.removeItem('oauth_verifier');
      setIsOauthLoading(false);
      useGitStore.setState({ isRepoModalOpen: false, error: null });
    } catch (error: unknown) {
      setIsOauthLoading(false);
      setLoginError(getErrorMessage(error));
    }
  };

  const handleGitLabPatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patToken.trim()) return;
    setIsAuthenticating(true);
    setLoginError(null);

    try {
      localStorage.setItem('git_desktop_server_url', serverUrl);
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      const loggedUser = await invoke<GitLabUser>('login_gitlab_pat', {
        serverUrl: cleanServerUrl,
        token: patToken.trim(),
        customCaPem: customCaPem.trim() || null,
      });

      setUser(gitLabUserToUnified(loggedUser));
      await onAccountAdded();
      setPatToken('');
      setIsAuthenticating(false);
      useGitStore.setState({ isRepoModalOpen: false, error: null });
    } catch (error: unknown) {
      setIsAuthenticating(false);
      const msg = getErrorMessage(error);
      setLoginError(msg);
      setError(toAppError(error, 'AUTH_ERROR'));
    }
  };

  const handleGitHubPatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubToken.trim()) return;
    setIsGithubAuthenticating(true);
    setLoginError(null);

    try {
      const loggedUser = await invoke<GitHubUser>('login_github_pat', {
        token: githubToken.trim(),
      });

      setUser(gitHubUserToUnified(loggedUser));
      await onAccountAdded();
      setGithubToken('');
      setIsGithubAuthenticating(false);
      useGitStore.setState({ isRepoModalOpen: false, error: null });
    } catch (error: unknown) {
      setIsGithubAuthenticating(false);
      const msg = getErrorMessage(error);
      setLoginError(msg);
      setError(toAppError(error, 'AUTH_ERROR'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Provider Selector Tabs */}
      <div className="flex bg-base-1 p-1 rounded-lg border border-border">
        <button
          type="button"
          onClick={() => {
            setProvider('gitlab');
            setLoginError(null);
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
            provider === 'gitlab'
              ? 'bg-commito-coral text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          GitLab
        </button>
        <button
          type="button"
          onClick={() => {
            setProvider('github');
            setLoginError(null);
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
            provider === 'github'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          GitHub
        </button>
      </div>

      {loginError && (
        <div className="flex items-start gap-2 p-3 bg-git-removed-bg border border-git-removed/40 rounded-lg text-xs text-git-removed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{loginError}</span>
        </div>
      )}

      {/* GitLab Login Options */}
      {provider === 'gitlab' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">GitLab Instance URL</label>
            <div className="flex items-center gap-2 bg-base-1 border border-border rounded-md px-2.5 py-1.5 focus-within:border-commito-coral">
              <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://gitlab.com or https://gitlab.yourcompany.com"
                className="w-full bg-transparent text-xs text-text-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Browser OAuth PKCE */}
          <div className="p-4 rounded-lg bg-base-1 border border-border">
            <h4 className="text-xs font-semibold text-text-primary mb-1">OAuth Authorization (Recommended)</h4>
            <p className="text-[11px] text-text-muted mb-3">
              Authorize securely via your browser without sharing API passwords or keys.
            </p>

            <button
              onClick={handleStartOAuth}
              disabled={isOauthLoading}
              className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-commito-coral text-white text-xs font-semibold hover:bg-commito-coralLight transition disabled:opacity-50 cursor-pointer"
            >
              {isOauthLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              {isOauthLoading ? 'Waiting for authorization...' : 'Sign in with GitLab'}
            </button>

            {isOauthLoading && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <p className="text-[11px] text-text-muted">
                  If the browser redirect doesn't trigger automatically, paste the redirect URL or code below:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Paste code or redirect URL here"
                    className="flex-1 bg-base-0 border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none"
                  />
                  <button
                    onClick={handleManualCodeSubmit}
                    className="px-3 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-xs text-text-primary transition cursor-pointer"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Personal Access Token (PAT) Fallback */}
          <form onSubmit={handleGitLabPatSubmit} className="p-4 rounded-lg bg-base-1 border border-border space-y-3">
            <h4 className="text-xs font-semibold text-text-primary">Personal Access Token (PAT)</h4>
            <p className="text-[11px] text-text-muted">
              Use a Personal Access Token with <code className="text-commito-coral font-mono">api</code> and{' '}
              <code className="text-commito-coral font-mono">read_user</code> scopes.
            </p>

            <div className="flex items-center gap-2 bg-base-0 border border-border rounded-md px-2.5 py-1.5 focus-within:border-commito-coral">
              <Key className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <input
                type="password"
                value={patToken}
                onChange={(e) => setPatToken(e.target.value)}
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-transparent text-xs text-text-primary font-mono focus:outline-none"
              />
            </div>

            {/* Custom SSL Certificate Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowCustomCa(!showCustomCa)}
                className="text-[11px] text-commito-coral hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                {showCustomCa ? 'Hide Custom Root CA' : 'Self-hosted SSL Certificate (PEM)'}
              </button>

              {showCustomCa && (
                <textarea
                  value={customCaPem}
                  onChange={(e) => setCustomCaPem(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  rows={3}
                  className="w-full mt-2 bg-base-0 border border-border rounded p-2 text-[11px] font-mono text-text-primary focus:outline-none"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={isAuthenticating || !patToken.trim()}
              className="w-full py-2 px-3 rounded-md bg-base-2 hover:bg-base-3 border border-border text-text-primary text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              {isAuthenticating ? 'Validating Token...' : 'Authenticate with Token'}
            </button>
          </form>
        </div>
      )}

      {/* GitHub Login Options */}
      {provider === 'github' && (
        <form onSubmit={handleGitHubPatSubmit} className="p-4 rounded-lg bg-base-1 border border-border space-y-3">
          <h4 className="text-xs font-semibold text-text-primary">GitHub Personal Access Token</h4>
          <p className="text-[11px] text-text-muted">
            Create a Personal Access Token (classic or fine-grained) on GitHub with{' '}
            <code className="text-purple-300 font-mono">repo</code> and{' '}
            <code className="text-purple-300 font-mono">read:user</code> scopes.
          </p>

          <div className="flex items-center gap-2 bg-base-0 border border-border rounded-md px-2.5 py-1.5 focus-within:border-purple-500">
            <Key className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-transparent text-xs text-text-primary font-mono focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isGithubAuthenticating || !githubToken.trim()}
            className="w-full py-2 px-3 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            {isGithubAuthenticating ? 'Validating GitHub Token...' : 'Connect GitHub Account'}
          </button>
        </form>
      )}
    </div>
  );
};
