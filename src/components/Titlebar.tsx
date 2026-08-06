import React, { useState, useEffect } from 'react';
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
      } catch {
        // Fallback for non-Tauri envs
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
        // Ignore
      }
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleToggleMaximize = async () => {
    await appWindow.toggleMaximize();
    const maximized = await appWindow.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <header
      data-tauri-drag-region
      className="h-9 bg-base-0 border-b border-border flex items-center justify-between px-3 select-none z-50 text-xs flex-shrink-0"
    >
      {/* Left: GitLab Logo & App Name */}
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <svg className="w-4 h-4 text-gitlab-orange flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 5.5 2a.43.43 0 0 1 .4.28l2.25 6.94h7.7l2.25-6.94a.43.43 0 0 1 .4-.28.42.42 0 0 1 .79.16l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94z" />
        </svg>
        <span data-tauri-drag-region className="font-semibold text-text-primary tracking-tight">
          GitLab Desktop
        </span>
      </div>

      {/* Center: GitLab Web Style Search Pill */}
      <div data-tauri-drag-region className="flex-1 max-w-md mx-4 flex items-center justify-center">
        <div className="w-full flex items-center gap-2 px-3 py-1 bg-base-1 border border-border rounded-md text-text-muted hover:border-border-strong cursor-text transition">
          <Search className="w-3.5 h-3.5 text-text-faint" />
          <span className="flex-1 text-[11px] truncate">Search or go to...</span>
          <kbd className="px-1.5 py-0.2 bg-base-2 border border-border rounded text-[10px] font-mono text-text-faint">
            /
          </kbd>
        </div>
      </div>

      {/* Right: Window Action Buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleMinimize}
          className="w-8 h-6 flex items-center justify-center rounded text-text-muted hover:bg-base-2 hover:text-text-primary transition"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleToggleMaximize}
          className="w-8 h-6 flex items-center justify-center rounded text-text-muted hover:bg-base-2 hover:text-text-primary transition"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          onClick={handleClose}
          className="w-8 h-6 flex items-center justify-center rounded text-text-muted hover:bg-red-600 hover:text-white transition"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
