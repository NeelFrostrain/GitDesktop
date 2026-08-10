import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { Checkbox } from '../../Checkbox';
import { FileContextMenu } from '../../FileContextMenu';

interface ChangeFileListProps {
  filter: string;
}

export const ChangeFileList: React.FC<ChangeFileListProps> = ({ filter }) => {
  const { status, selectedFile, setSelectedFile, stagedFiles, toggleStageFile } = useGitStore();
  const [fileContextMenu, setFileContextMenu] = useState<{
    filePath: string;
    x: number;
    y: number;
  } | null>(null);

  const allFiles = status?.files || [];
  const filteredFiles = allFiles.filter((f) =>
    f.path.toLowerCase().includes(filter.toLowerCase())
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
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
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
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition ${
                isSelected
                  ? 'bg-commito-activeBg text-commito-activeText font-semibold border border-commito-activeText/20'
                  : 'hover:bg-base-2 text-text-secondary'
              }`}
            >
              <Checkbox checked={isStaged} onChange={() => toggleStageFile(file.path)} />
              <FileText className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
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
