import React, { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { 
  FileText, 
  Binary, 
  HardDrive, 
  GitPullRequest, 
  ExternalLink, 
  Columns, 
  AlignJustify,
  CheckCircle,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  FileCode,
  Copy,
  Check,
  Image as ImageIcon,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useSigningStore } from '../store/signingStore';
import { DiffResult, CommitDetails, DiffLine } from '../types/git';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif', 'icns']);

function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

const CopyButton: React.FC<{ text: string; label?: string; className?: string }> = ({ text, label, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border bg-base-1 hover:bg-base-3 text-text-muted hover:text-text-primary transition ${className}`}
      title={copied ? 'Copied to clipboard!' : `Copy ${label || text}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-gitlab-teal" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>{label || 'Copy'}</span>
        </>
      )}
    </button>
  );
};

const HIGHLIGHT_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'export', 'import', 'from', 'default',
  'type', 'interface', 'async', 'await', 'if', 'else', 'for', 'while', 'switch', 'case',
  'break', 'try', 'catch', 'pub', 'fn', 'struct', 'enum', 'impl', 'use', 'mod', 'mut',
  'ref', 'match', 'self', 'Self', 'true', 'false', 'null', 'undefined', 'None', 'Some',
  'Ok', 'Err', 'new', 'delete', 'void', 'typeof', 'instanceof', 'as'
]);

function highlightCodeLine(text: string): React.ReactNode {
  if (!text) return text;

  const commentIdx = text.indexOf('//');
  if (commentIdx !== -1) {
    const codePart = text.substring(0, commentIdx);
    const commentPart = text.substring(commentIdx);
    return (
      <>
        {highlightCodeLine(codePart)}
        <span className="text-gray-500 italic">{commentPart}</span>
      </>
    );
  }

  const regex = /(".*?"|'.*?'|`.*?`|\b\d+\b|\b[a-zA-Z_]\w*\b|[^\s\w]+|\s+)/g;
  const matches = text.match(regex);

  if (!matches) return text;

  return matches.map((token, i) => {
    if ((token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'")) ||
        (token.startsWith('`') && token.endsWith('`'))) {
      return <span key={i} className="text-amber-300">{token}</span>;
    }

    if (/^\d+$/.test(token)) {
      return <span key={i} className="text-orange-300">{token}</span>;
    }

    if (HIGHLIGHT_KEYWORDS.has(token)) {
      return <span key={i} className="text-pink-400 font-medium">{token}</span>;
    }

    if (/^[A-Z][a-zA-Z0-9_]*$/.test(token)) {
      return <span key={i} className="text-cyan-300 font-medium">{token}</span>;
    }

    return <span key={i}>{token}</span>;
  });
}

interface SplitRow {
  type: 'header' | 'code';
  headerText?: string;
  oldNum?: number;
  oldContent?: string;
  newNum?: number;
  newContent?: string;
}

function isVerbosePatchHeader(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith('diff --git') ||
    trimmed.startsWith('new file mode') ||
    trimmed.startsWith('deleted file mode') ||
    trimmed.startsWith('index ') ||
    trimmed.startsWith('--- ') ||
    trimmed.startsWith('+++ ')
  );
}

