import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Minus,
  Square,
  Copy,
  X,
  ChevronDown,
  User,
  LogOut,
  FolderGit2,
  Terminal,
  Plus,
  Key
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { UserAvatar } from './UserAvatar';

export const Titlebar: React.FC = () => {
  const { user, setUser, setIsRepoModalOpen, setActiveModalTab } = useGitStore();
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

  const handleSignOut = () => {
    setUser(null);
    setIsProfileOpen(false);
    useLogStore.getState().addLog('info', 'Auth', 'Signed out of user session');
    setActiveModalTab('accounts');
    setIsRepoModalOpen(true);
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
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search or run a command"
            className="w-full bg-base-2 border border-border rounded-md pl-8 pr-12 py-1 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
          />
          <svg className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <kbd className="absolute right-2 top-1 px-1.5 py-0.2 bg-base-3 border border-border rounded text-[9px] font-mono text-text-muted">
            ⌘K
          </kbd>
        </div>
        {/* User Account Profile Button Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
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

          {/* Floating Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-base-1 border border-border rounded-md shadow-2xl z-50 py-1 text-xs select-none">
              {/* Account Header Profile Info */}
              <div className="p-3 border-b border-border bg-base-2/80">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    url={user?.avatar_url}
                    name={user?.name || user?.username || 'Guest'}
                    provider={user?.provider}
                    className="w-9 h-9"
                    iconClassName="w-4 h-4"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-text-primary truncate text-xs leading-tight">
                      {user ? user.name || user.username : 'Guest User'}
                    </h4>
                    <p className="text-[11px] text-text-muted truncate font-mono">
                      {user?.username ? `@${user.username}` : user?.email || 'Not signed in'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        {user ? 'Signed In' : 'Offline'}
                      </span>
                      {user?.provider && (
                        <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded text-[9px] font-mono text-commito-coral font-bold uppercase ml-auto">
                          {user.provider}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    useGitStore.getState().setIsUserConfigModalOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-commito-coral group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-xs">Git Identity & Profile</span>
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveModalTab('accounts');
                    setIsRepoModalOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gitlab-teal group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-xs">Accounts & Switcher</span>
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">Manage</span>
                </button>


                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveModalTab('repos');
                    setIsRepoModalOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-3.5 h-3.5 text-gitlab-blue group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-xs">Repositories & Remotes</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    useLogStore.getState().setIsLogModalOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-xs">Git Command Console</span>
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">Logs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveModalTab('accounts');
                    setIsRepoModalOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-xs">API Key / Access Tokens</span>
                  </div>
                </button>
              </div>

              {/* Footer / Sign Out Section */}
              <div className="p-1 border-t border-border mt-1">
                {user ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-2.5 py-1.5 rounded-md hover:bg-red-950/40 text-red-400 hover:text-red-300 flex items-center gap-2 transition cursor-pointer font-bold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out Session</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      setActiveModalTab('accounts');
                      setIsRepoModalOpen(true);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-md bg-commito-coral hover:bg-commito-coralHover text-white flex items-center justify-center gap-2 transition cursor-pointer font-bold shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Sign In to GitHub / GitLab</span>
                  </button>
                )}
              </div>
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
          className="w-8 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-red-600 hover:text-white transition cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </header>
  );
};

