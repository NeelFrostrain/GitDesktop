import React, { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Minus,
  Square,
  Copy,
  X,
  ChevronDown,
  User,
  LogOut,
  Home,
  FolderGit2,
  GitBranch,
  Settings,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useSettingsStore } from '../../features/settings';
import { UserAvatar } from '../common/UserAvatar';
import { SystemService } from '../../services/system/systemService';
import { AccountService } from '../../services/accounts/accountService';

/**
 * Custom frameless application titlebar with drag region, user profile menu,
 * repository details, and native window control buttons (minimize, maximize/restore, close).
 */
export const Titlebar: React.FC = () => {
  const {
    user,
    accounts,
    setUser,
    setAccounts,
    activeRepoPath,
    setActiveRepoPath,
    status,
    setStatus,
    setBranches,
    currentNavView,
    setCurrentNavView,
  } = useGitStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const appWindow = getCurrentWindow();

  const activeRepoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository'
    : null;
  const currentBranch = status?.current_branch || 'main';
  const uncommittedCount = status?.files?.length || 0;
  const isClean = status?.is_clean ?? (uncommittedCount === 0);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch {
        // Silently ignore window state read errors
      }
    };
    checkMaximized();

    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        unlisten = await appWindow.onResized(async () => {
          const maximized = await appWindow.isMaximized();
          setIsMaximized(maximized);
        });
      } catch {
        // Silently ignore resize listener setup errors
      }
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [appWindow]);

  // Dismiss dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await SystemService.minimizeWindow();
    } catch {
      await appWindow.minimize().catch(() => { });
    }
  };

  const handleToggleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const isNowMaximized = await SystemService.toggleMaximizeWindow();
      setIsMaximized(isNowMaximized);
    } catch {
      await appWindow.toggleMaximize().catch(() => { });
      const maximized = await appWindow.isMaximized().catch(() => false);
      setIsMaximized(maximized);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await SystemService.closeWindow();
    } catch {
      await appWindow.close().catch(() => { });
    }
  };

  const handleSignOut = async () => {
    try {
      await AccountService.logoutGitLab();
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    setAccounts([]);
    setActiveRepoPath(null);
    setStatus(null);
    setBranches([]);
    setIsProfileOpen(false);
  };

  return (
    <header
      data-tauri-drag-region
      className="titlebar-drag h-10 bg-base-0 border-b border-border flex items-center justify-between px-3 select-none z-50 text-xs flex-shrink-0 cursor-default relative"
    >
      {/* Left: App Icon + Current Open Repo Details */}
      <div data-tauri-drag-region className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-2 pointer-events-none flex-shrink-0">
          <img src="/app-icon.png" alt="Git Desktop" className="w-5 h-5 rounded-sm object-contain shadow-xs" />
        </div>

        {activeRepoName && currentNavView !== 'home' ? (
          <div data-tauri-drag-region className="flex items-center gap-2 min-w-0">
            <div className="h-3.5 w-px bg-border/70 flex-shrink-0" />

            {/* Repo Name */}
            <div
              data-tauri-drag-region
              className="flex items-center gap-1.5 min-w-0"
              title={`Repository: ${activeRepoName}\nPath: ${activeRepoPath}`}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
              <span className="font-semibold text-xs text-text truncate max-w-[160px]">
                {activeRepoName}
              </span>
            </div>

            {/* Active Branch Chip */}
            <div
              data-tauri-drag-region
              className="h-5 px-1.5 inline-flex items-center gap-1 rounded-sm bg-base-2 border border-border/70 text-[10.5px] font-mono text-text-subtle flex-shrink-0"
              title={`Branch: ${currentBranch}`}
            >
              <GitBranch className="w-3 h-3 text-commito-coral flex-shrink-0" />
              <span className="truncate max-w-[120px]">{currentBranch}</span>
            </div>

            {/* Status Indicator Chip (Clean / Modified) */}
            <div
              data-tauri-drag-region
              className={`h-5 px-1.5 inline-flex items-center gap-1 rounded-sm text-[10.5px] font-mono font-medium border flex-shrink-0 ${isClean
                ? 'bg-git-added/10 text-git-added border-git-added/25'
                : 'bg-git-modified/10 text-git-modified border-git-modified/25'
                }`}
              title={isClean ? 'Working directory clean' : `${uncommittedCount} modified files in working directory`}
            >
              <span>{isClean ? 'clean' : `${uncommittedCount} modified`}</span>
            </div>

            {/* Ahead / Behind Counts Chip */}
            {Boolean(status?.ahead || status?.behind) && (
              <div
                data-tauri-drag-region
                className="h-5 px-1.5 inline-flex items-center gap-1.5 rounded-sm bg-base-2 border border-border/70 text-[10.5px] font-mono flex-shrink-0"
              >
                {Boolean(status?.ahead) && (
                  <span className="text-git-ahead" title={`${status?.ahead} commits ahead of remote`}>
                    ↑{status?.ahead}
                  </span>
                )}
                {Boolean(status?.behind) && (
                  <span className="text-git-behind" title={`${status?.behind} commits behind remote`}>
                    ↓{status?.behind}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div data-tauri-drag-region className="flex items-center gap-2">
            <div className="h-3.5 w-px bg-border/70" />
            <span className="text-xs text-text-muted font-medium">Git Desktop</span>
          </div>
        )}
      </div>

      {/* Right: Actions, Profile Dropdown & Window Control Buttons */}
      <div
        className="titlebar-no-drag flex items-center gap-1.5 z-50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {currentNavView !== 'home' && (
          <button
            type="button"
            onClick={() => setCurrentNavView('home')}
            className="titlebar-no-drag h-6.5 px-2 flex items-center gap-1.5 rounded-sm text-text-muted hover:text-text-primary bg-base-2 hover:bg-base-3 border border-border transition cursor-pointer text-xs font-medium shadow-xs select-none"
            title="Go to Home"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
        )}

        {/* User Account Profile Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((o) => !o)}
            className="h-6.5 px-1.5 flex items-center gap-1 rounded-sm bg-base-2 border border-border hover:bg-base-3 hover:border-border-strong text-text-primary transition cursor-pointer shadow-xs select-none"
            title={user ? user.name || user.username : 'Account Menu'}
          >
            <UserAvatar
              url={user?.avatar_url}
              name={user?.name || user?.username || 'Guest'}
              provider={user?.provider}
              className="w-4 h-4 rounded-full"
              iconClassName="w-2.5 h-2.5"
            />
            <ChevronDown
              className={`w-3 h-3 text-text-muted transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''
                }`}
            />
          </button>

          {/* Profile Dropdown Panel */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-base-1 border border-border rounded-sm shadow-2xl z-50 py-1 text-xs select-none">
              <div className="px-3 py-2.5 border-b border-border">
                <div className="font-semibold text-text-primary truncate">
                  {user?.name || user?.username || 'Guest'}
                </div>
                {user?.username && user.name && (
                  <div className="text-[11px] text-text-muted font-mono truncate">@{user.username}</div>
                )}
                {accounts.length > 0 && (
                  <div className="text-[10px] text-text-faint mt-0.5">
                    {accounts.length} account{accounts.length > 1 ? 's' : ''} saved
                  </div>
                )}
              </div>

              {/* Menu Actions */}
              <button
                onClick={() => {
                  useGitStore.getState().setIsUserConfigModalOpen(true);
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-text-secondary hover:bg-base-2 hover:text-text-primary transition flex items-center gap-2 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-commito-coral" />
                Git User Configuration
              </button>

              {user && (
                <>
                  <div className="h-px bg-border mx-2 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-git-removed hover:bg-git-removed-bg hover:text-danger transition flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Settings Button */}
        <button
          type="button"
          onClick={() => useSettingsStore.getState().openSettings()}
          className="titlebar-no-drag h-6.5 w-6.5 flex items-center justify-center rounded-sm text-text-muted hover:text-text-primary bg-base-2 hover:bg-base-3 border border-border transition cursor-pointer shadow-xs"
          title="Open Settings (Ctrl+,)"
        >
          <Settings className="w-3.5 h-3.5 text-text-secondary" />
        </button>

        {/* Vertical Separator */}
        <div className="h-4 w-px bg-border my-auto" />

        {/* Window Control Buttons */}
        <button
          type="button"
          onClick={handleMinimize}
          className="w-8 h-6 flex items-center justify-center rounded-sm text-text-muted hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          className="w-8 h-6 flex items-center justify-center rounded-sm text-text-muted hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180 pointer-events-none" />
          ) : (
            <Square className="w-3 h-3 pointer-events-none" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="w-8 h-6 flex items-center justify-center rounded-sm text-text-muted hover:bg-red-600 hover:text-white transition cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </header>
  );
};
