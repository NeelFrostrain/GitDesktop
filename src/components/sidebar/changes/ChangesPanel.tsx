import React, { useState } from 'react';
import { Search } from 'lucide-react';
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
      <div className="px-2.5 py-1.5 border-b border-border bg-base-0 space-y-1.5 flex-shrink-0">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2 top-1.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter changed files..."
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="w-full pl-7 pr-2 py-1 bg-base-1 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
          />
        </div>

        {/* Selection Count Checkbox Row — right-click for bulk actions */}
        <div
          className="flex items-center justify-between text-xs text-text-muted px-1.5 py-0.5 rounded cursor-default"
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <Checkbox
            checked={isAllStaged}
            indeterminate={stagedFiles.length > 0 && !isAllStaged}
            onChange={() => setAllStaged(!isAllStaged)}
            label={`${stagedFiles.length} of ${allFiles.length} changed files`}
          />
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
