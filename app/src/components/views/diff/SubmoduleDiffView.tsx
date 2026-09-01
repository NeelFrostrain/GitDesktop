import React from 'react';
import {
  FolderGit2,
  ExternalLink,
  GitCommit,
  ArrowRight,
  FolderOpen,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { SubmoduleDiffInfo, DiffLine } from '../../../types/git';
import { useRepoStore } from '../../../store/repoStore';
import { useGitStore } from '../../../store/useGitStore';
import { useToastStore } from '../../../store/useToastStore';
import { openUrl } from '@tauri-apps/plugin-opener';

interface SubmoduleDiffViewProps {
  filePath: string;
  submoduleInfo?: SubmoduleDiffInfo | null;
  lines?: DiffLine[];
  staged?: boolean;
}

export const SubmoduleDiffView: React.FC<SubmoduleDiffViewProps> = ({
  filePath,
  submoduleInfo,
  lines = [],
  staged = false,
}) => {
  const { activeRepoPath } = useGitStore();
  const { openRepo } = useRepoStore();
  const { showToast } = useToastStore();

  const [copiedOld, setCopiedOld] = React.useState(false);
  const [copiedNew, setCopiedNew] = React.useState(false);

  const subName = submoduleInfo?.name || filePath;
  const subUrl = submoduleInfo?.url;
  const oldCommit = submoduleInfo?.old_commit;
  const newCommit = submoduleInfo?.new_commit;

  const shortOld = oldCommit ? (oldCommit.length >= 7 ? oldCommit.slice(0, 7) : oldCommit) : null;
  const shortNew = newCommit ? (newCommit.length >= 7 ? newCommit.slice(0, 7) : newCommit) : null;

  // Derive repo display name from URL (e.g. CyronicStudio/GitDesktop)
  const repoSlug = React.useMemo(() => {
    if (!subUrl) return subName;
    try {
      const clean = subUrl.replace(/\.git$/, '');
      const parts = clean.split(/[/:]/);
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
      return clean;
    } catch {
      return subUrl;
    }
  }, [subUrl, subName]);

  const submoduleFullPath = React.useMemo(() => {
    if (submoduleInfo?.submodule_full_path) return submoduleInfo.submodule_full_path;
    if (!activeRepoPath) return '';
    const norm = activeRepoPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const cleanFile = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return `${norm}/${cleanFile}`;
  }, [activeRepoPath, filePath, submoduleInfo]);

  const handleOpenSubmodule = async () => {
    if (!submoduleFullPath) {
      showToast({
        type: 'error',
        title: 'Cannot Open Submodule',
        message: 'Could not resolve full path for this submodule.',
      });
      return;
    }

    try {
      await openRepo(submoduleFullPath);
      showToast({
        type: 'success',
        title: 'Switched Repository',
        message: `Opened submodule '${subName}' in Git Desktop.`,
      });
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Open Repository Failed',
        message: String(err),
      });
    }
  };

  const handleOpenRemote = async () => {
    if (!subUrl) return;
    try {
      let httpUrl = subUrl;
      if (httpUrl.startsWith('git@')) {
        httpUrl = httpUrl.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
      }
      await openUrl(httpUrl);
    } catch {
      window.open(subUrl, '_blank');
    }
  };

  const copyToClipboard = (text: string, isOld: boolean) => {
    navigator.clipboard.writeText(text);
    if (isOld) {
      setCopiedOld(true);
      setTimeout(() => setCopiedOld(false), 1500);
    } else {
      setCopiedNew(true);
      setTimeout(() => setCopiedNew(false), 1500);
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-start p-6 md:p-10 select-none bg-base-0 overflow-y-auto animate-in fade-in duration-200">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-git-modified/10 border border-git-modified/25 text-git-modified flex items-center justify-center shadow-xs shrink-0">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Submodule changes
            </h2>
            <p className="text-xs text-text-muted">
              {staged ? 'Staged subproject commit pointer change' : 'Working directory subproject changes'}
            </p>
          </div>
        </div>

        {/* Remote Origin Link Notice */}
        <div className="p-3.5 bg-base-1/80 border border-border rounded-md text-xs text-text-secondary flex items-start gap-2.5 shadow-2xs">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="leading-relaxed">
              This is a submodule based on the repository{' '}
              {subUrl ? (
                <button
                  type="button"
                  onClick={handleOpenRemote}
                  className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 underline underline-offset-2 cursor-pointer"
                >
                  <span>{repoSlug}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              ) : (
                <span className="font-semibold text-text-primary">{subName}</span>
              )}
              .
            </p>
          </div>
        </div>

        {/* Commit Change Comparison Card */}
        <div className="p-4 bg-base-1 border border-border-strong rounded-md space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <GitCommit className="w-4 h-4 text-commito-coral shrink-0" />
            <span>Commit Pointer Update</span>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            This submodule changed its target commit. This change can be committed to the parent
            repository to update the pinned submodule revision.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Old Commit */}
            {oldCommit ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-base-0 border border-border rounded text-xs font-mono text-text-muted">
                <span className="text-[11px] text-text-faint uppercase">Old:</span>
                <span className="font-semibold text-git-removed">{shortOld}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(oldCommit, true)}
                  className="text-text-faint hover:text-text-primary p-0.5 cursor-pointer transition"
                  title="Copy old commit SHA"
                >
                  {copiedOld ? (
                    <Check className="w-3 h-3 text-git-added" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-base-0 border border-border rounded text-xs font-mono text-text-muted">
                <span className="text-[11px] text-text-faint uppercase">Old:</span>
                <span className="italic text-text-faint">None (new submodule)</span>
              </div>
            )}

            <ArrowRight className="w-3.5 h-3.5 text-text-faint shrink-0" />

            {/* New Commit */}
            {newCommit ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-base-0 border border-border-strong rounded text-xs font-mono text-text-primary">
                <span className="text-[11px] text-text-faint uppercase">New:</span>
                <span className="font-semibold text-git-added">{shortNew}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(newCommit, false)}
                  className="text-text-faint hover:text-text-primary p-0.5 cursor-pointer transition"
                  title="Copy new commit SHA"
                >
                  {copiedNew ? (
                    <Check className="w-3 h-3 text-git-added" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-base-0 border border-border rounded text-xs font-mono text-text-muted">
                <span className="text-[11px] text-text-faint uppercase">New:</span>
                <span className="italic text-text-faint">Working tree dirty</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Card: Open in GitDesktop */}
        <div className="p-4 bg-sky-950/20 border border-sky-800/40 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-sky-300">
              Open this submodule in Git Desktop
            </h3>
            <p className="text-xs text-sky-200/70 max-w-md leading-relaxed">
              You can open this submodule in Git Desktop as a normal repository to manage branches,
              view diffs, and commit any changes in it.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenSubmodule}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0 self-stretch sm:self-auto justify-center"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open repository</span>
          </button>
        </div>

        {/* Optional raw git diff lines if any */}
        {lines.length > 0 && (
          <div className="border border-border rounded-md overflow-hidden bg-base-1/50">
            <div className="px-3 py-2 border-b border-border bg-base-1 text-[11px] font-mono text-text-muted flex items-center justify-between">
              <span>Raw Gitlink Change</span>
              <span className="text-[10px] text-text-faint">{filePath}</span>
            </div>
            <div className="p-2 font-mono text-xs space-y-0.5 overflow-x-auto">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={`px-1.5 py-0.5 rounded-2xs ${
                    l.line_type === 'addition'
                      ? 'bg-git-added-bg text-git-added font-semibold'
                      : l.line_type === 'deletion'
                      ? 'bg-git-removed-bg text-git-removed font-semibold'
                      : 'text-text-muted'
                  }`}
                >
                  {l.content}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
