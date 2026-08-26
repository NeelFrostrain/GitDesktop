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
  const primaryCls =
    'h-7.5 px-2.5 rounded-sm bg-gradient-to-b from-[#ff5733] via-[#ff3b14] to-[#e62a04] hover:from-[#ff6e4d] hover:via-[#ff5733] hover:to-[#ff3b14] active:from-[#e62a04] active:to-[#bf2000] text-white text-xs font-bold flex items-center gap-1.5 transition border border-[#cc2500] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)] cursor-pointer active:scale-95';
  const secondaryCls =
    'h-7.5 px-2.5 rounded-sm bg-gradient-to-b from-[#0091ff] via-[#0077ff] to-[#005be0] hover:from-[#38a9ff] hover:via-[#0091ff] hover:to-[#0077ff] active:from-[#005be0] active:to-[#0047b3] text-white text-xs font-bold flex items-center gap-1.5 transition border border-[#0052cc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)] cursor-pointer active:scale-95';
  const mutedCls =
    'h-7.5 px-2.5 rounded-sm border border-[#2d2b32] bg-gradient-to-b from-[#222025] via-[#1a191d] to-[#131215] text-text-muted text-xs font-medium flex items-center gap-1.5 cursor-default select-none shadow-2xs';
  const warnCls =
    'h-7.5 px-2.5 rounded-sm border border-[#b45309] bg-gradient-to-b from-[#ffb300] via-[#f59e0b] to-[#d97706] text-white text-xs font-bold flex items-center gap-1.5 cursor-default select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]';

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
    const busyVariantCls = isPulling
      ? `${secondaryCls} opacity-90 cursor-wait active:scale-100`
      : `${primaryCls} opacity-90 cursor-wait active:scale-100`;

    return {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />,
      label: opLabel,
      tooltip: 'Git operation in progress',
      className: busyVariantCls,
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
            className={`w-3.5 h-3.5 text-white ${
              isFetching ? 'animate-spin' : ''
            }`}
          />
        ),
        label: isFetching ? 'Fetching...' : 'Up to date',
        tooltip: `Branch '${branch}' is up to date. Click to fetch and refresh status.`,
        className: primaryCls,
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
function ProgressBar({ isPulling }: { isPulling: boolean }) {
  const barColor = isPulling
    ? 'bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]'
    : 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]';

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2.5px] overflow-hidden rounded-b-sm bg-black/35">
      <div
        style={{ animation: 'progress-sweep 1.2s ease-in-out infinite' }}
        className={`h-full w-1/2 ${barColor} rounded-full`}
      />
    </div>
  );
}

/**
 * Smart reactive action button adapting automatically to the repository's sync state.
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
    if (isBusy || config.disabled) return;
    if (syncStatus === 'up-to-date') {
      refreshSync();
    } else {
      executeAction();
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {showDirtyWarning && <DirtyWarningBanner />}

      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={config.disabled || isBusy}
          className={config.className}
          title={config.tooltip}
        >
          {config.icon}
          <span>{config.label}</span>
        </button>

        {isBusy && <ProgressBar isPulling={isPulling} />}
      </div>
    </div>
  );
};
