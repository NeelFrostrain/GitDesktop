import React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { CopyButton } from './diffUtils';
import { Image as ImageIcon } from 'lucide-react';

interface ImageDiffViewProps {
  filePath: string;
  repoPath: string;
}

/**
 * Image viewer component for image asset changes with automatic scale-to-fit display.
 */
export const ImageDiffView: React.FC<ImageDiffViewProps> = ({ filePath, repoPath }) => {
  const fullPath = repoPath ? `${repoPath}/${filePath}`.replace(/\\/g, '/') : '';
  const fileUrl = fullPath ? convertFileSrc(fullPath) : '';

  return (
    <div className="h-full flex flex-col bg-base-0">
      <div className="h-10 bg-base-1 border-b border-border px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 truncate">
          <ImageIcon className="w-4 h-4 text-commito-coral flex-shrink-0" />
          <span className="font-mono text-xs text-text-primary font-medium truncate">{filePath}</span>
          <CopyButton text={filePath} />
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#141316]">
        <img
          src={fileUrl}
          alt={filePath}
          className="transition-all duration-150 drop-shadow-2xl max-w-[85%] max-h-[70vh] object-contain min-w-[280px] min-h-[280px]"
          style={{ imageRendering: 'pixelated' }}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    </div>
  );
};
