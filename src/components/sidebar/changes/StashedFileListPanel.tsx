import React, { useState } from 'react';
import {
  Search,
  X,
  FileText,
  PlusSquare,
  MinusSquare,
  FileEdit,
  ArrowLeft,
  Layers,
} from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';

export const StashedFileListPanel: React.FC = () => {
  const [fileFilter, setFileFilter] = useState('');
  const {
    stashFiles,
    selectedStashFile,
    setSelectedStashFile,
    setIsViewingStashedChanges,
  } = useGitStore();

  const filteredFiles = (stashFiles || []).filter((f) =>
    f.path.toLowerCase().includes(fileFilter.toLowerCase().trim())
  );

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Untracked':
      case 'Added':
        return (
          <span className="text-git-added shrink-0" title="Added file">
            <PlusSquare className="w-3.5 h-3.5" />
          </span>
        );
      case 'Deleted':
        return (
          <span className="text-git-removed shrink-0" title="Deleted file">
            <MinusSquare className="w-3.5 h-3.5" />
          </span>
        );
      case 'Modified':
      default:
        return (
          <span className="text-git-modified shrink-0" title="Modified file">
            <FileEdit className="w-3.5 h-3.5" />
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-base-0 select-none">
      {/* Top Search Toolbar */}
      <div className="px-2.5 pt-2 pb-1.5 border-b border-border/40 bg-base-0 flex flex-col gap-1.5 flex-shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder="Filter stashed files..."
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-base-1/80 hover:bg-base-1 focus:bg-base-1 border border-border/60 hover:border-border-strong/70 focus:border-commito-coral/70 rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-commito-coral/20 font-sans transition-all duration-150"
          />
          {fileFilter && (
            <button
              type="button"
              onClick={() => setFileFilter('')}
              className="absolute right-2 p-0.5 text-text-muted hover:text-text-primary rounded-sm transition-colors cursor-pointer"
              title="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Stash Header Info Bar */}
        <div className="flex items-center justify-between px-1 py-0.5 rounded-sm text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <Layers className="w-3.5 h-3.5 text-commito-coral shrink-0" />
            <span className="text-[11.5px] font-semibold text-text-primary truncate">
              {`${filteredFiles.length} stashed file${filteredFiles.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsViewingStashedChanges(false)}
            className="text-[11px] font-medium text-text-muted hover:text-commito-coral flex items-center gap-1 px-1.5 py-0.5 rounded-xs hover:bg-base-2 transition cursor-pointer"
            title="Return to Working Tree Changes"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Changes</span>
          </button>
        </div>
      </div>

      {/* Stashed Files List */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredFiles.length === 0 ? (
          <div className="p-4 text-center text-xs text-text-muted">
            {fileFilter ? 'No matching stashed files' : 'No files in stash'}
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isSelected = selectedStashFile === file.path;
            const fileName = file.path.split(/[\\/]/).pop() || file.path;
            const dirPath = file.path.includes('/') || file.path.includes('\\')
              ? file.path.substring(0, Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\')))
              : '';

            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedStashFile(file.path)}
                className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 border-l-2 text-xs transition cursor-pointer ${
                  isSelected
                    ? 'bg-base-2 border-commito-coral text-text-primary font-semibold shadow-2xs'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:bg-base-1/70'
                }`}
                title={file.path}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                  <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-commito-coral' : 'text-text-muted'}`} />
                  <div className="min-w-0 truncate">
                    <span className="truncate block font-mono text-[11.5px] leading-tight">
                      {fileName}
                    </span>
                    {dirPath && (
                      <span className="truncate block text-[10px] text-text-muted/70 font-mono leading-tight">
                        {dirPath}
                      </span>
                    )}
                  </div>
                </div>

                {renderStatusBadge(file.status)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