function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.line_type === 'header') {
      if (!isVerbosePatchHeader(line.content)) {
        rows.push({ type: 'header', headerText: line.content });
      }
      i++;
      continue;
    }

    if (line.line_type === 'context') {
      rows.push({
        type: 'code',
        oldNum: line.old_line_num ?? undefined,
        oldContent: line.content,
        newNum: line.new_line_num ?? undefined,
        newContent: line.content,
      });
      i++;
      continue;
    }

    const delChunk: DiffLine[] = [];
    const addChunk: DiffLine[] = [];

    while (i < lines.length && lines[i].line_type === 'deletion') {
      delChunk.push(lines[i]);
      i++;
    }
    while (i < lines.length && lines[i].line_type === 'addition') {
      addChunk.push(lines[i]);
      i++;
    }

    const delCount = delChunk.length;
    const addCount = addChunk.length;

    if (delCount === addCount) {
      for (let j = 0; j < delCount; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].old_line_num ?? undefined,
          oldContent: delChunk[j].content,
          newNum: addChunk[j].new_line_num ?? undefined,
          newContent: addChunk[j].content,
        });
      }
    } else if (delCount > addCount) {
      const unalignedDels = delCount - addCount;
      for (let j = 0; j < unalignedDels; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].old_line_num ?? undefined,
          oldContent: delChunk[j].content,
          newNum: undefined,
          newContent: undefined,
        });
      }
      for (let j = 0; j < addCount; j++) {
        const delIndex = unalignedDels + j;
        rows.push({
          type: 'code',
          oldNum: delChunk[delIndex].old_line_num ?? undefined,
          oldContent: delChunk[delIndex].content,
          newNum: addChunk[j].new_line_num ?? undefined,
          newContent: addChunk[j].content,
        });
      }
    } else {
      for (let j = 0; j < delCount; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].old_line_num ?? undefined,
          oldContent: delChunk[j].content,
          newNum: addChunk[j].new_line_num ?? undefined,
          newContent: addChunk[j].content,
        });
      }
      for (let j = delCount; j < addCount; j++) {
        rows.push({
          type: 'code',
          oldNum: undefined,
          oldContent: undefined,
          newNum: addChunk[j].new_line_num ?? undefined,
          newContent: addChunk[j].content,
        });
      }
    }
  }

  return rows;
}

