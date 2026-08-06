import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { 
  X, 
  Key, 
  Globe, 
  ShieldCheck, 
  FolderGit2, 
  Download, 
  LogOut, 
  User, 
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Users,
  Check,
  Trash2,
  Plus,
  Edit2,
  Save
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { GitLabUser, GitLabProject, PagedResult, SavedAccount } from '../types/gitlab';

interface PkcePair {
  verifier: String;
  challenge: String;
}

export const RepoModal: React.FC = () => {
  const {
    user,
    setUser,
    accounts,
    setAccounts,
    isRepoModalOpen,
    setIsRepoModalOpen,
    activeRepoPath,
    setActiveRepoPath,
    activeModalTab,
    setActiveModalTab,
    setError,
  } = useGitStore();

  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('git_desktop_server_url') || 'https://gitlab.com';
  });
  const [patToken, setPatToken] = useState('');
  const [customCaPem, setCustomCaPem] = useState('');
  const [showCustomCa, setShowCustomCa] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isOauthLoading, setIsOauthLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const loadAccounts = async () => {
    try {
      const accs = await invoke<SavedAccount[]>('list_accounts_cmd');
      setAccounts(Array.isArray(accs) ? accs : []);
    } catch {
      setAccounts([]);
    }
  };

  const handleStartEdit = (acct: SavedAccount) => {
    setEditingAccountId(acct.id);
    setEditName(acct.name);
    setEditEmail(acct.email || '');
  };

  const handleSaveAccountInfo = async (accountId: string) => {
    try {
      await invoke('update_account_info_cmd', {
        accountId,
        name: editName,
        email: editEmail || null,
      });
      setEditingAccountId(null);
      await loadAccounts();
      const activeUser = await invoke<GitLabUser | null>('get_current_user');
      if (activeUser) setUser(activeUser);
    } catch (err: any) {
      setError({ code: 'AUTH_ERROR', message: err.message || String(err) });
    }
  };

  useEffect(() => {
    if (isRepoModalOpen) {
      loadAccounts();
    }
  }, [isRepoModalOpen]);

  const handleSwitchAccount = async (accountId: string) => {
    try {
      const switchedUser = await invoke<GitLabUser | null>('switch_account_cmd', { accountId });
      if (switchedUser) {
        setUser(switchedUser);
      }
      if (activeRepoPath) {
        await invoke('set_repo_account_cmd', { repoPath: activeRepoPath, accountId });
      }
      await loadAccounts();
    } catch (err: any) {
      setError({ code: 'AUTH_ERROR', message: err.message || String(err) });
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    try {
      await invoke('remove_account_cmd', { accountId });
      await loadAccounts();
      const activeUser = await invoke<GitLabUser | null>('get_current_user');
      setUser(activeUser);
    } catch (err: any) {
      setError({ code: 'AUTH_ERROR', message: err.message || String(err) });
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
          // Keep raw string if URL parse fails
        }
      }

      const loggedUser = await invoke<GitLabUser>('complete_oauth_login', {
        serverUrl,
        code: codeToUse,
        verifier,
        clientId: import.meta.env.VITE_GITLAB_CLIENT_ID || null,
        clientSecret: import.meta.env.VITE_GITLAB_CLIENT_SECRET || null,
      });

      setUser(loggedUser);
      await loadAccounts();
      sessionStorage.removeItem('oauth_verifier');
      setActiveModalTab('repos');
      fetchRepositories(1);
    } catch (err: any) {
      setLoginError(err.message || String(err));
    } finally {
      setIsOauthLoading(false);
    }
  };

  // Projects pagination state
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [clonePath, setClonePath] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  // Listen for deep link callback (gitlab-desktop://oauth/callback?code=...)
  useEffect(() => {
    let unlistenDeepLink: (() => void) | undefined;
    let unlistenEvent: (() => void) | undefined;

    // Listen for Rust emitted oauth-success event (0-click local loopback server)
    listen<GitLabUser>('oauth-success', (event) => {
      if (event.payload) {
        setUser(event.payload);
        setIsOauthLoading(false);
        setActiveModalTab('repos');
        fetchRepositories(1);
      }
    }).then((un) => {
      unlistenEvent = un;
    });

    onOpenUrl((urls: string[]) => {
      for (const urlStr of urls) {
        if (urlStr.startsWith('gitlab-desktop://oauth/callback')) {
          try {
            const url = new URL(urlStr);
            const code = url.searchParams.get('code');
            const savedVerifier = sessionStorage.getItem('oauth_verifier');

            if (code && savedVerifier) {
              setIsOauthLoading(true);
              invoke<GitLabUser>('complete_oauth_login', {
                serverUrl,
                code,
                verifier: savedVerifier,
                clientId: import.meta.env.VITE_GITLAB_CLIENT_ID || null,
                clientSecret: import.meta.env.VITE_GITLAB_CLIENT_SECRET || null,
              })
                .then((loggedUser) => {
                  setUser(loggedUser);
                  sessionStorage.removeItem('oauth_verifier');
                  setActiveModalTab('repos');
                  fetchRepositories(1);
                })
                .catch((err) => {
                  setLoginError(err.message || 'OAuth login failed.');
                })
                .finally(() => setIsOauthLoading(false));
            }
          } catch (e: any) {
            setLoginError('Invalid callback URL: ' + e.message);
          }
        }
      }
    }).then((un: () => void) => {
      unlistenDeepLink = un;
    }).catch(() => {
      // Deep link registration fallback
    });

    return () => {
      if (unlistenDeepLink) unlistenDeepLink();
      if (unlistenEvent) unlistenEvent();
    };
  }, [serverUrl, setUser]);

  if (!isRepoModalOpen) return null;

  const handlePatLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setLoginError(null);

    try {
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '') || 'https://gitlab.com';
      const loggedUser = await invoke<GitLabUser>('login_gitlab_pat', {
        serverUrl: cleanUrl,
        token: patToken,
        customCaPem: customCaPem || null,
      });
      localStorage.setItem('git_desktop_server_url', cleanUrl);
      setUser(loggedUser);
      await loadAccounts();
      setActiveModalTab('repos');
      fetchRepositories(1);
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed. Please check token and URL.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleOAuthLogin = async () => {
    setIsOauthLoading(true);
    setLoginError(null);
    try {
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '') || 'https://gitlab.com';
      localStorage.setItem('git_desktop_server_url', cleanUrl);
      const pkce = await invoke<PkcePair>('generate_pkce_cmd');
      sessionStorage.setItem('oauth_verifier', String(pkce.verifier));
      sessionStorage.setItem('oauth_server_url', cleanUrl);

      await invoke('start_oauth_login', {
        serverUrl: cleanUrl,
        challenge: pkce.challenge,
        verifier: pkce.verifier,
        clientId: import.meta.env.VITE_GITLAB_CLIENT_ID || null,
        clientSecret: import.meta.env.VITE_GITLAB_CLIENT_SECRET || null,
        useLoopback: true,
      });
    } catch (err: any) {
      setLoginError(err.message || String(err));
      setIsOauthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await invoke('logout_gitlab');
      setUser(null);
      setProjects([]);
      setActiveModalTab('login');
    } catch (err: any) {
      setError({ code: err.code || 'AUTH_ERROR', message: err.message || String(err) });
    }
  };

  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (isRepoModalOpen && activeModalTab === 'repos' && user) {
      fetchRepositories(1);
    }
  }, [isRepoModalOpen, activeModalTab, user]);

  const fetchRepositories = async (page: number) => {
    setIsLoadingProjects(true);
    setFetchError(null);
    try {
      const result = await invoke<PagedResult<GitLabProject>>('fetch_user_repositories', {
        serverUrl: user?.server_url || serverUrl,
        page,
      });
      if (result && Array.isArray(result.items)) {
        setProjects(result.items);
        setCurrentPage(result.page || 1);
        setTotalPages(result.total_pages || 1);
      } else {
        setProjects([]);
        setCurrentPage(1);
        setTotalPages(1);
      }
    } catch (err: any) {
      setFetchError(err.message || String(err));
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleCloneProject = async (project: GitLabProject) => {
    try {
      const destination = await invoke<string | null>('select_folder_cmd');

      if (destination) {
        const fullLocalPath = `${destination}/${project.name}`;
        setIsCloning(true);
        setClonePath(fullLocalPath);

        await invoke('clone_repository', {
          remoteUrl: project.http_url_to_repo,
          localPath: fullLocalPath,
        });

        setActiveRepoPath(fullLocalPath);
        setIsRepoModalOpen(false);
      }
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-base-2 border-2 border-gitlab-orange/40 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="h-12 bg-base-3 border-b border-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gitlab-orange/20 border border-gitlab-orange/40 rounded-md">
              <FolderGit2 className="w-4 h-4 text-gitlab-orange" />
            </div>
            <h2 className="text-sm font-bold text-text-primary">
              GitLab Integration & Repositories
            </h2>
          </div>
          <button
            onClick={() => setIsRepoModalOpen(false)}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-base-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-base-2/40 px-4">
          <button
            onClick={() => setActiveModalTab('accounts')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeModalTab === 'accounts'
                ? 'border-gitlab-orange text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-gitlab-orange" />
            Accounts {(accounts || []).length > 0 && `(${(accounts || []).length})`}
          </button>
          <button
            onClick={() => setActiveModalTab('login')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeModalTab === 'login'
                ? 'border-gitlab-orange text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-gitlab-teal" />
            Add Account
          </button>
          <button
            onClick={() => {
              setActiveModalTab('repos');
              if (projects.length === 0 && user) fetchRepositories(1);
            }}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition ${
              activeModalTab === 'repos'
                ? 'border-gitlab-orange text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Remote Repositories
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto bg-base-1">
          {activeModalTab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Saved GitLab Accounts
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Switch between accounts to use their identity for commits and pushes.
                  </p>
                </div>
                <button
                  onClick={() => setActiveModalTab('login')}
                  className="px-3 py-1.5 bg-gitlab-orange hover:bg-orange-600 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Account
                </button>
              </div>

              {!(accounts && accounts.length > 0) ? (
                <div className="py-8 text-center text-xs text-text-muted space-y-3 bg-base-2/50 border border-border rounded-lg p-6">
                  <User className="w-10 h-10 text-gitlab-orange/60 mx-auto" />
                  <p>No saved GitLab accounts yet.</p>
                  <button
                    onClick={() => setActiveModalTab('login')}
                    className="px-4 py-2 bg-gitlab-orange hover:bg-orange-600 text-white rounded text-xs font-semibold transition"
                  >
                    Sign In to GitLab
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(accounts || []).map((acct) => {
                    if (!acct) return null;
                    const isActive = acct.is_active || (user && user.username === acct.username && user.server_url === acct.server_url);
                    const isEditing = editingAccountId === acct.id;

                    return (
                      <div
                        key={acct.id}
                        className={`p-4 rounded-lg border transition flex flex-col gap-3 ${
                          isActive
                            ? 'bg-gitlab-orange/10 border-gitlab-orange/60 shadow-sm'
                            : 'bg-base-2 border-border hover:border-text-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {acct.avatar_url ? (
                              <img src={acct.avatar_url} alt="Avatar" className="w-11 h-11 rounded-full border border-border flex-shrink-0" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gitlab-orange/20 border border-gitlab-orange flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-gitlab-orange" />
                              </div>
                            )}
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-text-primary truncate">{acct.name}</span>
                                {isActive && (
                                  <span className="px-2 py-0.5 bg-gitlab-teal/20 text-gitlab-teal text-[10px] font-semibold border border-gitlab-teal/40 rounded-full flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" /> Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-text-muted font-mono truncate">
                                @{acct.username} • {acct.server_url}
                              </div>
                              {acct.email && (
                                <div className="text-[10px] text-text-faint truncate">Commit author: {acct.email}</div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!isEditing && (
                              <button
                                onClick={() => handleStartEdit(acct)}
                                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-3 rounded transition flex items-center gap-1 text-xs"
                                title="Edit display name & commit email"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit Info
                              </button>
                            )}

                            {!isActive && !isEditing && (
                              <button
                                onClick={() => handleSwitchAccount(acct.id)}
                                className="px-3 py-1.5 bg-base-3 hover:bg-base-1 border border-border rounded text-xs text-text-primary font-medium transition"
                              >
                                Switch to Account
                              </button>
                            )}

                            {!isEditing && (
                              <button
                                onClick={() => handleRemoveAccount(acct.id)}
                                className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-950/40 rounded transition"
                                title="Remove account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Edit Profile Form */}
                        {isEditing && (
                          <div className="pt-3 border-t border-border/80 grid grid-cols-1 gap-2.5 bg-base-0/60 p-3 rounded-md">
                            <div>
                              <label className="block text-[11px] font-semibold text-text-primary mb-1">
                                Display Name (Commit Author Name)
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2.5 py-1 bg-base-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange"
                                placeholder="Your Name"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-text-primary mb-1">
                                Commit Author Email
                              </label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full px-2.5 py-1 bg-base-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange font-mono"
                                placeholder="user@example.com"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingAccountId(null)}
                                className="px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-xs text-text-muted transition"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveAccountInfo(acct.id)}
                                className="px-3 py-1 bg-gitlab-orange hover:bg-orange-600 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
                              >
                                <Save className="w-3.5 h-3.5" />
                                Save Info
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {activeModalTab === 'login' && (
            <div className="space-y-6">
              {user ? (
                /* Authenticated User Card */
                <div className="p-5 bg-base-2 border border-border rounded-lg space-y-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-14 h-14 rounded-full border border-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gitlab-orange/20 border border-gitlab-orange flex items-center justify-center">
                        <User className="w-7 h-7 text-gitlab-orange" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-text-primary">{user.name}</h3>
                      <p className="text-xs text-text-muted font-mono">@{user.username}</p>
                      {user.email && <p className="text-xs text-text-muted">{user.email}</p>}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gitlab-teal" />
                      <span className="font-mono text-text-secondary">{user.server_url}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 rounded flex items-center gap-1.5 font-medium transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                /* Login Section */
                <div className="space-y-5 max-w-md mx-auto">
                  {loginError && (
                    <div className="p-3 bg-red-950/50 border border-red-800/60 rounded text-xs text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      GitLab Instance URL
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                      <input
                        type="url"
                        required
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        placeholder="https://gitlab.com or https://gitlab.mycompany.com"
                        className="w-full pl-9 pr-3 py-2 bg-base-0 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange"
                      />
                    </div>
                  </div>

                  {/* GitLab Orange Branded OAuth Button */}
                  <button
                    type="button"
                    onClick={handleOAuthLogin}
                    disabled={isOauthLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#FC6D26] hover:bg-[#e2591c] disabled:bg-[#FC6D26]/50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-md transition shadow-md text-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {isOauthLoading ? 'Opening browser for GitLab sign in...' : 'Sign in with GitLab (Browser PKCE)'}
                  </button>

                  {isOauthLoading && (
                    <div className="p-3 bg-base-2 border border-border rounded-md space-y-2">
                      <p className="text-[11px] text-text-muted">
                        Waiting for browser authorization. If your browser redirected to a <span className="font-mono text-gitlab-orange">gitlab-desktop://...</span> page, paste the URL or authorization code below:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Paste authorization code or callback URL..."
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-base-0 border border-border rounded text-xs text-text-primary font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleManualCodeSubmit}
                          className="px-3 py-1 bg-gitlab-teal hover:bg-teal-700 text-white rounded text-xs font-medium"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="flex-shrink mx-3 text-[11px] text-text-muted uppercase tracking-wider font-semibold">Or use Personal Access Token</span>
                    <div className="flex-grow border-t border-border"></div>
                  </div>

                  {/* PAT Form */}
                  <form onSubmit={handlePatLogin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-primary mb-1">
                        Personal Access Token (PAT)
                      </label>
                      <div className="relative">
                        <Key className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                        <input
                          type="password"
                          required
                          value={patToken}
                          onChange={(e) => setPatToken(e.target.value)}
                          placeholder="glpat-..."
                          className="w-full pl-9 pr-3 py-2 bg-base-0 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange font-mono"
                        />
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">
                        Requires <span className="font-mono text-text-primary">api</span> and <span className="font-mono text-text-primary">read_user</span> scopes.
                      </p>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setShowCustomCa(!showCustomCa)}
                        className="text-xs text-gitlab-orange hover:underline flex items-center gap-1 font-medium"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {showCustomCa ? 'Hide Custom CA Certificate' : 'Self-hosted? Add Custom CA Certificate (PEM)'}
                      </button>
                      {showCustomCa && (
                        <textarea
                          rows={3}
                          placeholder="-----BEGIN CERTIFICATE-----"
                          value={customCaPem}
                          onChange={(e) => setCustomCaPem(e.target.value)}
                          className="w-full mt-2 p-2 bg-base-0 border border-border rounded text-[11px] font-mono text-text-primary focus:outline-none focus:border-gitlab-orange resize-none"
                        />
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full py-2 bg-base-2 hover:bg-base-3 disabled:opacity-50 disabled:cursor-not-allowed border border-border text-text-primary font-semibold rounded text-xs transition shadow-sm"
                    >
                      {isAuthenticating ? 'Validating Token...' : 'Sign In with Personal Access Token'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeModalTab === 'repos' && (
            <div className="space-y-4">
              {!user ? (
                <div className="text-center py-8 text-text-muted text-xs">
                  Please log in under the "Account & Auth" tab to fetch remote projects.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                      Your GitLab Repositories (Page {currentPage} of {totalPages})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentPage <= 1 || isLoadingProjects}
                        onClick={() => fetchRepositories(currentPage - 1)}
                        className="p-1 bg-base-2 border border-border rounded text-text-muted hover:text-text-primary disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={currentPage >= totalPages || isLoadingProjects}
                        onClick={() => fetchRepositories(currentPage + 1)}
                        className="p-1 bg-base-2 border border-border rounded text-text-muted hover:text-text-primary disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {fetchError ? (
                    <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-md text-xs text-red-300 space-y-2 text-center">
                      <p>{fetchError}</p>
                      <button
                        onClick={() => fetchRepositories(currentPage)}
                        className="px-3 py-1 bg-gitlab-orange text-white rounded text-xs font-semibold hover:bg-orange-600 transition"
                      >
                        Retry Fetching
                      </button>
                    </div>
                  ) : isLoadingProjects ? (
                    <div className="py-8 text-center text-xs text-text-muted animate-pulse">
                      Fetching projects from GitLab...
                    </div>
                  ) : (projects || []).length === 0 ? (
                    <div className="py-8 text-center text-xs text-text-muted space-y-2">
                      <p>No remote projects found on {user?.server_url || 'GitLab'}.</p>
                      <button
                        onClick={() => fetchRepositories(1)}
                        className="px-3 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-xs text-text-primary transition"
                      >
                        Refresh Repositories
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {(projects || []).map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-base-2 border border-border rounded-md flex items-center justify-between hover:border-gitlab-orange/50 transition"
                        >
                          <div className="space-y-1 max-w-md">
                            <div className="text-xs font-semibold text-text-primary truncate">
                              {p.path_with_namespace}
                            </div>
                            <div className="text-[11px] text-text-muted font-mono truncate">{p.http_url_to_repo}</div>
                          </div>

                          <button
                            disabled={isCloning}
                            onClick={() => handleCloneProject(p)}
                            className="px-3 py-1.5 bg-base-1 hover:bg-base-3 border border-border rounded text-xs font-medium text-text-primary flex items-center gap-1.5 transition"
                          >
                            <Download className="w-3.5 h-3.5 text-gitlab-orange" />
                            Clone to Computer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {isCloning && (
                    <div className="p-3 bg-gitlab-orange/10 border border-gitlab-orange/30 rounded text-xs text-gitlab-orange">
                      Cloning repository to <span className="font-mono">{clonePath}</span>...
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
