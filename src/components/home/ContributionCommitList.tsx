import React, { useMemo } from 'react';
import { FolderGit2, Clock, X, ExternalLink } from 'lucide-react';
import { useContributionsStore } from '../../store/contributionsStore';
import { openRepo } from '../../features/repos';
import { useRepoStore } from '../../store/repoStore';
import { UserAvatar } from '../common/UserAvatar';

export const ContributionCommitList: React.FC = () => {
  const calendar = useContributionsStore((s) => s.calendar);
  const selectedDate = useContributionsStore((s) => s.selectedDate);
  const setSelectedDate = useContributionsStore((s) => s.setSelectedDate);
  const getRecentCommits = useContributionsStore((s) => s.getRecentCommits);
  const getSelectedDayData = useContributionsStore((s) => s.getSelectedDayData);
  const repos = useRepoStore((s) => s.repos);

  const commits = useMemo(() => getRecentCommits(30), [getRecentCommits, selectedDate, calendar]);
  const selectedDay = useMemo(() => getSelectedDayData(), [getSelectedDayData, selectedDate, calendar]);

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
    <div className="pt-3 border-t border-border/60 space-y-2 select-none font-sans">
      {/* Header with Title and Clear Filter */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* <Calendar className="w-3.5 h-3.5 text-commito-coral shrink-0" /> */}
          <span className="text-xs font-semibold text-text-secondary tracking-tight truncate">
            {selectedDate ? (
              <>
                Commits on{' '}
                <span className="text-text-primary font-semibold">
                  {formatDateTitle(selectedDate)}
                </span>
                <span className="ml-1.5 text-[11px] font-normal text-text-muted">
                  ({selectedDay?.count || 0}{' '}
                  {selectedDay?.count === 1 ? 'contribution' : 'contributions'})
                </span>
              </>
            ) : (
              <>
                Recent Commit Activity
                <span className="ml-1.5 text-[11px] font-normal text-text-muted">
                  (Latest {commits.length} commits)
                </span>
              </>
            )}
          </span>
        </div>

        {selectedDate && (
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="text-[11px] text-text-muted hover:text-text-primary hover:bg-base-2 px-2 py-0.5 rounded-xs flex items-center gap-1 transition cursor-pointer font-medium border border-border"
            title="Clear date filter"
          >
            <X className="w-3 h-3" />
            <span>Show all</span>
          </button>
        )}
      </div>

      {/* Commit Items List */}
      {commits.length > 0 ? (
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
          {commits.map((commit) => (
            <div
              key={commit.id}
              onClick={() => handleOpenRepo(commit.repo_path, commit.repo_name)}
              className="group px-3.5 py-2 bg-base-1/50 border border-border hover:border-border-strong rounded-sm hover:bg-base-1 transition-all duration-150 ease-out cursor-pointer flex items-center justify-between gap-3 select-none shadow-2xs"
            >
              {/* Left: Avatar + Commit Info */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <UserAvatar
                  name={commit.author_name}
                  email={commit.author_email}
                  className="w-6 h-6 text-[9px] shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-text-primary truncate tracking-tight">
                      {commit.message}
                    </p>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-xs bg-base-0 border border-border text-commito-coral shrink-0">
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
                    <span className="flex items-center gap-1 font-mono text-[10px]">
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
                className="opacity-0 group-hover:opacity-100 h-6 px-2.5 bg-base-2 hover:bg-base-3 border border-border text-text-secondary hover:text-text-primary text-[10.5px] font-medium rounded-xs flex items-center gap-1 transition cursor-pointer shrink-0 shadow-2xs"
                title={`Open repository ${commit.repo_name}`}
              >
                <span>Open</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-5 px-4 bg-base-1/40 border border-border/40 rounded-sm text-center">
          <p className="text-xs text-text-muted">
            {selectedDate
              ? `No local commit records found for ${formatDateTitle(selectedDate)}.`
              : 'No recent commit activity detected in local repositories.'}
          </p>
        </div>
      )}
    </div>
  );
};
