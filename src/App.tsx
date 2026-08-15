import React, { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { Sidebar } from './components/sidebar/Sidebar';
import { ErrorBoundary } from './components/common';
import { Titlebar, Header } from './components/layout';
import {
  HomeDashboard,
  DiffViewer,
  FileBrowser,
  ConflictView,
  BranchesView,
  LfsView,
  StashManagerView,
  TagsView,
  SubmodulesView,
  BlameViewer,
} from './components/views';
import {
  RepoModal,
  CreateRepoModal,
  MergeRequestModal,
  WorktreeModal,
  ConflictResolverModal,
  RebaseModal,
  CherryPickModal,
  ReflogModal,
  PatchModal,
  GitConfigModal,
  RewriteHistoryModal,
  SigningSettings,
  GitLabSignInModal,
} from './components/modals';
import { GitUserConfigModal } from './components/config/GitUserConfigModal';
import { LogModal } from './components/logs/LogModal';
import { AccountServicesModal } from './features/account-services';
import { TerminalPanel, useTerminalStore } from './features/terminal';
import { useGitStore } from './store/useGitStore';
import { GitLabUser, GitHubUser, gitLabUserToUnified, gitHubUserToUnified } from './types/gitlab';
import { RepoStatus } from './types/git';

export const App: React.FC = () => {
  const { setUser, setAccounts, activeRepoPath, setStatus, setError, currentNavView } = useGitStore();
  const wasBlurredRef = useRef(false);

  useEffect(() => {
    // Load accounts list
    invoke<any[]>('list_accounts_cmd')
      .then((accounts) => {
        if (accounts) setAccounts(accounts);
      })
      .catch(() => {});

    // Attempt session restoration — check active account provider
    invoke<any[]>('list_accounts_cmd')
      .then((accounts) => {
        if (!accounts || accounts.length === 0) return;
        const active = accounts.find((a: any) => a.is_active) || accounts[0];
        if (!active) return;

        if (active.provider === 'github') {
          // Restore GitHub session
          invoke<GitHubUser | null>('get_github_user')
            .then((user) => {
              if (user) setUser(gitHubUserToUnified(user));
            })
            .catch(() => {});
        } else {
          // Restore GitLab session
          invoke<GitLabUser | null>('get_current_user')
            .then((user) => {
              if (user) setUser(gitLabUserToUnified(user));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    // Root-level listener for automatic OAuth loopback login success & deep links (GitLab)
    let unlistenEvent: (() => void) | undefined;
    let unlistenDeepLink: (() => void) | undefined;

    listen<GitLabUser>('oauth-success', (event) => {
      if (event.payload) {
        setUser(gitLabUserToUnified(event.payload));
        useGitStore.setState({ isRepoModalOpen: false, error: null });
      }
    }).then((fn) => {
      unlistenEvent = fn;
    });

    onOpenUrl((urls: string[]) => {
      for (const urlStr of urls) {
        if (urlStr.includes('gitlab-desktop://oauth/callback')) {
          try {
            const url = new URL(urlStr);
            const code = url.searchParams.get('code');
            const savedVerifier = sessionStorage.getItem('oauth_verifier');

            if (code && savedVerifier) {
              invoke<GitLabUser>('complete_oauth_login', {
                serverUrl: 'https://gitlab.com',
                code,
                verifier: savedVerifier,
                clientId: import.meta.env.VITE_GITLAB_CLIENT_ID || null,
                clientSecret: import.meta.env.VITE_GITLAB_CLIENT_SECRET || null,
              })
                .then((loggedUser) => {
                  setUser(gitLabUserToUnified(loggedUser));
                  sessionStorage.removeItem('oauth_verifier');
                  useGitStore.setState({ isRepoModalOpen: false, error: null });
                })
                .catch((err) => {
                  setError({ code: err.code || 'AUTH_ERROR', message: err.message || String(err) });
                });
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }).then((un) => {
      unlistenDeepLink = un;
    });

    return () => {
      if (unlistenEvent) unlistenEvent();
      if (unlistenDeepLink) unlistenDeepLink();
    };
  }, [setUser, setError]);

  useEffect(() => {
    if (!activeRepoPath) return;
    invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath })
      .then((res: any) => setStatus(res))
      .catch((err) => setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) }));
  }, [activeRepoPath, setStatus, setError]);

  // ── App focus refresh — fires only on blur→focus transition ────────────────
  // Uses a fast local-only get_repo_status (no network) to avoid slow fetch on
  // every focus while still keeping the UI in sync with external changes.
  useEffect(() => {
    if (!activeRepoPath) return;
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused && wasBlurredRef.current) {
        // App regained focus — refresh local repo state
        wasBlurredRef.current = false;
        invoke<any>('get_repo_status', { repoPath: activeRepoPath })
          .then((res) => setStatus(res))
          .catch(() => {
            // Silently ignore focus-refresh failures — keep last known state
          });
      }
      if (!focused) {
        wasBlurredRef.current = true;
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [activeRepoPath, setStatus]);


  // Global shortcut Ctrl+` / Cmd+` to toggle repository terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        useTerminalStore.getState().toggleIsOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderMainContent = () => {
    if (currentNavView === 'files') {
      return <FileBrowser />;
    }
    if (currentNavView === 'branches') {
      return <BranchesView />;
    }
    if (currentNavView === 'locks') {
      return <LfsView />;
    }
    if (currentNavView === 'stashes') {
      return <StashManagerView />;
    }
    if (currentNavView === 'tags') {
      return <TagsView />;
    }
    if (currentNavView === 'submodules') {
      return <SubmodulesView />;
    }
    if (currentNavView === 'history' || currentNavView === 'changes' || currentNavView === 'workspace') {
      return <DiffViewer />;
    }
    return <HomeDashboard />;
  };

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen w-screen bg-base-0 text-text-primary overflow-hidden select-none font-sans min-w-[960px]">
      {/* Top Custom Titlebar */}
      <Titlebar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left rail navigation */}
        <Sidebar />

        {/* Main app body */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Header Bar */}
          <Header />
          <ConflictView />
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {renderMainContent()}
            </div>
            {/* Docked Per-Repo Terminal */}
            <TerminalPanel />
          </div>
        </div>
      </div>

      <ErrorBoundary>
        <RepoModal />
      </ErrorBoundary>
      <CreateRepoModal />
      <MergeRequestModal />

      <WorktreeModal />
      <ConflictResolverModal />
      <RebaseModal />
      <CherryPickModal />
      <BlameViewer />
      <ReflogModal />
      <PatchModal />
      <GitConfigModal />
      <RewriteHistoryModal />
      <GitUserConfigModal />
      <LogModal />
      <AccountServicesModal />
      <GitLabSignInModal />
      <SigningSettings />

    </div>
    </ErrorBoundary>
  );
};



export default App;
