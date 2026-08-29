import React, { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
  Users,
  Plus,
} from "lucide-react";
import { useGitStore } from "../../store/useGitStore";
import { useSettingsStore } from "../../features/settings";
import { useAccountServicesStore } from "../../features/account-services";
import { UserAvatar } from "../common/UserAvatar";
import { SystemService } from "../../services/system/systemService";
import { AccountService } from "../../services/accounts/accountService";

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
  const accountServicesAccounts = useAccountServicesStore((s) => s.accounts);
  const totalAccountsCount =
    accountServicesAccounts.length || accounts?.length || 0;
  const [isMaximized, setIsMaximized] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const appWindow = getCurrentWindow();

  const activeRepoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || "Repository"
    : null;
  const currentBranch = status?.current_branch || "main";
  const uncommittedCount = status?.files?.length || 0;
  const isClean = status?.is_clean ?? uncommittedCount === 0;

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await SystemService.minimizeWindow();
    } catch {
      await appWindow.minimize().catch(() => {});
    }
  };

  const handleToggleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const isNowMaximized = await SystemService.toggleMaximizeWindow();
      setIsMaximized(isNowMaximized);
    } catch {
      await appWindow.toggleMaximize().catch(() => {});
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
      await appWindow.close().catch(() => {});
    }
  };

  const titlebarRef = React.useRef<HTMLElement>(null);

  // Native mousedown → startDragging must fire inside the real pointer-down
  // event. React's synthetic event layer is enough to break Tauri's context.
  useEffect(() => {
    const el = titlebarRef.current;
    if (!el) return;
    const handleNativeDrag = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'button, input, select, a, [role="button"], .titlebar-no-drag',
        )
      )
        return;
      // startDragging must be called synchronously here — no await
      appWindow.startDragging().catch(() => {});
    };
    el.addEventListener("mousedown", handleNativeDrag);
    return () => el.removeEventListener("mousedown", handleNativeDrag);
  }, [appWindow]);

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
      ref={titlebarRef}
      data-tauri-drag-region
      onDoubleClick={handleToggleMaximize}
      className="titlebar-drag h-10 rounded-sm bg-base-0 border border-border/80 shadow-2xs mx-1.5 mt-1.5 mb-1.5 flex items-center justify-between px-3 select-none z-50 text-xs flex-shrink-0 cursor-default relative"
    >
      {/* Left: App Icon + Clean Title */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 min-w-0 pointer-events-none"
      >
        <div className="flex items-center gap-2 pointer-events-none flex-shrink-0">
          <img
            src="/app-icon.png"
            alt="Git Desktop"
            className="w-4 h-4 rounded-sm object-contain shadow-xs"
          />
        </div>
        <span className="text-xs font-semibold text-text-primary tracking-tight">
          Git Desktop
        </span>
        {activeRepoName && currentNavView !== "home" && (
          <div
            data-tauri-drag-region
            className="flex items-center gap-1.5 min-w-0 text-text-muted text-xs"
          >
            <span className="text-border-strong">/</span>
            <span className="text-text-secondary truncate max-w-[220px] font-medium">
              {activeRepoName}
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions, Profile Dropdown & Window Control Buttons */}
      <div
        className="titlebar-no-drag flex items-center gap-1.5 z-50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {currentNavView !== "home" && (
          <button
            type="button"
            onClick={() => setCurrentNavView("home")}
            className="titlebar-no-drag h-6.5 px-2.5 flex items-center gap-1.5 rounded-sm border border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-primary transition cursor-pointer text-xs font-semibold select-none active:scale-95 group shadow-2xs"
            title="Go to Home"
          >
            <Home className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors" />
            <span>Home</span>
          </button>
        )}

        {/* User Account Profile Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((o) => !o)}
            className="h-6.5 px-1.5 flex items-center gap-1 rounded-sm border border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-primary transition cursor-pointer select-none active:scale-95 shadow-2xs"
            title={user ? user.name || user.username : "Account Menu"}
          >
            <UserAvatar
              url={user?.avatar_url}
              name={user?.name || user?.username || "Guest"}
              provider={user?.provider}
              className="w-4 h-4 rounded-full"
              iconClassName="w-2.5 h-2.5"
            />
            <ChevronDown
              className={`w-3 h-3 text-text-muted transition-transform duration-200 ${
                isProfileOpen ? "rotate-180 text-commito-coral" : ""
              }`}
            />
          </button>

          {/* Profile Dropdown Panel */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-base-1 border border-border rounded-sm shadow-2xl z-50 py-1 text-xs select-none">
              <div className="px-3 py-2.5 border-b border-border">
                <div className="font-semibold text-text-primary truncate">
                  {user?.name || user?.username || "Guest"}
                </div>
                {user?.username && user.name && (
                  <div className="text-[11px] text-text-muted font-mono truncate">
                    @{user.username}
                  </div>
                )}
                {totalAccountsCount > 0 && (
                  <div className="text-[10px] text-text-faint mt-0.5">
                    {totalAccountsCount} account
                    {totalAccountsCount > 1 ? "s" : ""} saved
                  </div>
                )}
              </div>

              {/* Menu Actions */}
              <button
                type="button"
                onClick={() => {
                  useAccountServicesStore
                    .getState()
                    .openModalWithTab("accounts");
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-text-secondary hover:bg-base-2 hover:text-text-primary transition flex items-center gap-2 cursor-pointer font-medium"
              >
                <Users className="w-3.5 h-3.5 text-commito-coral" />
                Manage Accounts ({totalAccountsCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  useAccountServicesStore.getState().openModalWithTab("add");
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-text-secondary hover:bg-base-2 hover:text-text-primary transition flex items-center gap-2 cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5 text-git-added" />
                Add Another Account
              </button>

              <button
                type="button"
                onClick={() => {
                  useGitStore.getState().setIsUserConfigModalOpen(true);
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-text-secondary hover:bg-base-2 hover:text-text-primary transition flex items-center gap-2 cursor-pointer font-medium"
              >
                <User className="w-3.5 h-3.5 text-text-muted" />
                Git Commit Identity
              </button>

              {user && (
                <>
                  <div className="h-px bg-border mx-2 my-1" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-git-removed hover:bg-git-removed-bg hover:text-danger transition flex items-center gap-2 cursor-pointer font-medium"
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
          className="titlebar-no-drag h-6.5 w-6.5 flex items-center justify-center rounded-sm border border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-text-primary transition cursor-pointer select-none active:scale-95 group shadow-2xs"
          title="Open Settings (Ctrl+,)"
        >
          <Settings className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary group-hover:rotate-45 transition-all duration-200" />
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
          title={isMaximized ? "Restore" : "Maximize"}
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
