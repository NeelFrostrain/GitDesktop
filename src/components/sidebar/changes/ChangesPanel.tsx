import React, { useState } from 'react';
import {
  Search,
  X,
  MoreHorizontal,
  FolderTree,
  List,
  FoldVertical,
  UnfoldVertical,
} from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { Checkbox } from '../../common/Checkbox';
import { ChangeFileList, ChangesViewMode } from './ChangeFileList';
import { ChangesHeaderContextMenu } from '../../context-menus/ChangesHeaderContextMenu';

export const ChangesPanel: React.FC = () => {
  const [fileFilter, setFileFilter] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [viewMode, setViewMode] = useState<ChangesViewMode>(() => {
    try {
      return (localStorage.getItem('git_changes_view_mode') as ChangesViewMode) || 'tree';
    } catch {
      return 'tree';
    }
  });
  const [expandAllTrigger, setExpandAllTrigger] = useState(0);
  const [collapseAllTrigger, setCollapseAllTrigger] = useState(0);
  const [areFoldersExpanded, setAreFoldersExpanded] = useState(true);

  const { status, stagedFiles, setAllStaged } = useGitStore();

  const allFiles = status?.files || [];
  const isAllStaged = allFiles.length > 0 && stagedFiles.length === allFiles.length;

  const handleToggleViewMode = () => {
    const nextMode: ChangesViewMode = viewMode === 'tree' ? 'list' : 'tree';
    setViewMode(nextMode);
    try {
      localStorage.setItem('git_changes_view_mode', nextMode);
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleToggleExpandAll = () => {
    if (areFoldersExpanded) {
      setCollapseAllTrigger((prev) => prev + 1);
      setAreFoldersExpanded(false);
    } else {
      setExpandAllTrigger((prev) => prev + 1);
      setAreFoldersExpanded(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
      {/* Compact Filter + Selection Toolbar */}
      <div className="px-2.5 pt-2 pb-1.5 border-b border-border/40 bg-base-0 flex flex-col gap-1.5 flex-shrink-0 select-none">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder="Filter changed files..."
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-base-1/80 hover:bg-base-1 focus:bg-base-1 border border-border/60 hover:border-border-strong/70 focus:border-commito-coral/70 rounded-sm text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-commito-coral/20 font-sans transition-all duration-150"
          />
          {fileFilter && (
            <button
              type="button"
              onClick={() => setFileFilter('')}
              className="absolute right-2 p-0.5 text-text-muted hover:text-text rounded-sm transition-colors cursor-pointer"
              title="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Selection Count Checkbox Row + View Toggles */}
        <div
          className="flex items-center justify-between px-[10px] py-0.5 rounded-sm text-xs select-none"
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Checkbox
              checked={isAllStaged}
              indeterminate={stagedFiles.length > 0 && !isAllStaged}
              onChange={() => setAllStaged(!isAllStaged)}
              disabled={allFiles.length === 0}
            />
            <span className="text-[11.5px] font-medium text-text-subtle truncate">
              {allFiles.length === 0
                ? '0 of 0 changed files'
                : `${stagedFiles.length} of ${allFiles.length} changed files`}
            </span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Expand / Collapse All (Tree view only) */}
            {viewMode === 'tree' && allFiles.length > 0 && (
              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="p-1 rounded-sm text-text-muted hover:text-text hover:bg-base-2/80 transition-colors cursor-pointer"
                title={areFoldersExpanded ? 'Collapse all folders' : 'Expand all folders'}
              >
                {areFoldersExpanded ? (
                  <FoldVertical className="w-3.5 h-3.5" />
                ) : (
                  <UnfoldVertical className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Toggle View Mode: Tree vs List */}
            <button
              type="button"
              onClick={handleToggleViewMode}
              className={`p-1 rounded-sm transition-colors cursor-pointer ${
                viewMode === 'tree'
                  ? 'text-commito-coral hover:text-commito-coral/90 hover:bg-base-2/80'
                  : 'text-text-muted hover:text-text hover:bg-base-2/80'
              }`}
              title={viewMode === 'tree' ? 'Tree View (Click for List View)' : 'List View (Click for Tree View)'}
            >
              {viewMode === 'tree' ? (
                <FolderTree className="w-3.5 h-3.5" />
              ) : (
                <List className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Bulk actions menu */}
            {allFiles.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY });
                }}
                className="p-1 rounded-sm text-text-muted hover:text-text hover:bg-base-2/80 transition-colors cursor-pointer"
                title="Bulk actions (right-click options)"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* File Items Tree/List */}
      <ChangeFileList
        filter={fileFilter}
        viewMode={viewMode}
        expandAllTrigger={expandAllTrigger}
        collapseAllTrigger={collapseAllTrigger}
      />

      {/* Bulk-action context menu */}
      {contextMenu && (
        <ChangesHeaderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

