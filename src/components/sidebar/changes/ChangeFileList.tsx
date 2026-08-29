import React, { useState, useEffect, useMemo } from "react";
import { Check } from "lucide-react";
import { useGitStore } from "../../../store/useGitStore";
import { Checkbox } from "../../common/Checkbox";
import { FileContextMenu } from "../../context-menus/FileContextMenu";
import { FolderContextMenu } from "../../context-menus/FolderContextMenu";
import { ChangesEmptySpaceContextMenu } from "../../context-menus/ChangesEmptySpaceContextMenu";
import { CreateItemModal } from "../../modals/CreateItemModal";
import { SystemService } from "../../../services/system/systemService";
import {
  buildFileTree,
  FileTreeNode,
  getStatusBadge,
  getFileIcon,
  TreeItem,
} from "./FileTreeItem";

export type ChangesViewMode = "tree" | "list";

interface ChangeFileListProps {
  filter: string;
  viewMode?: ChangesViewMode;
  expandAllTrigger?: number;
  collapseAllTrigger?: number;
}

/**
 * List or Tree of modified, staged, and untracked files in the working directory with filter,
 * hierarchical folder expansion, item context menus, and empty-space context menu actions.
 */
export const ChangeFileList: React.FC<ChangeFileListProps> = ({
  filter,
  viewMode = "tree",
  expandAllTrigger = 0,
  collapseAllTrigger = 0,
}) => {
  const {
    activeRepoPath,
    status,
    selectedFile,
    setSelectedFile,
    stagedFiles,
    toggleStageFile,
  } = useGitStore();

  const [fileContextMenu, setFileContextMenu] = useState<{
    filePath: string;
    x: number;
    y: number;
  } | null>(null);

  const [folderContextMenu, setFolderContextMenu] = useState<{
    folderPath: string;
    childFiles: string[];
    x: number;
    y: number;
  } | null>(null);

  const [emptySpaceContextMenu, setEmptySpaceContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [createModal, setCreateModal] = useState<"file" | "folder" | null>(
    null,
  );

  // Expanded folders record for tree mode
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});

  // Keyboard shortcut: Shift+Alt+R to Reveal in File Explorer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        if (activeRepoPath) {
          SystemService.showInExplorer(activeRepoPath).catch(console.error);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeRepoPath]);

  // Unique list of all changed files
  const allFiles = status?.files || [];
  const uniqueFiles = useMemo(() => {
    const map = new Map<string, (typeof allFiles)[0]>();
    allFiles.forEach((file) => {
      if (!map.has(file.path)) {
        map.set(file.path, file);
      }
    });
    return Array.from(map.values());
  }, [allFiles]);

  // Filtered files according to search filter
  const filteredFiles = useMemo(() => {
    if (!filter) return uniqueFiles;
    const lowerFilter = filter.toLowerCase();
    return uniqueFiles.filter((file) =>
      file.path.toLowerCase().includes(lowerFilter),
    );
  }, [uniqueFiles, filter]);

  // Build tree structure
  const fileTree = useMemo(() => {
    return buildFileTree(filteredFiles);
  }, [filteredFiles]);

  // Collect all folder paths in current tree
  const allFolderPaths = useMemo(() => {
    const paths: string[] = [];
    const collect = (nodes: TreeItem[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          paths.push(node.path);
          collect(node.children);
        }
      }
    };
    collect(fileTree);
    return paths;
  }, [fileTree]);

  // Expand all when triggered
  useEffect(() => {
    if (expandAllTrigger > 0) {
      const next: Record<string, boolean> = {};
      allFolderPaths.forEach((p) => {
        next[p] = true;
      });
      setExpandedFolders(next);
    }
  }, [expandAllTrigger, allFolderPaths]);

  // Collapse all when triggered
  useEffect(() => {
    if (collapseAllTrigger > 0) {
      const next: Record<string, boolean> = {};
      allFolderPaths.forEach((p) => {
        next[p] = false;
      });
      setExpandedFolders(next);
    }
  }, [collapseAllTrigger, allFolderPaths]);

  // When filtering, automatically expand all folders containing matching files
  useEffect(() => {
    if (filter) {
      const next: Record<string, boolean> = {};
      allFolderPaths.forEach((p) => {
        next[p] = true;
      });
      setExpandedFolders((prev) => ({ ...prev, ...next }));
    }
  }, [filter, allFolderPaths]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const current = prev[folderPath] ?? true;
      return { ...prev, [folderPath]: !current };
    });
  };

  if (filteredFiles.length === 0) {
    return (
      <>
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            setEmptySpaceContextMenu({ x: e.clientX, y: e.clientY });
          }}
          className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-150 text-text-faint cursor-default"
        >
          <div className="w-8 h-8 rounded-sm bg-base-1 border border-border/60 flex items-center justify-center mb-2 shadow-xs">
            <Check className="w-4 h-4 text-git-added/80 stroke-[2.5]" />
          </div>
          <p className="text-xs font-medium text-text-muted">
            {filter
              ? `No files matching "${filter}"`
              : "No uncommitted changes"}
          </p>
        </div>

        {emptySpaceContextMenu && (
          <ChangesEmptySpaceContextMenu
            x={emptySpaceContextMenu.x}
            y={emptySpaceContextMenu.y}
            onClose={() => setEmptySpaceContextMenu(null)}
            onNewFile={() => setCreateModal("file")}
            onNewFolder={() => setCreateModal("folder")}
          />
        )}

        <CreateItemModal
          isOpen={Boolean(createModal)}
          itemType={createModal || "file"}
          onClose={() => setCreateModal(null)}
        />
      </>
    );
  }

  return (
    <>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setEmptySpaceContextMenu({ x: e.clientX, y: e.clientY });
        }}
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-0.5 scrollbar-thin scrollbar-thumb-base-3 min-w-0"
      >
        {viewMode === "tree" ? (
          /* Tree View */
          <div className="flex flex-col space-y-0.5 font-sans min-w-0">
            {fileTree.map((node) => (
              <FileTreeNode
                key={node.id}
                node={node}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onOpenFolderContext={(folderPath, childFiles, x, y) => {
                  setFolderContextMenu({ folderPath, childFiles, x, y });
                }}
                onOpenFileContext={(filePath, x, y) => {
                  setFileContextMenu({ filePath, x, y });
                }}
              />
            ))}
          </div>
        ) : (
          /* Flat List View */
          <div className="flex flex-col font-sans min-w-0">
            {filteredFiles.map((file) => {
              const isStaged = stagedFiles.includes(file.path);
              const isSelected = selectedFile === file.path;
              const fileName = file.path.split(/[\\/]/).pop() || file.path;
              const dirPath =
                file.path.includes("/") || file.path.includes("\\")
                  ? file.path.substring(
                      0,
                      Math.max(
                        file.path.lastIndexOf("/"),
                        file.path.lastIndexOf("\\"),
                      ),
                    )
                  : "";

              return (
                <div
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedFile(file.path);
                    setFileContextMenu({
                      filePath: file.path,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 border-l-2 text-xs transition cursor-pointer select-none ${
                    isSelected
                      ? "bg-base-2 border-l-commito-coral text-text-primary font-semibold shadow-2xs"
                      : "border-l-transparent text-text-muted hover:text-text-primary hover:bg-base-1/70"
                  }`}
                  title={file.path}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                    {/* Staging Checkbox */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 flex items-center"
                    >
                      <Checkbox
                        checked={isStaged}
                        onChange={() => toggleStageFile(file.path)}
                      />
                    </div>

                    {/* Dynamic File Type Icon */}
                    {getFileIcon(fileName)}

                    {/* File Name & Folder Subtitle */}
                    <div className="min-w-0 truncate">
                      <span className="truncate block font-mono text-[11px] leading-tight text-text-primary">
                        {fileName}
                      </span>
                      {dirPath && (
                        <span className="truncate block text-[9.5px] text-text-muted/70 font-mono leading-tight">
                          {dirPath}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  {getStatusBadge(file.status)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {fileContextMenu && (
        <FileContextMenu
          filePath={fileContextMenu.filePath}
          x={fileContextMenu.x}
          y={fileContextMenu.y}
          onClose={() => setFileContextMenu(null)}
        />
      )}

      {folderContextMenu && (
        <FolderContextMenu
          folderPath={folderContextMenu.folderPath}
          childFiles={folderContextMenu.childFiles}
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          onClose={() => setFolderContextMenu(null)}
        />
      )}

      {emptySpaceContextMenu && (
        <ChangesEmptySpaceContextMenu
          x={emptySpaceContextMenu.x}
          y={emptySpaceContextMenu.y}
          onClose={() => setEmptySpaceContextMenu(null)}
          onNewFile={() => setCreateModal("file")}
          onNewFolder={() => setCreateModal("folder")}
        />
      )}

      <CreateItemModal
        isOpen={Boolean(createModal)}
        itemType={createModal || "file"}
        onClose={() => setCreateModal(null)}
      />
    </>
  );
};
