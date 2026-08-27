import React, { useEffect, lazy, Suspense } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { invoke } from '@tauri-apps/api/core';
import { Sidebar } from './components/sidebar/Sidebar';
import { ErrorBoundary } from './components/common';
import { Titlebar, Header } from './components/layout';
import { HomeDashboard } from './components/views';
import { useTerminalStore } from './features/terminal';
import { useSettingsStore } from './features/settings';
import { useGitRuntime } from './features/git-runtime';
import { useGitStore } from './store/useGitStore';
import { useLogStore } from './store/useLogStore';
import { useAccountServicesStore } from './features/account-services';
import { GitLabUser, gitLabUserToUnified, gitHubUserToUnified } from './types/gitlab';
import { GitService } from './services/git/gitService';
import { AccountService } from './services/accounts/accountService';
import { toAppError } from './shared/utils/errorUtils';
import { DiffViewer } from './components/views/DiffViewer';
import { ToastContainer } from './components/common/ToastContainer';

// Lazy-loaded Views (chunked on-demand to maximize initial startup performance)
const FileBrowser = lazy(() => import('./components/views/FileBrowser').then(m => ({ default: m.FileBrowser })));
const ConflictView = lazy(() => import('./components/views/ConflictView').then(m => ({ default: m.ConflictView })));
const BranchesView = lazy(() => import('./components/views/BranchesView').then(m => ({ default: m.BranchesView })));
const LfsView = lazy(() => import('./components/views/LfsView').then(m => ({ default: m.LfsView })));
const StashManagerView = lazy(() => import('./components/views/StashManagerView').then(m => ({ default: m.StashManagerView })));
const TagsView = lazy(() => import('./components/views/TagsView').then(m => ({ default: m.TagsView })));
const SubmodulesView = lazy(() => import('./components/views/SubmodulesView').then(m => ({ default: m.SubmodulesView })));
const BlameViewer = lazy(() => import('./components/views/BlameViewer').then(m => ({ default: m.BlameViewer })));

// Lazy-loaded Modals & Panels (loaded only when triggered by user actions)
const RepoModal = lazy(() => import('./components/modals/RepoModal').then(m => ({ default: m.RepoModal })));
const CreateRepoModal = lazy(() => import('./components/modals/CreateRepoModal').then(m => ({ default: m.CreateRepoModal })));
const CloneRepoModal = lazy(() => import('./components/modals/CloneRepoModal').then(m => ({ default: m.CloneRepoModal })));
const MergeRequestModal = lazy(() => import('./components/modals/MergeRequestModal').then(m => ({ default: m.MergeRequestModal })));
const WorktreeModal = lazy(() => import('./components/modals/WorktreeModal').then(m => ({ default: m.WorktreeModal })));
const ConflictResolverModal = lazy(() => import('./components/modals/ConflictResolverModal').then(m => ({ default: m.ConflictResolverModal })));
const RebaseModal = lazy(() => import('./components/modals/RebaseModal').then(m => ({ default: m.RebaseModal })));
const CherryPickModal = lazy(() => import('./components/modals/CherryPickModal').then(m => ({ default: m.CherryPickModal })));
const ReflogModal = lazy(() => import('./components/modals/ReflogModal').then(m => ({ default: m.ReflogModal })));
const PatchModal = lazy(() => import('./components/modals/PatchModal').then(m => ({ default: m.PatchModal })));
const GitConfigModal = lazy(() => import('./components/modals/GitConfigModal').then(m => ({ default: m.GitConfigModal })));
const RewriteHistoryModal = lazy(() => import('./components/modals/RewriteHistoryModal').then(m => ({ default: m.RewriteHistoryModal })));
const CreateTagModal = lazy(() => import('./components/modals/CreateTagModal').then(m => ({ default: m.CreateTagModal })));
const CreateReleaseModal = lazy(() => import('./components/modals/CreateReleaseModal').then(m => ({ default: m.CreateReleaseModal })));
const GitUserConfigModal = lazy(() => import('./components/config/GitUserConfigModal').then(m => ({ default: m.GitUserConfigModal })));
const LogModal = lazy(() => import('./components/logs/LogModal').then(m => ({ default: m.LogModal })));
const GitLabSignInModal = lazy(() => import('./components/modals/GitLabSignInModal').then(m => ({ default: m.GitLabSignInModal })));
const SigningSettings = lazy(() => import('./components/modals/SigningSettings').then(m => ({ default: m.SigningSettings })));
const SettingsPanel = lazy(() => import('./features/settings').then(m => ({ default: m.SettingsPanel })));
const TerminalPanel = lazy(() => import('./features/terminal').then(m => ({ default: m.TerminalPanel })));
const MinGitSetupModal = lazy(() => import('./features/git-runtime').then(m => ({ default: m.MinGitSetupModal })));
const AccountServicesModal = lazy(() => import('./features/account-services').then(m => ({ default: m.AccountServicesModal })));
const PublishRepoModal = lazy(() => import('./components/modals/PublishRepoModal').then(m => ({ default: m.PublishRepoModal })));
const RemoteNotFoundModal = lazy(() => import('./components/modals/RemoteNotFoundModal').then(m => ({ default: m.RemoteNotFoundModal })));

