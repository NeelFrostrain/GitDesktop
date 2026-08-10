import React, { useState, useEffect } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { RepositoryHeader } from './RepositoryHeader';
import { SidebarTabs } from './SidebarTabs';
import { ChangesPanel } from './changes/ChangesPanel';
import { CommitPanel } from './commit/CommitPanel';
import { HistoryPanel } from './history/HistoryPanel';

export const Sidebar: React.FC = () => {
  const { activeTab } = useGitStore();
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sidebar_width');
      return saved ? Math.max(240, Math.min(520, parseInt(saved, 10))) : 320;
    } catch {
      return 320;
    }
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(240, Math.min(520, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
      } catch {}
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, sidebarWidth]);

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative h-full bg-base-0 border-r border-border flex flex-col flex-shrink-0 select-none group/sidebar"
    >
      {/* Resizable handle bar */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => setSidebarWidth(320)}
        title="Drag to resize sidebar • Double-click to reset"
        className={`absolute top-0 right-0 w-0.5 h-full cursor-col-resize z-30 transition-colors flex items-center justify-center ${
          isResizing ? 'bg-commito-coral' : 'hover:bg-commito-coral/60'
        }`}
      >
        <div className="w-0.5 h-8 rounded-full transition-colors bg-border group-hover/sidebar:bg-commito-coral/80" />
      </div>

      <RepositoryHeader />
      <SidebarTabs />

      {activeTab === 'changes' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <ChangesPanel />
          <CommitPanel />
        </div>
      ) : (
        <HistoryPanel />
      )}
    </aside>
  );
};
