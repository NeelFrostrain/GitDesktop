import React, { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Minus,
  Square,
  Copy,
  X,
  ChevronDown,
  User,
  Plus,
  LogOut,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useAccountServicesStore } from '../../features/account-services';
import { UserAvatar } from '../common/UserAvatar';
import { SystemService } from '../../services/system/systemService';
import { AccountService } from '../../services/accounts/accountService';

/**
 * Custom frameless application titlebar with drag region, user profile menu,
 * and native window control buttons (minimize, maximize/restore, close).
 */
export const Titlebar: React.FC = () => {
  const { user, accounts, setUser, setAccounts, setActiveRepoPath, setStatus, setBranches } = useGitStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const appWindow = getCurrentWindow();

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
      {/* Left: App Icon */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div className="flex items-center gap-2 pointer-events-none">
          <img src="/app-icon.png" alt="Git Desktop" className="w-5 h-5 rounded-md object-contain shadow-xs" />
        </div>
      </div>

      {/* Right: Profile Dropdown + Window Action Controls */}
      <div
        className="titlebar-no-drag flex items-center gap-2.5 z-50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* User Account Profile Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((o) => !o)}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-base-2 border border-border hover:bg-base-3 hover:border-border-strong text-text-primary transition cursor-pointer shadow-xs"
            title={user ? user.name || user.username : 'Account Menu'}
          >
            <UserAvatar
              url={user?.avatar_url}
              name={user?.name || user?.username || 'Guest'}
              provider={user?.provider}
              className="w-5 h-5"
              iconClassName="w-3 h-3"
            />
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${
                isProfileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Profile Dropdown Panel */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-base-1 border border-border rounded-md shadow-2xl z-50 py-1 text-xs select-none">
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
                  useAccountServicesStore.getState().openModalWithTab('accounts');
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-text-secondary hover:bg-base-2 hover:text-text-primary transition flex items-center gap-2 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-gitlab-teal" />
                Account Services & Repositories
              </button>

              <button
                onClick={() => {
                  useAccountServicesStore.getState().openModalWithTab('add');
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-text-secondary hover:bg-base-2 hover:text-text-primary transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-text-muted" />
                Add Remote Account
              </button>

              {user && (
                <>
                  <div className="h-px bg-border mx-2 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-950/40 hover:text-red-300 transition flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Vertical Separator */}
        <div className="h-4 w-px bg-border my-auto" />

        {/* Window Control Buttons */}
        <button
          type="button"
          onClick={handleMinimize}
          className="w-8 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          className="w-8 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
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
          className="w-8 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-red-600 hover:text-white transition cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </header>
  );
};
