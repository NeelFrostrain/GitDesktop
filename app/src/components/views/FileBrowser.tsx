import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  RefreshCw,
  MousePointer,
  Copy,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { GitService } from '../../services/git/gitService';

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  size?: string;
  children?: FileNode[];
}

const SAMPLE_TREE: FileNode[] = [
  { name: '.diversion', path: '.diversion', is_dir: true },
  { name: 'Config', path: 'Config', is_dir: true },
  { name: 'Content', path: 'Content', is_dir: true },
  { name: 'DerivedDataCache', path: 'DerivedDataCache', is_dir: true },
  { name: 'Intermediate', path: 'Intermediate', is_dir: true },
  { name: 'Saved', path: 'Saved', is_dir: true },
  { name: '.dvignore', path: '.dvignore', is_dir: false, size: '2.5 KB' },
  { name: '.loreignore', path: '.loreignore', is_dir: false, size: '335 B' },
  {
    name: 'NicolasN_BunnyMP.uproject',
    path: 'NicolasN_BunnyMP.uproject',
    is_dir: false,
    size: '625 B',
  },
  { name: 'README.md', path: 'README.md', is_dir: false, size: '26 B' },
];

/**
 * File tree explorer for inspecting the working copy file directory and text previews.
 */
export const FileBrowser: React.FC = () => {
  const { activeRepoPath, selectedFile, setSelectedFile } = useGitStore();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '.diversion': false,
    Config: false,
    Content: true,
  });
  const [fileContent, setFileContent] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRepoPath) {
      setFileTree(SAMPLE_TREE);
      return;
    }

    // Fetch file list from git repo
    invoke<Record<string, unknown>[]>('get_repo_files_cmd', { repoPath: activeRepoPath })
      .then((files) => {
        if (files && files.length > 0) {
          const nodes: FileNode[] = files.map((f) => ({
            name: (f.name as string) || (f.path as string).split('/').pop() || '',
            path: f.path as string,
            is_dir: Boolean(f.is_dir),
            size: (f.size as string) || (f.is_dir ? undefined : '1.2 KB'),
          }));
          setFileTree(nodes);
        } else {
          setFileTree(SAMPLE_TREE);
        }
      })
      .catch(() => {
        setFileTree(SAMPLE_TREE);
      });
  }, [activeRepoPath]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  const handleSelectFile = (file: FileNode) => {
    if (file.is_dir) {
      toggleFolder(file.path);
    } else {
      setSelectedFile(file.path);
      if (activeRepoPath) {
        GitService.getFileContent(activeRepoPath, file.path)
          .then((text) => setFileContent(text))
          .catch(() => setFileContent('// Binary or unreadable preview file'));
      }
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-base-1 select-none">
      {/* Left Column: File Tree */}
      <div className="w-80 border-r border-border flex flex-col h-full bg-base-1">
        {/* Working copy header bar */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <span>Working copy</span>
            <span>•</span>
            <span className="text-text-secondary font-medium">current branch</span>
          </div>
          <button
            onClick={() => {}}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded transition cursor-pointer"
            title="Refresh working copy"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto space-y-0.5 font-sans text-xs">
          {fileTree.map((node) => {
            const isExpanded = expandedFolders[node.path];
            const isSelected = selectedFile === node.path;

            return (
              <div
                key={node.path}
                onClick={() => handleSelectFile(node)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-sm cursor-pointer transition ${
                  isSelected
                    ? 'bg-commito-activeBg text-commito-activeText font-semibold'
                    : 'text-text-primary hover:bg-base-2'
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  {node.is_dir ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFolder(node.path);
                        }}
                        className="text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                        )}
                      </button>
                      <Folder className="w-4 h-4 text-text-muted flex-shrink-0" />
                    </>
                  ) : (
                    <>
                      <span className="w-4" />
                      <FileText className="w-4 h-4 text-text-muted flex-shrink-0" />
                    </>
                  )}
                  <span className="truncate font-mono text-[12px]">{node.name}</span>
                </div>

                {!node.is_dir && node.size && (
                  <span className="text-[11px] font-mono text-text-faint flex-shrink-0 ml-2">
                    {node.size}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: File Preview Panel */}
      <div className="flex-1 flex flex-col h-full bg-base-1 items-center justify-center relative">
        {selectedFile ? (
          <div className="w-full h-full flex flex-col">
            <div className="h-10 border-b border-border bg-base-2 px-4 flex items-center justify-between flex-shrink-0">
              <span className="font-mono text-xs text-text-primary font-medium truncate">
                {selectedFile}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(selectedFile)}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-3 rounded transition cursor-pointer"
                title="Copy Path"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto font-mono text-xs text-text-primary bg-base-1 leading-relaxed">
              {fileContent ? (
                <pre>{fileContent}</pre>
              ) : (
                <div className="text-text-muted italic">
                  File contents loading or preview not available...
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-text-muted space-y-3">
            <div className="p-4 bg-base-2 border border-border rounded-full shadow-inner">
              <MousePointer className="w-6 h-6 text-text-faint" />
            </div>
            <span className="text-sm font-medium text-text-muted">Select a file to preview</span>
          </div>
        )}
      </div>
    </div>
  );
};
