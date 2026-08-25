import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { Checkbox } from '../../common/Checkbox';
import { FileContextMenu } from '../../context-menus/FileContextMenu';

interface ChangeFileListProps {
  filter: string;
}

/**
 * Renders a visual git status badge character (+, -, R, M) corresponding to the modification state.
 */
const getStatusBadge = (statusStr?: string) => {
  const statusUpper = (statusStr || '').toUpperCase();
  if (statusUpper.includes('NEW') || statusUpper.includes('ADD') || statusUpper.includes('UNTRACKED')) {
    return (
      <span className="w-4 h-4 rounded-sm bg-git-added/15 text-git-added text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-git-added/25">
        +
      </span>
    );
  }
  if (statusUpper.includes('DELETE') || statusUpper.includes('REMOVE')) {
    return (
      <span className="w-4 h-4 rounded-sm bg-git-removed/15 text-git-removed text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-git-removed/25">
        -
      </span>
    );
  }
  if (statusUpper.includes('RENAME')) {
    return (
      <span className="w-4 h-4 rounded-sm bg-git-renamed/15 text-git-renamed text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-git-renamed/25">
        R
      </span>
    );
  }
  return (
    <span className="w-4 h-4 rounded-sm bg-git-modified/15 text-git-modified text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-git-modified/25">
      M
    </span>
  );
};

/**
 * List of modified, staged, and untracked files in the working directory with filter and context menu support.
 */
export const ChangeFileList: React.FC<ChangeFileListProps> = ({ filter }) => {
  const { status, selectedFile, setSelectedFile, stagedFiles, toggleStageFile } = useGitStore();
  const [fileContextMenu, setFileContextMenu] = useState<{
    filePath: string;
    x: number;
    y: number;
  } | null>(null);

  const allFiles = status?.files || [];
  const uniqueFilesMap = new Map<string, (typeof allFiles)[0]>();
  allFiles.forEach((file) => {
    if (!uniqueFilesMap.has(file.path)) {
      uniqueFilesMap.set(file.path, file);
    }
  });
  const uniqueFiles = Array.from(uniqueFilesMap.values());

  const filteredFiles = uniqueFiles.filter((file) =>
    file.path.toLowerCase().includes(filter.toLowerCase())
  );

  if (filteredFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-150 text-text-faint">
        <div className="w-8 h-8 rounded-sm bg-base-1 border border-border/60 flex items-center justify-center mb-2 shadow-xs">
          <Check className="w-4 h-4 text-git-added/80 stroke-[2.5]" />
        </div>
        <p className="text-xs font-medium text-text-muted">
          {filter ? `No files matching "${filter}"` : 'No uncommitted changes'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-base-3">
        {filteredFiles.map((file) => {
          const isStaged = stagedFiles.includes(file.path);
          const isSelected = selectedFile === file.path;

          return (
            <div
              key={file.path}
              onClick={() => setSelectedFile(file.path)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedFile(file.path);
                setFileContextMenu({ filePath: file.path, x: e.clientX, y: e.clientY });
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs cursor-pointer transition-all duration-100 ${
                isSelected
                  ? 'bg-base-2 text-text font-medium border border-border-strong/70 shadow-xs'
                  : 'hover:bg-base-2/60 text-text-subtle border border-transparent'
              }`}
            >
              <Checkbox checked={isStaged} onChange={() => toggleStageFile(file.path)} />
              {getStatusBadge(file.status)}
              <span className="truncate flex-1 font-mono text-[11px] text-text">{file.path}</span>
            </div>
          );
        })}
      </div>

      {fileContextMenu && (
        <FileContextMenu
          filePath={fileContextMenu.filePath}
          x={fileContextMenu.x}
          y={fileContextMenu.y}
          onClose={() => setFileContextMenu(null)}
        />
      )}
    </>
  );
};
