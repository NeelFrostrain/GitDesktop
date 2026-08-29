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
    'h-7 px-2.5 rounded-sm bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition shadow-xs cursor-pointer active:scale-95 select-none';
  const secondaryCls =
    'h-7 px-2.5 rounded-sm bg-info hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition shadow-xs cursor-pointer active:scale-95 select-none';
  const mutedCls =
    'h-7 px-2.5 rounded-sm border border-border bg-base-1 text-text-muted text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-default select-none shadow-2xs';
  const warnCls =
    'h-7 px-2.5 rounded-sm border border-warning/80 bg-warning text-black text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-default select-none shadow-xs';

  const neutralCls =
    'h-7.5 px-2.5 rounded-sm border border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer active:scale-95 select-none group';

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
        icon: isFetching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors" />
        ),
        label: isFetching ? 'Fetching...' : 'Fetch origin',
        tooltip: `Branch '${branch}' is up to date. Click to fetch and refresh status.`,
        className: neutralCls,
        disabled: false,
      };
    case 'no-remote':
      return {
        icon: <Upload className="w-3.5 h-3.5" />,
        label: 'Publish repository',
        tooltip: 'No remote configured. Click to publish this repository to GitHub, GitLab, or Bitbucket.',
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
      className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/60 px-1.5 py-0.5 rounded-sm select-none"
      title="Working tree has uncommitted modifications. Commit or stash before pulling to avoid conflicts."
    >
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      <span className="hidden sm:inline">Modified</span>
    </span>
  );
}

/**
 * Visual progress bar indicator when push/pull network operations are active.
 */
function ProgressBar({ isPulling }: { isPulling: boolean }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/30 overflow-hidden rounded-b-sm"
      role="progressbar"
      aria-label={isPulling ? 'Pull progress' : 'Push progress'}
    >
      <div
        className={`h-full animate-[progress_1.2s_ease-in-out_infinite] ${
          isPulling ? 'bg-blue-300' : 'bg-orange-300'
        }`}
        style={{
          width: '60%',
          transformOrigin: 'left',
        }}
      />
    </div>
  );
}

/**
 * Context-aware smart button that dynamically handles Push, Pull, Sync,
 * or Fetch based on the current Git ahead/behind divergence state.
 */
export const SmartGitActionButton: React.FC = () => {
  const {
    syncInfo,
    isBusy,
    isPushing,
    isPulling,
    isFetching,
    hasRepo,
    executeAction,
    refreshSync,
    resetBusyState,
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
    if (isBusy) {
      resetBusyState();
      return;
    }
    if (config.disabled) return;
    if (syncStatus === 'up-to-date') {
      refreshSync();
    } else {
      executeAction();
    }
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {showDirtyWarning && <DirtyWarningBanner />}

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={handleClick}
          disabled={config.disabled && !isBusy}
          className={config.className}
          title={isBusy ? 'Operation in progress — click to cancel / unstick' : config.tooltip}
        >
          {config.icon}
          <span className="whitespace-nowrap leading-none">{config.label}</span>
        </button>

        {isBusy && <ProgressBar isPulling={isPulling} />}
      </div>
    </div>
  );
};
