import React, { useState } from 'react';
import { 
  CheckCircle2, 
  GitPullRequest, 
  CheckSquare, 
  ChevronDown, 
  User, 
  Info, 
  X,
  FolderGit2
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';

export const HomeDashboard: React.FC = () => {
  const { 
    user, 
    setIsRepoModalOpen, 
    setCurrentNavView,
    recentRepos,
    activeRepoPath,
    setActiveRepoPath,
    removeRecentRepo
  } = useGitStore();
  const [showBanner, setShowBanner] = useState(true);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDayGreeting = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    return `${today}. You've got this.`;
  };

  return (
    <div className="flex-1 bg-base-1 overflow-y-auto p-6 space-y-5 select-none">
      {/* Breadcrumb row */}
      <div className="text-[12px] text-text-muted flex items-center gap-1">
        <span>Your work</span>
        <span>/</span>
        <span className="text-text-primary font-medium">Home</span>
      </div>

      {/* Top Banner Alert */}
      {showBanner && (
        <div className="p-3 bg-base-2 border border-border rounded-lg flex items-center justify-between text-[13px] text-text-primary">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-github-dark-accent" />
            <span>The application was created successfully.</span>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="p-1 text-text-muted hover:text-text-primary rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* User Greeting Row */}
      <div className="flex items-center gap-3 py-1">
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full border border-border" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gitlab-purple text-gitlab-purpleLight text-sm font-semibold flex items-center justify-center border border-gitlab-purple/40">
            {user ? getInitials(user.name) : <User className="w-5 h-5" />}
          </div>
        )}
        <div>
          <h1 className="text-base font-semibold text-text-primary leading-tight">
            {user ? user.name : 'GitLab User'}
          </h1>
          <p className="text-[12px] text-text-muted">{getDayGreeting()}</p>
        </div>
      </div>

      {/* Grid: 4 Stat Cards + Quick Access Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Content Area (Stat Cards & Panels) */}
        <div className="lg:col-span-3 space-y-4">
          {/* 4-column Stat Card Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Stat 1 */}
            <div className="bg-base-2 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Merge requests</span>
                <GitPullRequest className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-medium text-text-primary">0</div>
              <div className="text-[11px] text-text-muted">Waiting for your review</div>
              <div className="text-[10px] text-text-faint">Just now</div>
            </div>

            {/* Stat 2 */}
            <div className="bg-base-2 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Merge requests</span>
                <GitPullRequest className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-medium text-text-primary">0</div>
              <div className="text-[11px] text-text-muted">Assigned to you</div>
              <div className="text-[10px] text-text-faint">Just now</div>
            </div>

            {/* Stat 3 */}
            <div className="bg-base-2 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Work items</span>
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-medium text-text-primary">0</div>
              <div className="text-[11px] text-text-muted">Assigned to you</div>
              <div className="text-[10px] text-text-faint">Just now</div>
            </div>

            {/* Stat 4 */}
            <div className="bg-base-2 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Work items</span>
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-medium text-text-primary">0</div>
              <div className="text-[11px] text-text-muted">Authored by you</div>
              <div className="text-[10px] text-text-faint">Just now</div>
            </div>
          </div>

          {/* Items that need your attention Panel */}
          <div className="bg-base-2 border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-text-primary">
                Items that need your attention
              </h2>
              <div className="flex items-center gap-1 px-2.5 py-1 bg-base-3 border border-border rounded-md text-[12px] text-text-secondary cursor-pointer hover:bg-base-1 transition">
                <span>Everything</span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              </div>
            </div>

            {/* Empty State */}
            <div className="py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gitlab-teal/20 text-gitlab-teal border border-gitlab-teal/40 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[13px] text-text-secondary">
                Good job! All your to-do items are done.
              </span>
            </div>

            <div className="pt-2 border-t border-border">
              <button
                onClick={() => setCurrentNavView('todos')}
                className="text-[12px] text-github-dark-accent hover:underline font-medium"
              >
                All to-do items
              </button>
            </div>
          </div>

          {/* Follow the latest updates Panel */}
          <div className="bg-base-2 border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-text-primary">
                Follow the latest updates
              </h2>
              <div className="flex items-center gap-1 px-2.5 py-1 bg-base-3 border border-border rounded-md text-[12px] text-text-secondary cursor-pointer hover:bg-base-1 transition">
                <span>Your activity</span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              </div>
            </div>

            <div className="py-2 text-[12px] text-text-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-text-muted" />
                <span>
                  Created project <span className="font-mono text-text-primary">{user ? `${user.username}/gitlab-profile` : 'user/gitlab-profile'}</span>
                </span>
              </div>
              <span className="text-[11px] text-text-faint">Recently</span>
            </div>

            <div className="pt-2 border-t border-border">
              <button
                onClick={() => setIsRepoModalOpen(true)}
                className="text-[12px] text-github-dark-accent hover:underline font-medium"
              >
                All activity
              </button>
            </div>
          </div>
        </div>

        {/* Quick Access Side Card */}
        <div className="bg-base-2 border border-border rounded-lg p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-text-primary">Saved Repositories</h2>
            <span className="text-[10px] text-gitlab-orange font-mono font-semibold">{recentRepos.length}</span>
          </div>

          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {recentRepos.length === 0 ? (
              <p className="text-[12px] text-text-muted leading-relaxed italic">
                No saved repositories yet. Open or clone a repository to save it here.
              </p>
            ) : (
              recentRepos.map((rPath) => {
                const rName = rPath.split(/[/\\]/).filter(Boolean).pop() || rPath;
                const isActive = activeRepoPath && activeRepoPath.replace(/\\/g, '/') === rPath.replace(/\\/g, '/');

                return (
                  <div
                    key={rPath}
                    onClick={() => setActiveRepoPath(rPath)}
                    className={`p-2 rounded-md cursor-pointer text-xs flex items-center justify-between group transition border ${
                      isActive
                        ? 'bg-gitlab-orange/20 border-gitlab-orange/50 text-gitlab-orange font-semibold'
                        : 'bg-base-3 border-border hover:border-text-muted text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <FolderGit2 className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gitlab-orange' : 'text-gitlab-teal'}`} />
                      <div className="truncate min-w-0">
                        <div className="font-medium truncate">{rName}</div>
                        <div className="text-[10px] text-text-faint font-mono truncate">{rPath}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentRepo(rPath);
                      }}
                      className="p-1 text-text-faint hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                      title="Remove from saved repositories"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => setIsRepoModalOpen(true)}
            className="w-full py-1.5 bg-base-3 hover:bg-base-1 border border-border rounded-md text-[12px] text-text-primary font-medium transition flex items-center justify-center gap-1.5"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-gitlab-orange" />
            Explore Projects
          </button>
        </div>
      </div>
    </div>
  );
};
