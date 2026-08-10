import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { Checkbox } from '../../Checkbox';
import { ChangeFileList } from './ChangeFileList';

export const ChangesPanel: React.FC = () => {
  const [fileFilter, setFileFilter] = useState('');
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
            className="w-full pl-7 pr-2 py-1 bg-base-1 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
          />
        </div>

        {/* Selection Count Checkbox Row */}
        <div className="flex items-center justify-between text-xs text-text-muted px-1.5 py-0.5">
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
    </div>
  );
};
