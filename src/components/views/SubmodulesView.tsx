import React, { useState, useEffect } from 'react';
import {
  Boxes,
  RefreshCw,
  FolderGit2,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

/**
 * Main view for inspecting, initializing, syncing, and recursively updating Git submodules (.gitmodules).
 */
export const SubmodulesView: React.FC = () => {
  const { activeRepoPath, submodules, setSubmodules, setError } = useGitStore();
  const [isLoading, setIsLoading] = useState(false);

  const loadSubmodules = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      const res = await GitService.listSubmodules(activeRepoPath);
      setSubmodules(res || []);
    } catch {
      setSubmodules([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmodules();
  }, [activeRepoPath]);

  const handleInitSubmodules = async () => {
    if (!activeRepoPath) return;

    try {
      await GitService.initSubmodules(activeRepoPath);
      useLogStore.getState().addLog('success', 'Git', 'Initialized repository submodules');
      loadSubmodules();
    } catch (error: unknown) {
      setError(toAppError(error, 'SUBMODULE_ERROR'));
    }
  };

  const handleUpdateSubmodules = async () => {
    if (!activeRepoPath) return;

    try {
      await GitService.updateSubmodules(activeRepoPath);
      useLogStore.getState().addLog('success', 'Git', 'Updated submodules recursively');
      loadSubmodules();
    } catch (error: unknown) {
      setError(toAppError(error, 'SUBMODULE_ERROR'));
    }
  };

  const handleSyncSubmodules = async () => {
    if (!activeRepoPath) return;

    try {
      await GitService.syncSubmodules(activeRepoPath);
      useLogStore.getState().addLog('success', 'Git', 'Synced submodule remote URLs');
      loadSubmodules();
    } catch (error: unknown) {
      setError(toAppError(error, 'SUBMODULE_ERROR'));
    }
  };

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-6 select-none space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
            <Boxes className="w-5 h-5 text-gitlab-teal" />
            <span>Git Submodules</span>
          </h2>
          <p className="text-xs text-text-muted">
            Inspect nested git repositories, initialize submodules, and sync remotes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSubmodules}
            disabled={isLoading}
            className="p-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-text-muted hover:text-text-primary transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleInitSubmodules}
            className="px-3.5 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-primary transition cursor-pointer"
          >
            Init Submodules
          </button>

          <button
            onClick={handleSyncSubmodules}
            className="px-3.5 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-primary transition cursor-pointer"
          >
            Sync Remotes
          </button>

          <button
            onClick={handleUpdateSubmodules}
            className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-md text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Update Recursive
          </button>
        </div>
      </div>

      {/* Submodule List */}
      <div className="space-y-2">
        {submodules.length === 0 ? (
          <div className="p-8 text-center bg-base-2 border border-border rounded-md text-xs text-text-muted italic">
            No Git submodules registered in this repository (.gitmodules)
          </div>
        ) : (
          submodules.map((sub) => (
            <div
              key={sub.path}
              className="p-3.5 bg-base-2/60 border border-border rounded-md flex items-center justify-between hover:bg-base-2 transition"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <FolderGit2 className="w-4 h-4 text-gitlab-teal flex-shrink-0" />
                <div className="min-w-0 truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-text-primary truncate">
                      {sub.name}
                    </span>
                    <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted">
                      {sub.head_sha.slice(0, 7)}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted font-mono truncate mt-0.5">
                    {sub.path}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {sub.is_dirty && (
                  <span className="px-2 py-0.5 bg-git-modified-bg border border-git-modified/40 text-git-modified text-[10px] font-mono font-bold rounded">
                    Modified
                  </span>
                )}
                {sub.is_initialized ? (
                  <span className="px-2 py-0.5 bg-git-added-bg border border-git-added/40 text-git-added text-[10px] font-mono font-bold rounded">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-base-3 text-text-muted border border-border text-[10px] font-mono font-bold rounded">
                    Uninitialized
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
