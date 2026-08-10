import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Minus,
  Square,
  Copy,
  X
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { UserAvatar } from './UserAvatar';

export const Titlebar: React.FC = () => {
  const { user } = useGitStore();
  const [isMaximized, setIsMaximized] = useState(false);
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
        {/* User Avatar (static display) */}
        <div className="relative">
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-base-2 border border-border text-text-primary shadow-sm">
            <UserAvatar
              url={user?.avatar_url}
              name={user?.name || user?.username || 'Guest'}
              provider={user?.provider}
              className="w-5 h-5"
              iconClassName="w-3 h-3"
            />
          </div>
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