/**
 * Root application component orchestrating top-level layout, deep links,
 * global keyboard shortcuts, and code-split modal dialogs.
 */
export const App: React.FC = () => {
  const {
    setUser,
    setAccounts,
    activeRepoPath,
    setStatus,
    setBranches,
    setTags,
    setError,
    currentNavView,
    isCreateTagModalOpen,
    setIsCreateTagModalOpen,
    isCreateReleaseModalOpen,
    setIsCreateReleaseModalOpen,
    editingRelease,
    setEditingRelease,
  } = useGitStore();
  const { showInstallPrompt, setShowInstallPrompt } = useGitRuntime();

  useEffect(() => {
    // Single consolidated startup call to list accounts and restore active session
    AccountService.listSavedAccounts()
      .then((accounts) => {
        if (!accounts) return;
        setAccounts(accounts);
        if (accounts.length === 0) return;

        const active = accounts.find((a) => a.is_active) || accounts[0];
        if (!active) return;

        if (active.provider === 'github') {
          AccountService.getGitHubUser()
            .then((user) => {
              if (user) setUser(gitHubUserToUnified(user));
            })
            .catch(() => {});
        } else if (active.provider === 'gitlab') {
          AccountService.getCurrentGitLabUser()
            .then((user) => {
              if (user) setUser(gitLabUserToUnified(user));
            })
            .catch(() => {});
        } else {
          setUser({
            id: active.id,
            name: active.name,
            username: active.username,
            email: active.email || '',
            avatar_url: active.avatar_url || null,
            provider: active.provider,
            server_url: active.server_url,
            web_url: active.server_url,
          });
        }
      })
      .catch(() => {});

    useAccountServicesStore.getState().loadAccounts().catch(() => {});

    // Root-level listener for automatic OAuth loopback login success & deep links (GitLab)
    let unlistenEvent: (() => void) | undefined;
    let unlistenDeepLink: (() => void) | undefined;

    let unlistenAccountSynced: (() => void) | undefined;

    listen<GitLabUser>('oauth-success', (event) => {
      if (event.payload) {
        setUser(gitLabUserToUnified(event.payload));
        useGitStore.setState({ isRepoModalOpen: false, error: null });
      }
    }).then((fn) => {
      unlistenEvent = fn;
    });

    listen<any>('oauth-account-synced', async (event) => {
      if (event.payload) {
        await useAccountServicesStore.getState().loadAccounts();
        const accs = await AccountService.listSavedAccounts();
        if (accs) setAccounts(accs);
        useGitStore.setState({ isRepoModalOpen: false, error: null });
        useAccountServicesStore.setState({ isModalOpen: false });
      }
    }).then((fn) => {
      unlistenAccountSynced = fn;
    });

    onOpenUrl(async (urls: string[]) => {
      for (const urlStr of urls) {
        try {
          if (urlStr.includes('/oauth/')) {
            const url = new URL(urlStr);
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');

            // 1. Multi-provider OAuth (GitHub / GitLab account services)
            if (urlStr.includes('/oauth/github/callback') || urlStr.includes('/oauth/gitlab/callback') || state) {
              if (code) {
                const provider = urlStr.includes('github') ? 'github' : 'gitlab';
                try {
                  const account = await invoke<any>('accounts_exchange_oauth_code', {
                    provider,
                    code,
                    state: state || null,
                    instanceUrl: null,
                  });
                  await useAccountServicesStore.getState().loadAccounts();
                  useLogStore.getState().addLog('info', 'Auth', `Authenticated with ${provider} (${account?.handle || ''})`);
                  useGitStore.setState({ isRepoModalOpen: false, error: null });
                  useAccountServicesStore.setState({ isModalOpen: false });
                } catch (err: any) {
                  useLogStore.getState().addLog('error', 'Auth', `OAuth exchange error: ${err?.message || err}`);
                  setError(toAppError(err, 'AUTH_ERROR'));
                }
              }
            }
            // 2. Legacy GitLab OAuth callback fallback
            else if (urlStr.includes('gitlab-desktop://oauth/callback')) {
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
                  .catch((err: unknown) => {
                    setError(toAppError(err, 'AUTH_ERROR'));
                  });
              }
            }
          }
        } catch {
          // Ignore URL parsing errors
        }
      }
    }).then((un) => {
      unlistenDeepLink = un;
    });

    return () => {
      if (unlistenEvent) unlistenEvent();
      if (unlistenAccountSynced) unlistenAccountSynced();
      if (unlistenDeepLink) unlistenDeepLink();
    };
  }, [setUser, setAccounts, setError]);

  // Live repository synchronizer: keeps workspace status, working tree diffs, and repo registry in sync
  useEffect(() => {
    if (!activeRepoPath) return;

    let isDisposed = false;
    let isSyncing = false;

    const syncStatus = async () => {
      if (isDisposed || isSyncing) return;
      isSyncing = true;
      try {
        const res = await GitService.getRepoStatus(activeRepoPath);
        if (!isDisposed) {
          setStatus(res);
        }
      } catch {
        // Silently ignore background polling sync errors
      } finally {
        isSyncing = false;
      }
    };

    // Initial sync
    syncStatus();

    // Proactively fetch branches and tags when repo loads or changes
    GitService.listBranches(activeRepoPath)
      .then((b) => {
        if (!isDisposed && b) setBranches(b);
      })
      .catch(() => {});

    GitService.listTags(activeRepoPath)
      .then((t) => {
        if (!isDisposed && t) setTags(t);
      })
      .catch(() => {});

    // 1. Periodic background polling (every 2 seconds) for external file modifications
    const intervalId = setInterval(syncStatus, 2000);

    // 2. Window focus & document visibility sync
    const handleFocus = () => syncStatus();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncStatus();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Tauri window focus event
    const appWindow = getCurrentWindow();
    let unlistenTauriFocus: (() => void) | undefined;
    appWindow
      .onFocusChanged(({ payload: focused }) => {
        if (focused) syncStatus();
      })
      .then((fn) => {
        unlistenTauriFocus = fn;
      });

    return () => {
      isDisposed = true;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (unlistenTauriFocus) unlistenTauriFocus();
    };
  }, [activeRepoPath, setStatus, setBranches, setTags]);

  // Global shortcuts: Ctrl+` / Cmd+` (Terminal) and Ctrl+, / Cmd+, (Settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        useTerminalStore.getState().toggleIsOpen();
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        useSettingsStore.getState().toggleSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderMainContent = () => {
    switch (currentNavView) {
      case 'files':
        return <FileBrowser />;
      case 'branches':
        return <BranchesView />;
      case 'locks':
        return <LfsView />;
      case 'stashes':
        return <StashManagerView />;
      case 'tags':
        return <TagsView />;
      case 'submodules':
        return <SubmodulesView />;
      case 'history':
      case 'changes':
      case 'workspace':
        return <DiffViewer />;
      default:
        return <HomeDashboard />;
    }
  };

  const isHome = currentNavView === 'home';

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen w-screen bg-base-0 text-text-primary overflow-hidden select-none font-sans">
        {/* Custom Application Titlebar */}
        <Titlebar />

        <div className="flex-1 flex overflow-hidden">
          {isHome ? (
            /* ── Home page: full-width, no sidebar ── */
            <HomeDashboard />
          ) : (
            /* ── Repo page: sidebar + main content ── */
            <div className="flex flex-1 min-w-0 w-full overflow-hidden">
              {/* Left rail navigation & tabs */}
              <Sidebar />

              {/* Main workspace body */}
              <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <Suspense fallback={null}>
                  <ConflictView />
                </Suspense>
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex-1 flex min-h-0 overflow-hidden">
                    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-base-0 text-text-muted text-xs">Loading view...</div>}>
                      {renderMainContent()}
                    </Suspense>
                  </div>
                  {/* Dockable Terminal Panel */}
                  <Suspense fallback={null}>
                    <TerminalPanel />
                  </Suspense>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Dialog Modals (Lazy Loaded) */}
        <Suspense fallback={null}>
          <ErrorBoundary>
            <RepoModal />
          </ErrorBoundary>
          <CreateRepoModal />
          <CloneRepoModal />
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
          <CreateTagModal isOpen={isCreateTagModalOpen} onClose={() => setIsCreateTagModalOpen(false)} />
          <CreateReleaseModal
            isOpen={isCreateReleaseModalOpen}
            initialRelease={editingRelease}
            onClose={() => {
              setIsCreateReleaseModalOpen(false);
              setEditingRelease(null);
            }}
          />
          <GitUserConfigModal />
          <LogModal />
          <GitLabSignInModal />
          <SigningSettings />
          <SettingsPanel />
          <MinGitSetupModal isOpen={showInstallPrompt} onClose={() => setShowInstallPrompt(false)} />
          <AccountServicesModal />
          <PublishRepoModal />
          <RemoteNotFoundModal />
        </Suspense>

        {/* Global Toast Notifications */}
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
};

export default App;
