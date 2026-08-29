import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Folder,
  FolderOpen,
  FileCode,
  ChevronRight,
  ChevronDown,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { GitService } from '../../../services/git/gitService';
import { CommitDetails, CommitFileStat } from '../../../types/git';

interface CommitDetailsInspectorProps {
  repoPath: string;
  commitSha: string;
  onSelectSha?: (sha: string) => void;
  onClose: () => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  additions: number;
  deletions: number;
  status: string;
  children: TreeNode[];
}

function buildFileTree(files: CommitFileStat[]): TreeNode[] {
  interface TempNode {
    name: string;
    path: string;
    isFolder: boolean;
    additions: number;
    deletions: number;
    status: string;
    children: Map<string, TempNode>;
  }

  const rootChildren = new Map<string, TempNode>();

  files.forEach((file) => {
    const parts = file.path.split(/[/\\]/);
    let currentMap = rootChildren;
    let accumulatedPath = '';

    parts.forEach((part, idx) => {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isFile = idx === parts.length - 1;

      if (!currentMap.has(part)) {
        currentMap.set(part, {
          name: part,
          path: accumulatedPath,
          isFolder: !isFile,
          additions: isFile ? file.additions : 0,
          deletions: isFile ? file.deletions : 0,
          status: isFile ? file.status : '',
          children: new Map(),
        });
      }

      const node = currentMap.get(part)!;
      if (!isFile) {
        node.additions += file.additions;
        node.deletions += file.deletions;
      }
      currentMap = node.children;
    });
  });

  function convert(map: Map<string, TempNode>): TreeNode[] {
    return Array.from(map.values())
      .sort((a, b) => {
        if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
        return a.isFolder ? -1 : 1;
      })
      .map((n) => ({
        name: n.name,
        path: n.path,
        isFolder: n.isFolder,
        additions: n.additions,
        deletions: n.deletions,
        status: n.status,
        children: convert(n.children),
      }));
  }

  return convert(rootChildren);
}

const TreeItem: React.FC<{ node: TreeNode; depth?: number }> = ({ node, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (node.isFolder) {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className="flex items-center gap-1.5 py-0.5 hover:bg-base-2/60 rounded-xs cursor-pointer text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-gitlab-teal shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-gitlab-teal shrink-0" />
          )}
          <span className="font-mono text-[11.5px] truncate font-medium">{node.name}</span>
        </div>

        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeItem key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{ paddingLeft: `${depth * 14 + 18}px` }}
      className="flex items-center justify-between gap-2 py-0.5 pr-2 hover:bg-base-2/60 rounded-xs cursor-pointer text-xs text-text-primary transition-colors group"
      title={node.path}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <FileCode className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span className="font-mono text-[11.5px] truncate">{node.name}</span>
      </div>

      <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
        <span className="text-git-added font-semibold">+{node.additions}</span>
        <span className="text-text-faint">|</span>
        <span className="text-git-removed font-semibold">-{node.deletions}</span>
      </div>
    </div>
  );
};

export const CommitDetailsInspector: React.FC<CommitDetailsInspectorProps> = ({
  repoPath,
  commitSha,
  onSelectSha,
  onClose,
}) => {
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    GitService.getCommitDetails(repoPath, commitSha)
      .then((res) => {
        if (!isCancelled) {
          setDetails(res);
        }
      })
      .catch(() => {
        if (!isCancelled) setDetails(null);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [repoPath, commitSha]);

  const treeNodes = useMemo(() => {
    return details?.file_stats ? buildFileTree(details.file_stats) : [];
  }, [details]);

  const handleCopySha = () => {
    navigator.clipboard.writeText(commitSha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 1500);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-xs text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin text-commito-coral" />
        <span>Loading commit details...</span>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-text-muted italic">
        Failed to load commit details.
      </div>
    );
  }

  const { commit, file_stats, total_additions, total_deletions } = details;
  const parents = commit.parent_shas || [];

  // Format exact date
  const exactDate = commit.timestamp
    ? new Date(commit.timestamp * 1000).toUTCString()
    : '—';

  return (
    <div className="h-full flex flex-col bg-base-1 select-none font-sans text-xs overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-3 py-1.5 bg-base-0 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-text-primary truncate text-xs">
            {commit.message.split('\n')[0]}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] text-text-muted font-mono">
          <span>{commit.relative_date}</span>
          <span>•</span>
          <span className="font-sans">{commit.author_name}</span>
          <span>•</span>
          <span className="text-commito-coral font-bold">{commit.short_sha}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-base-2 text-text-muted hover:text-text-primary rounded-xs transition cursor-pointer"
            title="Close details"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split Inspector Body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border min-h-0 overflow-hidden">
        {/* Left Column: Metadata & Message Body */}
        <div className="p-3.5 overflow-y-auto space-y-3 font-mono text-[11.5px] scrollbar-thin">
          {/* Metadata Block */}
          <div className="space-y-1 text-text-secondary leading-relaxed bg-base-0/60 border border-border/40 rounded-xs p-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-muted w-20 shrink-0">Commit:</span>
              <span className="text-text-primary select-text break-all">{commit.sha}</span>
              <button
                type="button"
                onClick={handleCopySha}
                className="p-0.5 hover:text-text-primary text-text-muted cursor-pointer shrink-0 transition"
                title="Copy full SHA"
              >
                {copiedSha ? <Check className="w-3 h-3 text-git-added" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {parents.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-text-muted w-20 shrink-0">
                  {parents.length > 1 ? 'Parents:' : 'Parent:'}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {parents.map((pSha) => (
                    <button
                      key={pSha}
                      type="button"
                      onClick={() => onSelectSha?.(pSha)}
                      className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer flex items-center gap-0.5"
                      title="Jump to parent commit"
                    >
                      <span>{pSha}</span>
                      <ExternalLink className="w-2.5 h-2.5 inline" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="font-bold text-text-muted w-20 shrink-0">Author:</span>
              <span className="text-text-primary select-text">
                {commit.author_name} {commit.author_email && `<${commit.author_email}>`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-text-muted w-20 shrink-0">Date:</span>
              <span className="text-text-primary select-text">{exactDate}</span>
            </div>
          </div>

          {/* Full Message Body */}
          <div className="bg-base-0/40 border border-border/30 rounded-xs p-2.5 text-text-primary whitespace-pre-wrap leading-relaxed select-text font-sans text-xs">
            {commit.message}
          </div>
        </div>

        {/* Right Column: Hierarchical Changed Files Tree */}
        <div className="flex flex-col min-h-0 overflow-hidden bg-base-0/30">
          {/* Header */}
          <div className="px-3 py-1.5 bg-base-1/80 border-b border-border/50 flex items-center justify-between text-[11px] text-text-muted font-bold uppercase tracking-wider shrink-0 select-none">
            <span>Changed Files ({(file_stats || []).length})</span>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="text-git-added font-semibold">+{total_additions}</span>
              <span className="text-text-faint">|</span>
              <span className="text-git-removed font-semibold">-{total_deletions}</span>
            </div>
          </div>

          {/* Tree Scroll View */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
            {treeNodes.map((node) => (
              <TreeItem key={node.path} node={node} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
