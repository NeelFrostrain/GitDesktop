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
  ExternalLink
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { GitLabUser, GitLabProject, PagedResult } from '../types/gitlab';

interface PkcePair {
  verifier: String;
  challenge: String;
}

export const RepoModal: React.FC = () => {
  const {
    user,
    setUser,
    isRepoModalOpen,
    setIsRepoModalOpen,
    setActiveRepoPath,
    setError,
  } = useGitStore();

  const [activeModalTab, setActiveModalTab] = useState<'login' | 'repos'>('login');
  const [serverUrl, setServerUrl] = useState('https://gitlab.com');
  const [patToken, setPatToken] = useState('');
  const [customCaPem, setCustomCaPem] = useState('');
  const [showCustomCa, setShowCustomCa] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isOauthLoading, setIsOauthLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

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
      const loggedUser = await invoke<GitLabUser>('login_gitlab_pat', {
        serverUrl,
        token: patToken,
        customCaPem: customCaPem || null,
      });
      setUser(loggedUser);
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
      const pkce = await invoke<PkcePair>('generate_pkce_cmd');
      sessionStorage.setItem('oauth_verifier', String(pkce.verifier));

      await invoke('start_oauth_login', {
        serverUrl,
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

  const fetchRepositories = async (page: number) => {
    setIsLoadingProjects(true);
    try {
      const result = await invoke<PagedResult<GitLabProject>>('fetch_user_repositories', {
        serverUrl: user?.server_url || serverUrl,
        page,
      });
      setProjects(result.items);
      setCurrentPage(result.page);
      setTotalPages(result.total_pages);
    } catch (err: any) {
      setError({ code: err.code || 'NETWORK_ERROR', message: err.message || String(err) });
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-github-dark-sidebar border border-github-dark-border rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="h-12 bg-github-dark-header border-b border-github-dark-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderGit2 className="w-5 h-5 text-github-dark-accent" />
            <h2 className="text-sm font-semibold text-github-dark-heading">
              GitLab Integration & Repositories
            </h2>
          </div>
          <button
            onClick={() => setIsRepoModalOpen(false)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-github-dark-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-github-dark-border bg-github-dark-header/40 px-4">
          <button
            onClick={() => setActiveModalTab('login')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition ${
              activeModalTab === 'login'
                ? 'border-github-dark-accent text-github-dark-heading'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Account & Auth
          </button>
          <button
            onClick={() => {
              setActiveModalTab('repos');
              if (projects.length === 0 && user) fetchRepositories(1);
            }}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition ${
              activeModalTab === 'repos'
                ? 'border-github-dark-accent text-github-dark-heading'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Remote Repositories
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeModalTab === 'login' && (
            <div className="space-y-6">
              {user ? (
                /* Authenticated User Card */
                <div className="p-5 bg-github-dark-header border border-github-dark-border rounded-lg space-y-4">
                  <div className="flex items-center gap-4">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-14 h-14 rounded-full border border-github-dark-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-github-dark-accent/20 border border-github-dark-accent flex items-center justify-center">
                        <User className="w-7 h-7 text-github-dark-accent" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-github-dark-heading">{user.name}</h3>
                      <p className="text-xs text-gray-400 font-mono">@{user.username}</p>
                      {user.email && <p className="text-xs text-gray-400">{user.email}</p>}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-github-dark-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-github-dark-accent" />
                      <span className="font-mono text-gray-300">{user.server_url}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 rounded flex items-center gap-1.5 font-medium"
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
                    <label className="block text-xs font-semibold text-github-dark-heading mb-1">
                      GitLab Instance URL
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="url"
                        required
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        placeholder="https://gitlab.com or https://gitlab.mycompany.com"
                        className="w-full pl-9 pr-3 py-2 bg-github-dark-bg border border-github-dark-border rounded text-xs text-github-dark-heading focus:outline-none focus:border-github-dark-accent"
                      />
                    </div>
                  </div>

                  {/* GitLab Orange Branded OAuth Button */}
                  <button
                    type="button"
                    onClick={handleOAuthLogin}
                    disabled={isOauthLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#FC6D26] hover:bg-[#e2591c] text-white font-medium py-2.5 rounded-md transition shadow-md text-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {isOauthLoading ? "Opening browser for GitLab sign in..." : "Sign in with GitLab (Browser PKCE)"}
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
                      <label className="block text-xs font-semibold text-github-dark-heading mb-1">
                        Personal Access Token (PAT)
                      </label>
                      <div className="relative">
                        <Key className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          type="password"
                          required
                          value={patToken}
                          onChange={(e) => setPatToken(e.target.value)}
                          placeholder="glpat-..."
                          className="w-full pl-9 pr-3 py-2 bg-github-dark-bg border border-github-dark-border rounded text-xs text-github-dark-heading focus:outline-none focus:border-github-dark-accent font-mono"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Requires <span className="font-mono text-white">api</span> and <span className="font-mono text-white">read_user</span> scopes.
                      </p>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setShowCustomCa(!showCustomCa)}
                        className="text-xs text-github-dark-accent hover:underline flex items-center gap-1 font-medium"
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
                          className="w-full mt-2 p-2 bg-github-dark-bg border border-github-dark-border rounded text-[11px] font-mono text-github-dark-heading focus:outline-none focus:border-github-dark-accent resize-none"
                        />
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full py-2 bg-github-dark-sidebar hover:bg-github-dark-hover border border-github-dark-border text-github-dark-heading font-semibold rounded text-xs transition shadow-sm"
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
                <div className="text-center py-8 text-gray-400 text-xs">
                  Please log in under the "Account & Auth" tab to fetch remote projects.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-github-dark-heading uppercase tracking-wider">
                      Your GitLab Repositories (Page {currentPage} of {totalPages})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentPage <= 1 || isLoadingProjects}
                        onClick={() => fetchRepositories(currentPage - 1)}
                        className="p-1 bg-github-dark-header border border-github-dark-border rounded text-gray-400 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={currentPage >= totalPages || isLoadingProjects}
                        onClick={() => fetchRepositories(currentPage + 1)}
                        className="p-1 bg-github-dark-header border border-github-dark-border rounded text-gray-400 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isLoadingProjects ? (
                    <div className="py-8 text-center text-xs text-gray-400">Fetching projects from GitLab...</div>
                  ) : projects.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-500">No projects found.</div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {projects.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-github-dark-header border border-github-dark-border rounded-md flex items-center justify-between hover:border-github-dark-accent/50 transition"
                        >
                          <div className="space-y-1 max-w-md">
                            <div className="text-xs font-semibold text-github-dark-heading truncate">
                              {p.path_with_namespace}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono truncate">{p.http_url_to_repo}</div>
                          </div>

                          <button
                            disabled={isCloning}
                            onClick={() => handleCloneProject(p)}
                            className="px-3 py-1.5 bg-github-dark-sidebar hover:bg-github-dark-hover border border-github-dark-border rounded text-xs font-medium text-github-dark-heading flex items-center gap-1.5 transition"
                          >
                            <Download className="w-3.5 h-3.5 text-github-dark-accent" />
                            Clone to Computer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {isCloning && (
                    <div className="p-3 bg-github-dark-accent/10 border border-github-dark-accent/30 rounded text-xs text-github-dark-accent">
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
