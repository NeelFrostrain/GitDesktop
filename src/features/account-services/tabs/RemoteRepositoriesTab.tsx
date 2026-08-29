import React from 'react';
import { FolderGit2 } from 'lucide-react';
import { RemoteRow } from '../components/RemoteRow';
import { AddRemoteForm } from '../components/AddRemoteForm';
import { useRemotes } from '../hooks/useRemotes';

export const RemoteRepositoriesTab: React.FC = () => {
  const { remotes, activeRepoPath, isLoading } = useRemotes();

  if (!activeRepoPath) {
    return (
      <div className="p-12 text-center border border-dashed border-border rounded-sm bg-base-2/20 space-y-3 select-none">
        <div className="w-12 h-12 rounded-sm bg-base-3 flex items-center justify-center mx-auto text-text-muted">
          <FolderGit2 className="w-6 h-6 text-commito-coral" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-text-primary">No Active Repository</h4>
          <p className="text-[11px] text-text-muted max-w-sm mx-auto">
            Open a local repository in Git Desktop to view and manage its remote URLs, fetch/push
            endpoints, and default remotes.
          </p>
        </div>
      </div>
    );
  }

  const repoName = activeRepoPath.split(/[/\\]/).pop() || 'repository';

  return (
    <div className="space-y-4 select-none">
      {/* Header */}
      <div>
        <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase flex items-center gap-2">
          <span>CONFIGURED REMOTES</span>
          <span className="text-[11px] text-text-muted font-mono font-normal">({repoName})</span>
        </h3>
        <p className="text-xs text-text-muted mt-0.5">
          Manage remote repository targets and assign default push/pull remotes.
        </p>
      </div>

      {/* Remotes List */}
      {remotes.length > 0 ? (
        <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
          {remotes.map((remote) => (
            <RemoteRow key={remote.name} remote={remote} repoPath={activeRepoPath} />
          ))}
        </div>
      ) : !isLoading ? (
        <div className="p-6 bg-base-2/30 border border-border rounded-sm text-center text-xs text-text-muted">
          No remotes configured for this repository yet.
        </div>
      ) : null}

      {/* Add Remote Form */}
      <AddRemoteForm repoPath={activeRepoPath} />
    </div>
  );
};
