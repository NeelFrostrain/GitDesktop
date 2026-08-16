import React, { useState } from 'react';
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
      <span className="w-4 h-4 rounded-xs bg-git-added/15 text-git-added text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-git-added/25">
        +
      </span>
    );
  }
  if (statusUpper.includes('DELETE') || statusUpper.includes('REMOVE')) {
    return (
      <span className="w-4 h-4 rounded-xs bg-git-removed/15 text-git-removed text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-git-removed/25">
        -
      </span>
    );
  }
  if (statusUpper.includes('RENAME')) {
    return (
      <span className="w-4 h-4 rounded-xs bg-git-renamed/15 text-git-renamed text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-git-renamed/25">
        R
      </span>
    );
  }
  return (
    <span className="w-4 h-4 rounded-xs bg-git-modified/15 text-git-modified text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-git-modified/25">
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
      <div className="p-6 text-center text-xs text-text-muted italic">
        No changed files found
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-0.5">
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
              className={`flex items-center gap-2 px-2.5 py-1.5 mx-1.5 rounded-md text-xs cursor-pointer transition ${
                isSelected
                  ? 'bg-commito-activeBg text-commito-activeText font-semibold border border-commito-activeText/20'
                  : 'hover:bg-base-2 text-text-secondary'
              }`}
            >
              <Checkbox checked={isStaged} onChange={() => toggleStageFile(file.path)} />
              {getStatusBadge(file.status)}
              <span className="truncate flex-1 font-mono text-[11px]">{file.path}</span>
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
