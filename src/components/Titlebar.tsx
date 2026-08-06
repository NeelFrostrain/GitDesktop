import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, Copy, X, Search } from 'lucide-react';

export const Titlebar: React.FC = () => {
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
      className="titlebar-drag h-9 bg-base-0 border-b border-border flex items-center justify-between px-3 select-none z-50 text-xs flex-shrink-0 cursor-default"
    >
      {/* Left: GitLab Logo & App Name */}
      <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
        <img src="/favicon.png" alt="GitLab Logo" className="w-4 h-4 rounded-sm flex-shrink-0" />
        <span className="font-semibold text-text-primary tracking-tight">
          Git Desktop
        </span>
      </div>

      {/* Center: GitLab Web Style Search Pill */}
      <div
        className="titlebar-no-drag flex-1 max-w-md mx-4 flex items-center justify-center"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center gap-2 px-3 py-1 bg-base-1 border border-border rounded-md text-text-muted hover:border-border-strong cursor-text transition">
          <Search className="w-3.5 h-3.5 text-text-faint" />
          <span className="flex-1 text-[11px] truncate">Search or go to...</span>
          <kbd className="px-1.5 py-0.2 bg-base-2 border border-border rounded text-[10px] font-mono text-text-faint">
            /
          </kbd>
        </div>
      </div>

      {/* Right: Window Action Buttons */}
      <div
        className="titlebar-no-drag flex items-center gap-0.5 z-50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleMinimize}
          className="w-8 h-6 flex items-center justify-center rounded text-text-muted hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          className="w-8 h-6 flex items-center justify-center rounded text-text-muted hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
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
          className="w-8 h-6 flex items-center justify-center rounded text-text-muted hover:bg-red-600 hover:text-white transition cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </header>
  );
};

