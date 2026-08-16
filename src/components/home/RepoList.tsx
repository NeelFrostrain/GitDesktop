import React, { useState } from 'react';
import {
  Search,
  FolderGit2,
  DownloadCloud,
  FolderOpen,
  Plus,
} from 'lucide-react';
import { useRepoStore } from '../../store/repoStore';
import { useGitStore } from '../../store/useGitStore';
import { SystemService } from '../../services/system/systemService';
import { getErrorMessage } from '../../shared/utils/errorUtils';
import { RepoCard } from './RepoCard';

/**
 * Dashboard repository grid showing active repositories with branch status, ahead/behind indicators,
 * and quick-launch buttons for opening or cloning repositories.
 */
export const RepoList: React.FC = () => {
  const { repos, statuses, addRepo } = useRepoStore();
  const { setIsRepoModalOpen, setActiveModalTab } = useGitStore();
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenFolderDialog = async () => {
    try {
      const selectedPath = await SystemService.selectFolder();
      if (selectedPath) {
        await addRepo(selectedPath);
      }
    } catch (error: unknown) {
      alert(`Could not open repository: ${getErrorMessage(error)}`);
    }
  };

  const handleCloneRepo = () => {
    setActiveModalTab('repos');
    setIsRepoModalOpen(true);
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 select-none">
      {/* Search and Action Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter local repositories..."
            className="w-full bg-base-2 border border-border rounded-md pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleCloneRepo}
            className="px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border text-text-secondary hover:text-text-primary rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-gitlab-teal" />
            <span>Clone Repo</span>
          </button>
          <button
            onClick={handleOpenFolderDialog}
            className="px-3 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open Local</span>
          </button>
        </div>
      </div>

      {/* Grid of Repos */}
      {filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredRepos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              status={statuses[repo.path]}
            />
          ))}

          {/* Quick Add Repository Tile */}
          <div
            onClick={handleOpenFolderDialog}
            className="border-2 border-dashed border-border hover:border-commito-coral/50 bg-base-2/20 hover:bg-base-2/40 rounded-md p-5 flex flex-col items-center justify-center text-center cursor-pointer transition group min-h-[140px]"
          >
            <div className="w-9 h-9 rounded-full bg-base-3 flex items-center justify-center text-text-muted group-hover:text-commito-coral group-hover:scale-110 transition mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary group-hover:text-commito-coral transition">
              Add Existing Repository
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">
              Open a local folder on your computer
            </span>
          </div>
        </div>
      ) : repos.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 bg-base-2/30 border border-border rounded-md flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-base-2 border border-border flex items-center justify-center text-commito-coral shadow-inner">
            <FolderGit2 className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-text-primary">No Repositories Found</h3>
            <p className="text-xs text-text-muted max-w-sm">
              Get started by opening a local repository from your computer or cloning from your connected GitLab/GitHub accounts.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleOpenFolderDialog}
              className="px-4 py-2 bg-commito-coral hover:bg-commito-coralLight text-white rounded-md text-xs font-bold flex items-center gap-2 transition shadow-md cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Add Existing Repository</span>
            </button>
            <button
              onClick={handleCloneRepo}
              className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border text-text-primary rounded-md text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4 text-gitlab-teal" />
              <span>Clone from Remote</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-text-muted bg-base-2/40 border border-border rounded-md">
          No repositories match &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
};
