import React from 'react';
import {
  Upload,
  Download,
  ArrowUpDown,
  AlertTriangle,
  Loader2,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import { useRepositorySync, GitSyncStatus } from '../../hooks/useRepositorySync';

interface ButtonConfig {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  className: string;
  disabled: boolean;
}

/**
 * Computes button presentation properties (icon, label, tooltip, styling)
 * based on current ahead/behind synchronization status.
 */
function getButtonConfig(
  syncStatus: GitSyncStatus,
  ahead: number,
  behind: number,
  branch: string,
  isBusy: boolean,
  isClean: boolean,
  hasRepo: boolean,
  isPushing: boolean,
  isPulling: boolean,
  isFetching: boolean
): ButtonConfig {
  const disabledBase = 'opacity-60 cursor-not-allowed';
  const busyCls =
    'px-2.5 py-1 rounded-sm bg-base-2 border border-border text-text-muted text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed select-none';
  const primaryCls =
    'px-2.5 py-1 rounded-sm bg-commito-coral hover:bg-commito-coralLight text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer';
  const secondaryCls =
    'px-2.5 py-1 rounded-sm bg-gitlab-blue/90 hover:bg-gitlab-blue text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer';
  const upToDateCls =
    'px-2.5 py-1 rounded-sm border border-border bg-base-2 hover:bg-base-3 text-text-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition select-none';
  const mutedCls =
    'px-2.5 py-1 rounded-sm border border-border bg-base-2 text-text-muted text-xs font-semibold flex items-center gap-1.5 cursor-default select-none';
  const warnCls =
    'px-2.5 py-1 rounded-sm border border-git-conflict/40 bg-git-conflict-bg text-git-conflict text-xs font-bold flex items-center gap-1.5 cursor-default select-none';

  if (!hasRepo) {
    return {
      icon: <GitBranch className="w-3.5 h-3.5" />,
      label: 'No repo',
      tooltip: 'Open a repository first',
      className: `${mutedCls} ${disabledBase}`,
      disabled: true,
    };
  }

  if (isBusy) {
    const opLabel = isPushing
      ? 'Pushing...'
      : isPulling
      ? 'Pulling...'
      : isFetching
      ? 'Fetching...'
      : 'Working...';
    return {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      label: opLabel,
      tooltip: 'Git operation in progress',
      className: busyCls,
      disabled: true,
    };
  }

  const dirtyNote = !isClean ? ' (working tree has changes)' : '';

  switch (syncStatus) {
    case 'ahead':
      return {
        icon: <Upload className="w-3.5 h-3.5" />,
        label: ahead > 0 ? `Push ${ahead}` : 'Push',
        tooltip: `Push ${ahead} local commit(s) to origin/${branch}`,
        className: primaryCls,
        disabled: false,
      };
    case 'behind':
      return {
        icon: <Download className="w-3.5 h-3.5" />,
        label: behind > 0 ? `Pull ${behind}` : 'Pull',
        tooltip: `Pull ${behind} commit(s) from origin/${branch}${dirtyNote}`,
        className: secondaryCls,
        disabled: false,
      };
    case 'diverged':
      return {
        icon: <ArrowUpDown className="w-3.5 h-3.5" />,
        label: 'Sync',
        tooltip: `Diverged: ${ahead} ahead, ${behind} behind origin/${branch}${dirtyNote}. Pull then push.`,
        className: primaryCls,
        disabled: false,
      };
    case 'up-to-date':
      return {
        icon: (
          <RefreshCw
            className={`w-3.5 h-3.5 text-commito-coral ${
              isFetching ? 'animate-spin' : ''
            }`}
          />
        ),
        label: isFetching ? 'Fetching...' : 'Up to date',
        tooltip: `Branch '${branch}' is up to date. Click to fetch and refresh status.`,
        className: upToDateCls,
        disabled: false,
      };
    case 'no-upstream':
      return {
        icon: <Upload className="w-3.5 h-3.5" />,
        label: 'Publish',
        tooltip: `Branch '${branch}' has no upstream. Click to publish to origin.`,
        className: primaryCls,
        disabled: false,
      };
    case 'detached':
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        label: 'Detached HEAD',
        tooltip: 'HEAD is detached. Checkout a branch first.',
        className: warnCls,
        disabled: true,
      };
    case 'loading':
    default:
      return {
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        label: '...',
        tooltip: 'Loading repository state',
        className: `${mutedCls} ${disabledBase}`,
        disabled: true,
      };
  }
}

/**
 * Warning badge displayed when local working tree has uncommitted modifications.
 */
function DirtyWarningBanner() {
  return (
    <span
      className="text-[10px] text-git-modified bg-git-modified-bg border border-git-modified/40 px-1.5 py-0.5 rounded font-mono"
      title="Commit or stash local changes before pulling to avoid conflicts"
    >
      uncommitted changes
    </span>
  );
}

/**
 * Animated bottom sweep progress line during active network operations.
 */
function ProgressBar({ isPushing, isPulling }: { isPushing: boolean; isPulling: boolean }) {
  const barColor = isPushing
    ? 'bg-commito-coral'
    : isPulling
    ? 'bg-gitlab-blue'
    : 'bg-text-muted/60';

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-md bg-white/10">
      <div
        style={{ animation: 'progress-sweep 1.2s ease-in-out infinite' }}
        className={`h-full w-2/5 ${barColor} rounded-full`}
      />
    </div>
  );
}

/**
 * Smart reactive action button adapting automatically to the repository's sync state
 * with unified fetch/reload action.
 */
export const SmartGitActionButton: React.FC = () => {
  const {
    syncInfo,
    isBusy,
    isFetching,
    isPushing,
    isPulling,
    executeAction,
    refreshSync,
    hasRepo,
  } = useRepositorySync();

  const { syncStatus, ahead, behind, branch, isClean } = syncInfo;

  const config = getButtonConfig(
    syncStatus,
    ahead,
    behind,
    branch,
    isBusy,
    isClean,
    hasRepo,
    isPushing,
    isPulling,
    isFetching
  );

  const showDirtyWarning =
    !isClean && (syncStatus === 'behind' || syncStatus === 'diverged');

  const handleClick = () => {
    if (isBusy) return;
    if (syncStatus === 'up-to-date') {
      refreshSync();
    } else {
      executeAction();
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {showDirtyWarning && <DirtyWarningBanner />}

      <div className="relative inline-flex items-stretch rounded-sm shadow-xs">
        <button
          type="button"
          onClick={handleClick}
          disabled={config.disabled || isBusy}
          className={`${config.className} ${
            syncStatus !== 'up-to-date' && hasRepo ? 'rounded-r-none border-r-0' : ''
          }`}
          title={config.tooltip}
        >
          {config.icon}
          <span>{config.label}</span>
        </button>

        {/* Integrated Fetch / Reload companion trigger when in active action state */}
        {syncStatus !== 'up-to-date' && hasRepo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              refreshSync();
            }}
            disabled={isBusy}
            className="px-1.5 py-1 bg-base-2 hover:bg-base-3 border border-border border-l-border/60 text-text-muted hover:text-text-primary rounded-r-sm transition cursor-pointer flex items-center justify-center disabled:opacity-50"
            title="Fetch & Refresh repository status"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-commito-coral ${
                isFetching ? 'animate-spin' : ''
              }`}
            />
          </button>
        )}

        {isBusy && <ProgressBar isPushing={isPushing} isPulling={isPulling} />}
      </div>
    </div>
  );
};
