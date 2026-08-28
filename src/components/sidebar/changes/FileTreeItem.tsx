import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  PlusSquare,
  MinusSquare,
  FileEdit,
  RotateCcw,
} from 'lucide-react';
import { FileStatus } from '../../../types/git';
import { useGitStore } from '../../../store/useGitStore';
import { Checkbox } from '../../common/Checkbox';

export interface TreeItem {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  file?: FileStatus;
  children: TreeItem[];
  allFilePaths: string[];
  depth: number;
}

/**
 * Builds a hierarchical tree structure from a flat array of changed files.
 */
export const buildFileTree = (files: FileStatus[]): TreeItem[] => {
  const rootItems: TreeItem[] = [];

  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = normalizedPath.split('/');
    let currentLevel = rootItems;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        // Leaf file node
        currentLevel.push({
          id: `file:${currentPath}`,
          name: part,
          path: file.path,
          isFolder: false,
          file,
          children: [],
          allFilePaths: [file.path],
          depth: i,
        });
      } else {
        // Folder node
        let folderNode = currentLevel.find((item) => item.isFolder && item.name === part);
        if (!folderNode) {
          folderNode = {
            id: `folder:${currentPath}`,
            name: part,
            path: currentPath,
            isFolder: true,
            children: [],
            allFilePaths: [],
            depth: i,
          };
          currentLevel.push(folderNode);
        }
        folderNode.allFilePaths.push(file.path);
        currentLevel = folderNode.children;
      }
    }
  }

  // Sort: folders first (alphabetical), then files (alphabetical)
  const sortNodes = (nodes: TreeItem[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(rootItems);
  return rootItems;
};

/**
 * Returns a Git status icon badge (+, -, M, R).
 */
export const getStatusBadge = (statusStr?: string) => {
  const statusUpper = (statusStr || '').toUpperCase();
  if (statusUpper.includes('NEW') || statusUpper.includes('ADD') || statusUpper.includes('UNTRACKED')) {
    return (
      <span className="text-git-added shrink-0" title="Added file">
        <PlusSquare className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (statusUpper.includes('DELETE') || statusUpper.includes('REMOVE')) {
    return (
      <span className="text-git-removed shrink-0" title="Deleted file">
        <MinusSquare className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (statusUpper.includes('RENAME')) {
    return (
      <span className="text-git-renamed shrink-0" title="Renamed file">
        <RotateCcw className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    <span className="text-git-modified shrink-0" title="Modified file">
      <FileEdit className="w-3.5 h-3.5" />
    </span>
  );
};

interface FileTreeNodeProps {
  node: TreeItem;
  expandedFolders: Record<string, boolean>;
  onToggleFolder: (path: string) => void;
  onOpenFolderContext: (folderPath: string, childFiles: string[], x: number, y: number) => void;
  onOpenFileContext: (filePath: string, x: number, y: number) => void;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  expandedFolders,
  onToggleFolder,
  onOpenFolderContext,
  onOpenFileContext,
}) => {
  const { selectedFile, setSelectedFile, stagedFiles, toggleStageFile, toggleStageFiles } = useGitStore();

  if (node.isFolder) {
    const isExpanded = expandedFolders[node.path] ?? true;
    const stagedCount = node.allFilePaths.filter((p) => stagedFiles.includes(p)).length;
    const isAllStaged = node.allFilePaths.length > 0 && stagedCount === node.allFilePaths.length;
    const isIndeterminate = stagedCount > 0 && !isAllStaged;

    return (
      <div className="flex flex-col select-none min-w-0">
        {/* Folder Row */}
        <div
          onClick={() => onToggleFolder(node.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenFolderContext(node.path, node.allFilePaths, e.clientX, e.clientY);
          }}
          style={{ paddingLeft: `${node.depth * 12 + 4}px` }}
          className="group/folder flex items-center gap-1.5 py-1 pr-2 rounded-sm text-xs cursor-pointer hover:bg-base-2/60 text-text-subtle transition-colors duration-100 min-w-0"
        >
          {/* Chevron expander button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFolder(node.path);
            }}
            className="p-0.5 text-text-muted hover:text-text rounded transition-colors cursor-pointer shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>

          {/* Folder Staging Checkbox */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center shrink-0"
          >
            <Checkbox
              checked={isAllStaged}
              indeterminate={isIndeterminate}
              onChange={() => toggleStageFiles(node.allFilePaths, !isAllStaged)}
            />
          </div>

          {/* Folder Icon */}
          <div className="shrink-0 flex items-center text-amber-400/90">
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5" />
            ) : (
              <Folder className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Folder Name */}
          <span className="truncate flex-1 font-sans font-medium text-[11.5px] text-text-primary" title={node.path}>
            {node.name}
          </span>

          {/* Changed files count badge */}
          <span className="ml-auto font-mono text-[10px] text-text-faint group-hover/folder:text-text-muted transition-colors px-1 py-0.2 rounded bg-base-1/50 border border-border/30 shrink-0">
            {node.allFilePaths.length}
          </span>
        </div>

        {/* Children (if expanded) */}
        {isExpanded && (
          <div className="flex flex-col border-l border-border/25 ml-[11px] min-w-0">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.id}
                node={child}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onOpenFolderContext={onOpenFolderContext}
                onOpenFileContext={onOpenFileContext}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File Row
  const file = node.file!;
  const isStaged = stagedFiles.includes(file.path);
  const isSelected = selectedFile === file.path;

  return (
    <div
      onClick={() => setSelectedFile(file.path)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedFile(file.path);
        onOpenFileContext(file.path, e.clientX, e.clientY);
      }}
      style={{ paddingLeft: `${node.depth * 12 + 6}px` }}
      className={`group/file flex items-center justify-between gap-2 py-1.5 pr-2.5 border-l-[3px] text-xs cursor-pointer transition-all duration-100 min-w-0 ${
        isSelected
          ? 'bg-base-2 border-commito-coral text-text-primary font-semibold shadow-2xs'
          : 'border-transparent text-text-muted hover:text-text-primary hover:bg-base-1/70'
      }`}
      title={file.path}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
        {/* File Checkbox */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center shrink-0"
        >
          <Checkbox
            checked={isStaged}
            onChange={() => toggleStageFile(file.path)}
          />
        </div>

        {/* File Icon */}
        {/* <FileText
          className={`w-3.5 h-3.5 shrink-0 ${
            isSelected ? 'text-commito-coral' : 'text-text-muted'
          }`}
        /> */}

        {/* File Base Name */}
        <span className="truncate block font-mono text-[11.5px] leading-tight">
          {node.name}
        </span>
      </div>

      {/* Status Badge */}
      {getStatusBadge(file.status)}
    </div>
  );
};
