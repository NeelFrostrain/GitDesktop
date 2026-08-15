import React, { useState, useEffect } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { useTerminalStore } from './store/terminalStore';
import { useRepoTerminal } from './hooks/useRepoTerminal';
import { TerminalTabBar } from './TerminalTabBar';
import { AutocompletePopup } from './components/AutocompletePopup';
import { LogViewer } from './components/LogViewer';

export const TerminalPanel: React.FC = () => {
  const { activeRepoPath, status } = useGitStore();
  const { isOpen, panelHeight, setPanelHeight } = useTerminalStore();
  const [isResizing, setIsResizing] = useState(false);

  // Sync active repo id in terminal store for logs
  useEffect(() => {
    if (activeRepoPath) {
      useTerminalStore.setState({ activeLogRepoId: activeRepoPath });
    }
  }, [activeRepoPath]);

  const {
    terminalContainerRef,
    isSessionAlive,
    autocomplete,
    clearTerminal,
    restartTerminal,
    searchInTerminal,
    applySuggestion,
  } = useRepoTerminal(activeRepoPath, activeRepoPath);

  // Resizing logic
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY;
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, setPanelHeight]);

  if (!isOpen || !activeRepoPath) {
    return (
      <>
        {/* Render LogViewer modal even if panel is collapsed */}
        <LogViewer />
      </>
    );
  }

  const repoName =
    activeRepoPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'Repository';

  return (
    <div
      style={{ height: `${panelHeight}px` }}
      className="relative w-full bg-[#0a0d12] border-t border-border flex flex-col flex-shrink-0 select-none group/terminal z-20"
    >
      {/* Resizable handle on top edge */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => setPanelHeight(260)}
        title="Drag to resize terminal • Double-click to reset (260px)"
        className={`absolute -top-1 left-0 w-full h-2 cursor-row-resize z-30 transition-colors flex items-center justify-center ${
          isResizing ? 'bg-commito-coral' : 'hover:bg-commito-coral/50'
        }`}
      >
        <div className="w-12 h-1 rounded-full bg-border group-hover/terminal:bg-commito-coral/80 transition-colors" />
      </div>

      {/* Header bar */}
      <TerminalTabBar
        repoName={repoName}
        branchName={status?.current_branch}
        isAlive={isSessionAlive}
        onClear={clearTerminal}
        onRestart={restartTerminal}
        onSearch={(q) => searchInTerminal(q, true)}
      />

      {/* Terminal Viewport */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden p-1.5 bg-[#0a0d12]">
        <div
          ref={terminalContainerRef}
          className="w-full h-full [&_.xterm]:p-1 [&_.xterm-viewport]:scrollbar-thin [&_.xterm-viewport]:scrollbar-thumb-base-3"
        />

        {/* Ghost Text Overlay if available */}
        {autocomplete.ghostText && autocomplete.isVisible && (
          <div className="absolute right-4 bottom-2 pointer-events-none text-xs font-mono text-gray-500 bg-base-2/70 px-2 py-0.5 rounded border border-border/50">
            Suggestion remainder: <span className="text-gray-300 font-semibold">{autocomplete.ghostText}</span>
          </div>
        )}

        {/* Autocomplete Popup list */}
        {autocomplete.isVisible && (
          <AutocompletePopup
            suggestions={autocomplete.suggestions}
            selectedIndex={autocomplete.selectedIndex}
            onSelect={(item) => applySuggestion(item.value, autocomplete.suggestions.length === 1)}
          />
        )}
      </div>

      {/* Log Viewer Modal */}
      <LogViewer />
    </div>
  );
};
