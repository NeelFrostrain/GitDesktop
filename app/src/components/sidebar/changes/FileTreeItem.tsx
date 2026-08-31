import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode2,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileImage,
  File,
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
 * Returns a file icon based on file extension.
 */
export const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'rs':
    case 'go':
    case 'py':
    case 'c':
    case 'cpp':
    case 'java':
      return <FileCode2 className="w-3.5 h-3.5 text-commito-coral shrink-0 opacity-85" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0 opacity-85" />;
    case 'css':
    case 'scss':
    case 'less':
      return <FileCode2 className="w-3.5 h-3.5 text-sky-400 shrink-0 opacity-85" />;
    case 'md':
    case 'txt':
    case 'doc':
      return <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'webp':
      return <FileImage className="w-3.5 h-3.5 text-purple-400 shrink-0 opacity-85" />;
    case 'csv':
    case 'xlsx':
      return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0 opacity-85" />;
    default:
      return <File className="w-3.5 h-3.5 text-text-muted shrink-0" />;
  }
};

/**
 * Builds a hierarchical tree structure from a flat array of changed files with Compact Folders compression.
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

  // Compress single-child folder chains (Compact Folders)
  const compressNodes = (nodes: TreeItem[], depth = 0): TreeItem[] => {
    return nodes.map((node) => {
      if (!node.isFolder) {
        return { ...node, depth };
      }

      let current = node;
      const pathParts = [current.name];

      // Merge single-child nested folders
      while (current.children.length === 1 && current.children[0].isFolder) {
        current = current.children[0];
        pathParts.push(current.name);
      }

      return {
        ...current,
        id: node.id,
        name: pathParts.join('/'),
        depth,
        children: compressNodes(current.children, depth + 1),
      };
    });
  };

  return compressNodes(rootItems, 0);
};

/**
 * Returns a sleek Git status indicator badge (M, A, D, R, U).
 */
export const getStatusBadge = (statusStr?: string) => {
  const statusUpper = (statusStr || '').toUpperCase();
  if (
    statusUpper.includes('NEW') ||
    statusUpper.includes('ADD') ||
    statusUpper.includes('UNTRACKED')
  ) {
    return (
      <span
        className="px-1 py-0.2 rounded-xs font-mono font-bold text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0"
        title="Added / Untracked"
      >
        A
      </span>
    );
  }
  if (statusUpper.includes('DELETE') || statusUpper.includes('REMOVE')) {
    return (
      <span
        className="px-1 py-0.2 rounded-xs font-mono font-bold text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/25 shrink-0"
        title="Deleted"
      >
        D
      </span>
    );
  }
  if (statusUpper.includes('RENAME')) {
    return (
      <span
        className="px-1 py-0.2 rounded-xs font-mono font-bold text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/25 shrink-0"
        title="Renamed"
      >
        R
      </span>
    );
  }
  return (
    <span
      className="px-1 py-0.2 rounded-xs font-mono font-bold text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0"
      title="Modified"
    >
      M
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

export const FileTreeNode: React.FC<FileTreeNodeProps> = React.memo(
  ({ node, expandedFolders, onToggleFolder, onOpenFolderContext, onOpenFileContext }) => {
    const selectedFile = useGitStore((s) => s.selectedFile);
    const setSelectedFile = useGitStore((s) => s.setSelectedFile);
    const stagedFiles = useGitStore((s) => s.stagedFiles);
    const toggleStageFile = useGitStore((s) => s.toggleStageFile);
    const toggleStageFiles = useGitStore((s) => s.toggleStageFiles);

    if (node.isFolder) {
      const isExpanded = expandedFolders[node.path] ?? true;
      const stagedCount = node.allFilePaths.filter((p) => stagedFiles.includes(p)).length;
      const isAllStaged = node.allFilePaths.length > 0 && stagedCount === node.allFilePaths.length;
      const isIndeterminate = stagedCount > 0 && !isAllStaged;

      const parts = node.name.split('/');

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
            style={{ paddingLeft: `${node.depth * 14 + 4}px` }}
            className="group/folder flex items-center gap-1.5 h-6.5 pr-2 rounded-xs text-xs cursor-pointer hover:bg-base-2/60 text-text-subtle transition-colors duration-75 min-w-0"
          >
            {/* Chevron expander button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFolder(node.path);
              }}
              className="w-4 h-4 flex items-center justify-center text-text-muted/60 hover:text-text-primary rounded-xs transition-colors cursor-pointer shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-text-muted" />
              ) : (
                <ChevronRight className="w-3 h-3 text-text-muted" />
              )}
            </button>

            {/* Folder Staging Checkbox */}
            <div onClick={(e) => e.stopPropagation()} className="flex items-center shrink-0">
              <Checkbox
                checked={isAllStaged}
                indeterminate={isIndeterminate}
                onChange={() => toggleStageFiles(node.allFilePaths, !isAllStaged)}
              />
            </div>

            {/* Folder Icon */}
            <div className="shrink-0 flex items-center text-amber-400/80">
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5" />
              ) : (
                <Folder className="w-3.5 h-3.5" />
              )}
            </div>

            {/* Folder Name with Clean Segment Styling */}
            <div className="truncate flex-1 font-sans text-[11px] text-text-secondary group-hover/folder:text-text-primary flex items-center gap-0.5">
              {parts.map((p, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-text-faint/50 font-mono text-[10px]">/</span>}
                  <span
                    className={
                      idx === parts.length - 1 ? 'font-medium text-text-primary' : 'text-text-muted'
                    }
                  >
                    {p}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* Changed files count badge */}
            <span className="font-mono text-[9.5px] text-text-muted/60 group-hover/folder:text-text-muted px-1.5 py-0.2 rounded-xs bg-base-1/80 border border-border/40 shrink-0">
              {node.allFilePaths.length}
            </span>
          </div>

          {/* Children (if expanded) with subtle tree line */}
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
        style={{ paddingLeft: `${node.depth * 14 + 6}px` }}
        className={`group/file flex items-center justify-between gap-1.5 h-6.5 pr-2 rounded-xs border-l-2 text-xs cursor-pointer transition-all duration-75 min-w-0 select-none ${
          isSelected
            ? 'bg-base-2 border-l-commito-coral text-text-primary font-medium shadow-2xs'
            : 'border-l-transparent text-text-muted hover:text-text-primary hover:bg-base-1/70'
        }`}
        title={file.path}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
          {/* File Checkbox */}
          <div onClick={(e) => e.stopPropagation()} className="flex items-center shrink-0">
            <Checkbox checked={isStaged} onChange={() => toggleStageFile(file.path)} />
          </div>

          {/* Dynamic File Type Icon */}
          {/* {getFileIcon(node.name)} */}

          {/* File Name */}
          <span className="truncate block font-mono text-[11px] leading-tight text-text-primary">
            {node.name}
          </span>
        </div>

        {/* Status Badge (M, A, D, R) */}
        {getStatusBadge(file.status)}
      </div>
    );
  }
);

FileTreeNode.displayName = 'FileTreeNode';
