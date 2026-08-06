import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { Sidebar } from './components/Sidebar';
import { HomeDashboard } from './components/HomeDashboard';
import { DiffViewer } from './components/DiffViewer';
import { RepoModal } from './components/RepoModal';
import { LogModal } from './components/LogModal';
import { ConflictView } from './components/ConflictView';
import { Header } from './components/Header';
import { Titlebar } from './components/Titlebar';
import { useGitStore } from './store/useGitStore';
import { GitLabUser } from './types/gitlab';
import { RepoStatus } from './types/git';

export const App: React.FC = () => {
  const { setUser, setAccounts, activeRepoPath, setStatus, setError, currentNavView } = useGitStore();

  useEffect(() => {
    // Load accounts list
    invoke<any[]>('list_accounts_cmd')
      .then((accounts) => {
        if (accounts) setAccounts(accounts);
      })
      .catch(() => {});

    // Attempt session restoration from active account
    invoke<GitLabUser | null>('get_current_user')
      .then((user) => {
        if (user) setUser(user);
      })
      .catch(() => {
        // Silent catch if no saved credentials
      });

    // Root-level listener for automatic OAuth loopback login success & deep links
    let unlistenEvent: (() => void) | undefined;
    let unlistenDeepLink: (() => void) | undefined;

    listen<GitLabUser>('oauth-success', (event) => {
      if (event.payload) {
        setUser(event.payload);
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
                  setUser(loggedUser);
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

  const isWorkspace = currentNavView === 'workspace' && Boolean(activeRepoPath);

  return (
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
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {isWorkspace ? <DiffViewer /> : <HomeDashboard />}
          </div>
        </div>
      </div>

      <RepoModal />
      <LogModal />
    </div>
  );
};

export default App;
