import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Minus,
  Square,
  Copy,
  X,
  ChevronDown
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useAccountServicesStore } from '../features/account-services';
import { UserAvatar } from './UserAvatar';

export const Titlebar: React.FC = () => {
  const { user, setIsRepoModalOpen, setActiveModalTab, accounts, setUser, setAccounts, setActiveRepoPath, setStatus, setBranches } = useGitStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (err) {
        console.warn('Failed to check if window is maximized:', err);
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
      } catch (err) {
        console.warn('Failed to setup resize listener:', err);
      }
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Close dropdown on click outside
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
      await invoke('minimize_window');
    } catch {
      try {
        await appWindow.minimize();
      } catch (err) {
        console.error('Failed to minimize window:', err);
      }
    }
  };

  const handleToggleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const isNowMaximized = await invoke<boolean>('toggle_maximize_window');
      setIsMaximized(isNowMaximized);
    } catch {
      try {
        await appWindow.toggleMaximize();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (err) {
        console.error('Failed to toggle maximize window:', err);
      }
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await invoke('close_window');
    } catch {
      try {
        await appWindow.close();
      } catch (err) {
        console.error('Failed to close window:', err);
      }
    }
  };


  const handleSignOut = async () => {
    try {
      await invoke('logout_gitlab');
    } catch {}
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
      {/* Left: App Logo & Title */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div className="flex items-center gap-2 pointer-events-none">
          <img src="/app-icon.png" alt="Git Desktop" className="w-5 h-5 rounded-md object-contain shadow-sm" />
          {/* <span className="font-bold text-text-primary text-sm tracking-tight">Git Desktop</span> */}
        </div>
      </div>
        {/* Right: Profile Dropdown + Window Action Buttons */}
      <div
        className="titlebar-no-drag flex items-center gap-2.5 z-50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* User Account Profile Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((o) => !o)}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-base-2 border border-border hover:bg-base-3 hover:border-border-strong text-text-primary transition cursor-pointer shadow-sm"
            title={user ? user.name || user.username : 'Account Menu'}
          >
            <UserAvatar
              url={user?.avatar_url}
              name={user?.name || user?.username || 'Guest'}
              provider={user?.provider}
              className="w-5 h-5"
              iconClassName="w-3 h-3"
            />
            <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Profile dropdown panel */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-base-1 border border-border rounded-md shadow-2xl z-50 py-1 text-xs select-none">
              {/* Account info */}
              <div className="px-3 py-2.5 border-b border-border">
                <div className="font-semibold text-text-primary truncate">{user?.name || user?.username || 'Guest'}</div>
                {user?.username && user.name && (
                  <div className="text-[11px] text-text-muted font-mono truncate">@{user.username}</div>
                )}
                {accounts.length > 0 && (
                  <div className="text-[10px] text-text-faint mt-0.5">{accounts.length} account{accounts.length > 1 ? 's' : ''} saved</div>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={() => {
                  useAccountServicesStore.getState().openModalWithTab('accounts');
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-text-secondary hover:bg-base-2 hover:text-text-primary transition flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-gitlab-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account Services & Repositories
              </button>

              <button
                onClick={() => {
                  useAccountServicesStore.getState().openModalWithTab('add');
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-text-secondary hover:bg-base-2 hover:text-text-primary transition flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                + Add Remote Account
              </button>

              {user && (
                <>
                  <div className="h-px bg-border mx-2 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-950/40 hover:text-red-300 transition flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
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
          className="w-10 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          className="w-10 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
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
          className="w-10 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-red-600 hover:text-white transition cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </header>
  );
};