export const DiffViewer: React.FC = () => {
  const {
    activeRepoPath,
    selectedFile,
    selectedCommitSha,
    activeTab,
    diffViewMode,
    setDiffViewMode,
    status,
    user,
    setError,
  } = useGitStore();

  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCommitBody, setShowCommitBody] = useState(false);

  // Expanded file diffs in History tab
  const [expandedHistoryFiles, setExpandedHistoryFiles] = useState<Record<string, DiffResult>>({});
  const [loadingHistoryFiles, setLoadingHistoryFiles] = useState<Record<string, boolean>>({});
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({});

  // Image Zoom & Scale State for Preview
  const [imageZoom] = useState<number | 'fit'>('fit');
  const [pixelatedMode] = useState(true);

  // Derive isStaged OUTSIDE the effect so it becomes a stable, reactive dependency.
  // If we derive it inside the effect, React can't track it as a dep and may use a stale value
  // when the same file transitions between staged/unstaged.
  const isStaged = React.useMemo(() => {
    if (!selectedFile || !status) return false;
    const fileInStatus = status.files.find((f) => f.path === selectedFile);
    return fileInStatus ? fileInStatus.staged : false;
  }, [selectedFile, status]);

  // Fetch diff when selected file or its staged state changes in Changes tab
  useEffect(() => {
    if (!activeRepoPath || !selectedFile || activeTab !== 'changes') {
      setDiff(null);
      return;
    }

    setIsLoading(true);

    invoke<DiffResult>('get_file_diff', {
      repoPath: activeRepoPath,
      filePath: selectedFile,
      staged: isStaged,
    })
      .then(setDiff)
      .catch((err) => setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) }))
      .finally(() => setIsLoading(false));
  }, [activeRepoPath, selectedFile, activeTab, isStaged]);

  // Fetch commit details when selected commit changes in History tab
  useEffect(() => {
    if (!activeRepoPath || !selectedCommitSha || activeTab !== 'history') {
      setCommitDetails(null);
      setExpandedHistoryFiles({});
      setOpenFiles({});
      return;
    }

    setIsLoading(true);
    invoke<CommitDetails>('get_commit_details', {
      repoPath: activeRepoPath,
      sha: selectedCommitSha,
    })
      .then((details) => {
        setCommitDetails(details);
        // Expand first file by default for convenience
        if (details.changed_files.length > 0) {
          const firstFile = details.changed_files[0];
          setOpenFiles({ [firstFile]: true });
          fetchCommitFileDiff(selectedCommitSha, firstFile);
        }
      })
      .catch((err) => setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) }))
      .finally(() => setIsLoading(false));
  }, [activeRepoPath, selectedCommitSha, activeTab]);

  const fetchCommitFileDiff = async (sha: string, filePath: string) => {
    if (!activeRepoPath || expandedHistoryFiles[filePath]) return;
    setLoadingHistoryFiles((prev) => ({ ...prev, [filePath]: true }));
    try {
      const res = await invoke<DiffResult>('get_commit_file_diff', {
        repoPath: activeRepoPath,
        sha,
        filePath,
      });
      setExpandedHistoryFiles((prev) => ({ ...prev, [filePath]: res }));
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    } finally {
      setLoadingHistoryFiles((prev) => ({ ...prev, [filePath]: false }));
    }
  };

  const toggleFileExpansion = (filePath: string) => {
    const nextState = !openFiles[filePath];
    setOpenFiles((prev) => ({ ...prev, [filePath]: nextState }));
    if (nextState && selectedCommitSha && !expandedHistoryFiles[filePath]) {
      fetchCommitFileDiff(selectedCommitSha, filePath);
    }
  };

  const repoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || activeRepoPath
    : '';

  const handleOpenMergeRequest = async () => {
    if (!user || !status?.current_branch) return;
    const url = `${user.server_url}/${repoName}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${status.current_branch}`;
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleViewPipelines = async () => {
    if (!user) return;
    const url = `${user.server_url}/${repoName}/-/pipelines`;
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  const isCurrentBranchPushed = (status?.ahead || 0) === 0;

  const renderDiffContent = (lines: DiffLine[]) => {
    if (diffViewMode === 'split') {
      const splitRows = buildSplitRows(lines);
      return (
        <div className="w-full font-mono text-[12px] leading-6 select-text">
          {splitRows.map((row, idx) => {
            if (row.type === 'header') {
              return (
                <div key={idx} className="bg-base-2 text-gitlab-blue font-semibold px-4 py-0.5 border-y border-border/50 text-[11px] font-mono">
                  {row.headerText}
                </div>
              );
            }

            const isOldEmpty = row.oldContent === undefined;
            const isNewEmpty = row.newContent === undefined;
            const isDel = !isOldEmpty && isNewEmpty;
            const isAdd = isOldEmpty && !isNewEmpty;
            const isModified = !isOldEmpty && !isNewEmpty && row.oldContent !== row.newContent;

            return (
              <div key={idx} className="flex w-full border-b border-border/20 leading-6 text-[12px] font-mono">
                {/* Left Side (Old) */}
                <div
                  className={`w-1/2 min-w-0 flex border-r border-border/40 ${
                    isDel
                      ? 'bg-red-950/40 text-red-300'
                      : isModified
                      ? 'bg-red-950/30 text-red-300'
                      : isOldEmpty
                      ? 'bg-base-1/20'
                      : 'bg-base-0 text-text-primary'
                  }`}
                >
                  <div className="w-12 px-2 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 flex-shrink-0 min-h-[24px]">
                    {row.oldNum ?? ''}
                  </div>
                  <div className="w-5 px-1 py-0.5 text-center select-none font-bold text-red-400 flex-shrink-0">
                    {!isOldEmpty && (isDel || isModified) ? '-' : ''}
                  </div>
                  <div className="flex-1 min-w-0 px-2 py-0.5 whitespace-pre-wrap break-all min-h-[24px]">
                    {row.oldContent !== undefined ? highlightCodeLine(row.oldContent) : '\u00A0'}
                  </div>
                </div>

                {/* Right Side (New) */}
                <div
                  className={`w-1/2 min-w-0 flex ${
                    isAdd
                      ? 'bg-green-950/40 text-green-300'
                      : isModified
                      ? 'bg-green-950/30 text-green-300'
                      : isNewEmpty
                      ? 'bg-base-1/20'
                      : 'bg-base-0 text-text-primary'
                  }`}
                >
                  <div className="w-12 px-2 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 flex-shrink-0 min-h-[24px]">
                    {row.newNum ?? ''}
                  </div>
                  <div className="w-5 px-1 py-0.5 text-center select-none font-bold text-green-400 flex-shrink-0">
                    {!isNewEmpty && (isAdd || isModified) ? '+' : ''}
                  </div>
                  <div className="flex-1 min-w-0 px-2 py-0.5 whitespace-pre-wrap break-all min-h-[24px]">
                    {row.newContent !== undefined ? highlightCodeLine(row.newContent) : '\u00A0'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Unified View
    const filteredLines = lines.filter((l) => !(l.line_type === 'header' && isVerbosePatchHeader(l.content)) && !l.content.trim().startsWith('\\ No newline at end of file'));


    return (
      <div className="w-full font-mono text-[12px] leading-6 select-text">
        {filteredLines.map((line, idx) => {
          let lineBg = 'hover:bg-base-3/30';
          let textColor = 'text-text-primary';
          let prefix = ' ';

          if (line.line_type === 'addition') {
            lineBg = 'bg-green-950/40 text-green-300';
            textColor = 'text-green-300';
            prefix = '+';
          } else if (line.line_type === 'deletion') {
            lineBg = 'bg-red-950/40 text-red-300';
            textColor = 'text-red-300';
            prefix = '-';
          } else if (line.line_type === 'header') {
            lineBg = 'bg-base-2 text-gitlab-blue font-semibold text-[11px] py-0.5';
          }

          return (
            <div key={idx} className={`flex w-full border-b border-border/20 ${lineBg}`}>
              <div className="w-12 px-2 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 flex-shrink-0">
                {line.old_line_num ?? ''}
              </div>
              <div className="w-12 px-2 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 flex-shrink-0">
                {line.new_line_num ?? ''}
              </div>
              <div className="w-6 px-1 py-0.5 text-center select-none font-bold flex-shrink-0">
                {prefix}
              </div>
              <div className={`flex-1 min-w-0 px-2 py-0.5 whitespace-pre-wrap break-all ${textColor}`}>
                {line.line_type === 'header' ? line.content : highlightCodeLine(line.content)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Diff for Changes Tab
  const renderChangesDiff = () => {
    if (!selectedFile) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-text-muted text-sm space-y-2">
          <FileText className="w-10 h-10 opacity-30 text-commito-coral" />
          <span className="font-medium text-text-muted">Select a changed file to view its line-by-line diff.</span>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center text-text-muted text-sm">
          Loading file diff...
        </div>
      );
    }

    if (!diff) return null;

    if (diff.is_large_file) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6">
          <HardDrive className="w-12 h-12 text-amber-400 mb-3" />
          <h3 className="text-base font-semibold text-text-primary mb-1">
            Large File Warning
          </h3>
          <p className="text-xs text-text-muted max-w-md">
            File <span className="font-mono text-text-primary">{selectedFile}</span> exceeds the maximum diff preview limit.
          </p>
        </div>
      );
    }

    if (diff.is_binary || isImageFile(selectedFile)) {
      const isImg = isImageFile(selectedFile);

      if (isImg) {
        const fullPath = activeRepoPath ? `${activeRepoPath}/${selectedFile}`.replace(/\\/g, '/') : '';
        const fileUrl = fullPath ? convertFileSrc(fullPath) : '';

        const getZoomStyle = () => {
          if (imageZoom === 'fit') {
            return {
              minWidth: '280px',
              minHeight: '280px',
              maxWidth: '85%',
              maxHeight: '70vh',
              objectFit: 'contain' as const,
            };
          }
          return {
            width: `${imageZoom * 100}%`,
            maxWidth: 'none',
          };
        };

        return (
          <div className="h-full flex flex-col bg-base-0">
            <div className="h-10 bg-base-1 border-b border-border px-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon className="w-4 h-4 text-commito-coral flex-shrink-0" />
                <span className="font-mono text-xs text-text-primary font-medium truncate">
                  {selectedFile}
                </span>
                <CopyButton text={selectedFile} />
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#141316]">
              <img
                src={fileUrl}
                alt={selectedFile}
                className="transition-all duration-150 drop-shadow-2xl"
                style={{
                  ...getZoomStyle(),
                  imageRendering: pixelatedMode ? 'pixelated' : 'auto',
                }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>
        );
      }

      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#141316]">
          <Binary className="w-12 h-12 text-commito-coral mb-3" />
          <h3 className="text-base font-semibold text-text-primary mb-1">
            Binary File Detected
          </h3>
          <p className="text-xs text-text-muted max-w-md mb-2">
            Binary files cannot be rendered as text diffs.
          </p>
          <span className="text-xs font-mono text-emerald-400 px-2.5 py-1 bg-base-1 border border-border rounded-md">
            File Size: {(diff.file_size_bytes / 1024).toFixed(1)} KB
          </span>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        <div className="h-10 bg-base-1 border-b border-border px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-xs text-text-primary font-medium truncate">
              {selectedFile}
            </span>
            {selectedFile && (selectedFile.endsWith('.uasset') || selectedFile.endsWith('.png') || selectedFile.endsWith('.jpg') || selectedFile.endsWith('.exe')) && (
              <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-400 border border-amber-400/40 rounded-md text-[9px] font-mono font-bold">
                LFS
              </span>
            )}
            <CopyButton text={selectedFile} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-base-2 border border-border rounded-md p-0.5">
              <button
                onClick={() => setDiffViewMode('unified')}
                className={`p-1 rounded-md text-xs flex items-center gap-1 ${
                  diffViewMode === 'unified'
                    ? 'bg-commito-coral text-white font-semibold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Unified View"
              >
                <AlignJustify className="w-3.5 h-3.5" />
                Unified
              </button>
              <button
                onClick={() => setDiffViewMode('split')}
                className={`p-1 rounded-md text-xs flex items-center gap-1 ${
                  diffViewMode === 'split'
                    ? 'bg-commito-coral text-white font-semibold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Split View"
              >
                <Columns className="w-3.5 h-3.5" />
                Split
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#141316]">
          {diff.lines.length === 0 ? (
            <div className="p-6 text-text-muted text-center font-mono text-xs">No textual line changes detected.</div>
          ) : (
            renderDiffContent(diff.lines)
          )}
        </div>
      </div>
    );
  };

  // Render Commit Details for History Tab
  const renderHistoryDetails = () => {
    if (!selectedCommitSha) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-text-muted text-sm">
          <Clock className="w-12 h-12 mb-3 opacity-30 text-gitlab-orange" />
          Select a commit from history to view metadata and changed files.
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center text-text-muted text-sm">
          Loading commit details...
        </div>
      );
    }

    if (!commitDetails) return null;

    const fullMessage = commitDetails.commit.message || '';
    const firstNewlineIndex = fullMessage.indexOf('\n');
    const commitTitle = firstNewlineIndex !== -1 ? fullMessage.substring(0, firstNewlineIndex).trim() : fullMessage;
    const commitBody = firstNewlineIndex !== -1 ? fullMessage.substring(firstNewlineIndex + 1).trim() : '';

    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Compact Commit Header Card */}
        <div className="p-3 bg-base-2 border-b border-border space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold text-text-primary truncate" title={commitTitle}>
              {commitTitle}
            </h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 bg-base-1 border border-border rounded-md p-0.5">
                <button
                  onClick={() => setDiffViewMode('unified')}
                  className={`px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 ${
                    diffViewMode === 'unified'
                      ? 'bg-commito-coral text-white font-medium'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  title="Unified View"
                >
                  <AlignJustify className="w-3 h-3" />
                  Unified
                </button>
                <button
                  onClick={() => setDiffViewMode('split')}
                  className={`px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 ${
                    diffViewMode === 'split'
                      ? 'bg-commito-coral text-white font-medium'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  title="Split View"
                >
                  <Columns className="w-3 h-3" />
                  Split
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {(() => {
                  const verification = useSigningStore.getState().verifiedCommits[commitDetails.commit.sha];
                  if (verification && verification.status === 'Verified') {
                    const signer = typeof verification.details === 'object' ? verification.details.signer : '';
                    return (
                      <span
                        title={`Cryptographically verified commit (Signed by ${signer || 'GPG/SSH'})`}
                        className="flex items-center gap-1 text-emerald-400 font-mono text-[11px] bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md font-medium"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verified</span>
                      </span>
                    );
                  }
                  if (verification && verification.status === 'Unverified') {
                    return (
                      <span
                        title="Unverified commit signature"
                        className="flex items-center gap-1 text-amber-400 font-mono text-[11px] bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-md font-medium"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Unverified</span>
                      </span>
                    );
                  }
                  return null;
                })()}
                <span className="font-mono text-[11px] px-2 py-0.5 bg-base-1 border border-border rounded-md text-commito-coral font-medium">
                  {commitDetails.commit.short_sha}
                </span>
                <CopyButton text={commitDetails.commit.sha} label="SHA" />
                <CopyButton text={commitDetails.commit.message} label="Msg" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-commito-coral" />
                <span className="font-medium text-text-primary">{commitDetails.commit.author_name}</span>
                <span className="text-text-faint">({commitDetails.commit.author_email})</span>
              </div>
              <div className="flex items-center gap-1 text-text-faint">
                <Clock className="w-3 h-3" />
                <span>{commitDetails.commit.relative_date}</span>
              </div>
            </div>

            {commitBody && (
              <button
                onClick={() => setShowCommitBody(!showCommitBody)}
                className="text-[11px] text-commito-coral hover:underline font-medium"
              >
                {showCommitBody ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>

          {commitBody && showCommitBody && (
            <div className="p-2 bg-base-0 border border-border rounded-md text-[11px] text-text-muted max-h-28 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
              {commitBody}
            </div>
          )}
        </div>

        {/* Changed Files with Accordion Diffs */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-base-0">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Changed Files ({commitDetails.changed_files.length})
          </div>

          <div className="space-y-2">
            {commitDetails.changed_files.map((file) => {
              const isOpen = Boolean(openFiles[file]);
              const fileDiff = expandedHistoryFiles[file];
              const isFileLoading = Boolean(loadingHistoryFiles[file]);

              return (
                <div
                  key={file}
                  className="border border-border rounded-md overflow-hidden bg-base-1 shadow-sm"
                >
                  {/* File Accordion Header */}
                  <button
                    onClick={() => toggleFileExpansion(file)}
                    className="w-full px-3.5 py-2.5 text-xs font-mono text-text-primary hover:bg-base-2 flex items-center justify-between text-left transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gitlab-orange flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                      )}
                      <FileCode className="w-3.5 h-3.5 text-gitlab-blue flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CopyButton text={file} />
                      {isFileLoading && (
                        <span className="text-[11px] text-text-muted animate-pulse">Loading diff...</span>
                      )}
                    </div>
                  </button>

                  {/* Expanded File Diff Body */}
                  {isOpen && (
                    <div className="border-t border-border bg-base-0">
                      {isFileLoading ? (
                        <div className="p-4 text-xs text-text-muted font-mono text-center">
                          Fetching file changes...
                        </div>
                      ) : fileDiff ? (
                        isImageFile(file) ? (
                          <div className="p-4 flex flex-col items-center justify-center bg-[#0d1117]">
                            <div
                              className="rounded overflow-hidden flex items-center justify-center p-3 border border-border/50 max-w-full"
                              style={{
                                backgroundImage: `radial-gradient(#30363d 1px, transparent 0)`,
                                backgroundSize: '12px 12px',
                                backgroundColor: '#010409',
                              }}
                            >
                              <img
                                src={convertFileSrc(`${activeRepoPath}/${file}`.replace(/\\/g, '/'))}
                                alt={file}
                                className="max-h-64 max-w-full object-contain rounded shadow"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            </div>
                            <span className="mt-2 text-[11px] font-mono text-text-muted">Image Preview ({file.split('.').pop()?.toUpperCase()})</span>
                          </div>
                        ) : fileDiff.lines.length > 0 ? (
                          renderDiffContent(fileDiff.lines)
                        ) : (
                          <div className="p-4 text-xs text-text-muted font-mono text-center">
                            No textual changes to display.
                          </div>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-github-dark-bg overflow-hidden">
      {/* Action Banner */}
      <div className="h-10 bg-github-dark-sidebar border-b border-github-dark-border px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-github-dark-success" />
          <span className="text-github-dark-heading font-medium">Branch status:</span>
          <span className="text-gray-400">
            {isCurrentBranchPushed ? 'Up to date with origin' : `${status?.ahead || 0} commits ahead`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenMergeRequest}
            disabled={!user || !isCurrentBranchPushed}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              user && isCurrentBranchPushed
                ? 'bg-orange-950/80 text-orange-400 border border-orange-800/50 hover:bg-orange-900/80'
                : 'bg-github-dark-header text-gray-500 border border-github-dark-border cursor-not-allowed'
            }`}
            title={!isCurrentBranchPushed ? 'Push branch to origin before creating Merge Request' : ''}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            Create Merge Request
          </button>

          <button
            onClick={handleViewPipelines}
            disabled={!user}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              user
                ? 'bg-github-dark-header text-github-dark-heading border border-github-dark-border hover:bg-github-dark-hover'
                : 'bg-github-dark-header text-gray-500 border border-github-dark-border cursor-not-allowed'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Pipelines
          </button>
        </div>
      </div>

      {/* Main Diff / Details Display */}
      <div className="flex-1 min-h-0">
        {activeTab === 'changes' ? renderChangesDiff() : renderHistoryDetails()}
      </div>
    </main>
  );
};
