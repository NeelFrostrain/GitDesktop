import React, { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { invoke } from '@tauri-apps/api/core';
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
import { SettingsPanel, useSettingsStore } from './features/settings';
import { useGitRuntime, MinGitSetupModal } from './features/git-runtime';
import { useGitStore } from './store/useGitStore';
import { GitLabUser, gitLabUserToUnified, gitHubUserToUnified } from './types/gitlab';
import { GitService } from './services/git/gitService';
import { AccountService } from './services/accounts/accountService';
import { toAppError } from './shared/utils/errorUtils';

/**
 * Root application component orchestrating the top-level layout, deep links,
 * global keyboard shortcuts, and modal dialogs.
 */
export const App: React.FC = () => {
  const { setUser, setAccounts, activeRepoPath, setStatus, setError, currentNavView } = useGitStore();
  const wasBlurredRef = useRef(false);
  const { showInstallPrompt, setShowInstallPrompt } = useGitRuntime();

  useEffect(() => {
    // Load accounts list
    AccountService.listSavedAccounts()
      .then((accounts) => {
        if (accounts) setAccounts(accounts);
      })
      .catch(() => {});

    // Attempt session restoration — restore whichever provider account is marked active
    AccountService.listSavedAccounts()
      .then((accounts) => {
        if (!accounts || accounts.length === 0) return;
        const active = accounts.find((a) => a.is_active) || accounts[0];
        if (!active) return;

        if (active.provider === 'github') {
          AccountService.getGitHubUser()
            .then((user) => {
              if (user) setUser(gitHubUserToUnified(user));
            })
            .catch(() => {});
        } else {
          AccountService.getCurrentGitLabUser()
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
                .catch((err: unknown) => {
                  setError(toAppError(err, 'AUTH_ERROR'));
                });
            }
          } catch {
            // Ignore URL parsing errors
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
  }, [setUser, setAccounts, setError]);

  useEffect(() => {
    if (!activeRepoPath) return;
    GitService.getRepoStatus(activeRepoPath)
      .then(setStatus)
      .catch((err: unknown) => setError(toAppError(err, 'GIT_ERROR')));
  }, [activeRepoPath, setStatus, setError]);

  // App focus refresh — fires on window blur→focus transition to keep state synchronized
  useEffect(() => {
    if (!activeRepoPath) return;
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    appWindow
      .onFocusChanged(({ payload: focused }) => {
        if (focused && wasBlurredRef.current) {
          wasBlurredRef.current = false;
          GitService.getRepoStatus(activeRepoPath)
            .then(setStatus)
            .catch(() => {
              // Silently ignore background focus refresh errors
            });
        }
        if (!focused) {
          wasBlurredRef.current = true;
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [activeRepoPath, setStatus]);

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

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen w-screen bg-base-0 text-text-primary overflow-hidden select-none font-sans min-w-[960px]">
        {/* Custom Application Titlebar */}
        <Titlebar />

        <div className="flex-1 flex overflow-hidden">
          {/* Left rail navigation & tabs */}
          <Sidebar />

          {/* Main workspace body */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            <Header />
            <ConflictView />
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 flex min-h-0 overflow-hidden">{renderMainContent()}</div>
              {/* Dockable Terminal Panel */}
              <TerminalPanel />
            </div>
          </div>
        </div>

        {/* Global Dialog Modals */}
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
        <SettingsPanel />
        <MinGitSetupModal isOpen={showInstallPrompt} onClose={() => setShowInstallPrompt(false)} />
      </div>
    </ErrorBoundary>
  );
};

export default App;
