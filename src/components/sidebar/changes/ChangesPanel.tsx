import React, { useState } from 'react';
import { Search, X, MoreHorizontal } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { Checkbox } from '../../common/Checkbox';
import { ChangeFileList } from './ChangeFileList';
import { ChangesHeaderContextMenu } from '../../context-menus/ChangesHeaderContextMenu';

export const ChangesPanel: React.FC = () => {
  const [fileFilter, setFileFilter] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { status, stagedFiles, setAllStaged } = useGitStore();

  const allFiles = status?.files || [];
  const isAllStaged = allFiles.length > 0 && stagedFiles.length === allFiles.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
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

        {/* Selection Count Checkbox Row */}
        <div
          className="flex items-center justify-between px-1 py-0.5 rounded-sm text-xs select-none"
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

      {/* File Items List */}
      <ChangeFileList filter={fileFilter} />

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
