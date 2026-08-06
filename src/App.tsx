import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sidebar } from './components/Sidebar';
import { HomeDashboard } from './components/HomeDashboard';
import { DiffViewer } from './components/DiffViewer';
import { RepoModal } from './components/RepoModal';
import { ConflictView } from './components/ConflictView';
import { Header } from './components/Header';
import { useGitStore } from './store/useGitStore';
import { GitLabUser } from './types/gitlab';
import { RepoStatus } from './types/git';

export const App: React.FC = () => {
  const { setUser, activeRepoPath, setStatus, setError, currentNavView } = useGitStore();

  useEffect(() => {
    // Attempt session restoration from secure OS keyring
    invoke<GitLabUser | null>('get_current_user')
      .then((user) => {
        if (user) setUser(user);
      })
      .catch(() => {
        // Silent catch if no saved credentials
      });
  }, [setUser]);

  useEffect(() => {
    if (!activeRepoPath) return;
    invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath })
      .then((res: any) => setStatus(res))
      .catch((err) => setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) }));
  }, [activeRepoPath, setStatus, setError]);

  const isWorkspace = currentNavView === 'workspace' && Boolean(activeRepoPath);

  return (
    <div className="flex h-screen w-screen bg-base-1 text-text-primary overflow-hidden select-none font-sans min-w-[960px]">
      {/* Left rail navigation */}
      <Sidebar />

      {/* Main app body */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* GitHub Desktop Header Bar */}
        <Header />
        <ConflictView />
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {isWorkspace ? <DiffViewer /> : <HomeDashboard />}
        </div>
      </div>

      <RepoModal />
    </div>
  );
};

export default App;
