import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, Copy, X } from 'lucide-react';

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
      {/* Left: App Logo & GitHub Desktop Top Menu Items */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div className="flex items-center gap-2 pointer-events-none pr-1">
          <img src="/favicon.png" alt="App Logo" className="w-4 h-4 rounded-sm flex-shrink-0" />
        </div>

        {/* GitHub Desktop Menu Bar */}
        <div className="titlebar-no-drag flex items-center gap-0.5 text-xs text-text-primary">
          <button className="px-2 py-0.5 rounded hover:bg-base-2 text-text-primary transition">File</button>
          <button className="px-2 py-0.5 rounded hover:bg-base-2 text-text-primary transition">Edit</button>
          <button className="px-2 py-0.5 rounded hover:bg-base-2 text-text-primary transition">View</button>
          <button className="px-2 py-0.5 rounded hover:bg-base-2 text-text-primary transition">Repository</button>
          <button className="px-2 py-0.5 rounded hover:bg-base-2 text-text-primary transition">Branch</button>
          <button className="px-2 py-0.5 rounded hover:bg-base-2 text-text-primary transition">Help</button>
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

