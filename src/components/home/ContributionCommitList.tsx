import React from 'react';
import { GitCommit, FolderGit2, Calendar, Clock, X, ExternalLink } from 'lucide-react';
import { useContributionsStore } from '../../store/contributionsStore';
import { openRepo } from '../../features/repos';
import { useRepoStore } from '../../store/repoStore';

export const ContributionCommitList: React.FC = () => {
  const { selectedDate, setSelectedDate, getRecentCommits, getSelectedDayData } =
    useContributionsStore();
  const repos = useRepoStore((s) => s.repos);

  const commits = getRecentCommits(30);
  const selectedDay = getSelectedDayData();

  const formatDateTitle = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleOpenRepo = (repoPath?: string | null, repoName?: string) => {
    if (repoPath) {
      openRepo(repoPath);
      return;
    }
    if (repoName) {
      const found = repos.find((r) => r.name.toLowerCase() === repoName.toLowerCase());
      if (found) {
        openRepo(found.path);
      }
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2 select-none font-sans">
      {/* Header with Title and Clear Filter */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-commito-coral shrink-0" />
          <span className="text-xs font-semibold text-text-secondary tracking-tight truncate">
            {selectedDate ? (
              <>
                Commits on <span className="text-text-primary">{formatDateTitle(selectedDate)}</span>
                <span className="ml-1.5 text-[11px] font-normal text-text-muted">
                  ({selectedDay?.count || 0} {selectedDay?.count === 1 ? 'contribution' : 'contributions'})
                </span>
              </>
            ) : (
              <>
                Recent Commit Activity
                <span className="ml-1.5 text-[11px] font-normal text-text-muted">
                  (Showing latest {commits.length} commits)
                </span>
              </>
            )}
          </span>
        </div>

        {selectedDate && (
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="text-[11px] text-text-muted hover:text-text-primary hover:bg-base-2 px-2 py-0.5 rounded-xs flex items-center gap-1 transition cursor-pointer font-medium"
            title="Clear date filter"
          >
            <X className="w-3 h-3" />
            <span>Show all</span>
          </button>
        )}
      </div>

      {/* Commit Items List */}
      {commits.length > 0 ? (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {commits.map((commit) => (
            <div
              key={commit.id}
              onClick={() => handleOpenRepo(commit.repo_path, commit.repo_name)}
              className="group px-3.5 py-2.5 bg-base-1 border border-border hover:border-border-strong rounded-sm hover:bg-base-1 transition-all duration-150 ease-out hover:translate-x-0.5 active:scale-[0.998] cursor-pointer flex items-center justify-between gap-4 select-none animate-in fade-in duration-150 shadow-2xs"
            >
              {/* Left: Commit info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-7.5 h-7.5 rounded-sm bg-base-0 border border-border flex items-center justify-center text-text-muted group-hover:text-commito-coral group-hover:border-border-strong transition-colors shrink-0">
                  <GitCommit className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-text-primary/95 truncate tracking-tight">
                      {commit.message}
                    </p>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-xs bg-base-0 border border-border text-text-muted shrink-0">
                      {commit.short_sha}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10.5px] text-text-muted mt-0.5 font-sans">
                    <span className="flex items-center gap-1 text-text-secondary truncate font-medium">
                      <FolderGit2 className="w-3 h-3 text-text-muted" />
                      {commit.repo_name}
                    </span>
                    <span>·</span>
                    <span className="truncate">{commit.author_name}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-text-muted/80" />
                      {commit.relative_date}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Open Repo Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenRepo(commit.repo_path, commit.repo_name);
                }}
                className="opacity-0 group-hover:opacity-100 h-6 px-2 bg-base-2 hover:bg-base-3 border border-border text-text-secondary hover:text-text-primary text-[10.5px] font-medium rounded-xs flex items-center gap-1 transition cursor-pointer shrink-0 shadow-2xs"
                title={`Open repository ${commit.repo_name}`}
              >
                <span>Open</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state for the selected day or feed */
        <div className="py-4 px-4 bg-base-1/40 border border-border/40 rounded-sm text-center">
          <p className="text-xs text-text-muted">
            {selectedDate
              ? `No local commit records found for ${formatDateTitle(selectedDate)}.`
              : 'No recent commit activity detected in local repositories.'}
          </p>
          <p className="text-[10px] text-text-muted/70 mt-0.5">
            Remote merges, PRs, and issues are reflected in the total contribution count.
          </p>
        </div>
      )}
    </div>
  );
};
