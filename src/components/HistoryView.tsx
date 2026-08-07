import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileText, Copy, Check, GitCommit } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { CommitInfo } from '../types/git';
import { UserAvatar } from './UserAvatar';

interface CommitDetails {
  commit: CommitInfo;
  changed_files: string[];
}

export const HistoryView: React.FC = () => {
  const { activeRepoPath, selectedCommitSha, setSelectedCommitSha, user } = useGitStore();
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [selectedCommitFile, setSelectedCommitFile] = useState<string | null>(null);
  const [commitDiffText, setCommitDiffText] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  // Sample commits if no local git repo active
  const sampleCommits: CommitInfo[] = [
    {
      sha: '2488b368a1f73b64c129e9240',
      short_sha: '2488b36',
      author_name: user?.name || 'NeelFrostrain',
      author_email: 'neelfrostrain@github.com',
      message: 'feat(auth): implement GitHub authentication and API interactions',
      timestamp: Date.now() / 1000 - 3600,
      relative_date: '1 hour ago',
    },
    {
      sha: 'e49d22340b19284cf728e9182',
      short_sha: 'e49d223',
      author_name: user?.name || 'NeelFrostrain',
      author_email: 'neelfrostrain@github.com',
      message: 'style(ui): redesign top titlebar and header controls matching CommitO',
      timestamp: Date.now() / 1000 - 7200,
      relative_date: '2 hours ago',
    },
    {
      sha: 'b069604f283818e38573b98c2',
      short_sha: 'b069604',
      author_name: user?.name || 'NeelFrostrain',
      author_email: 'neelfrostrain@github.com',
      message: 'fix(git): sanitize git remote credentials and enable dynamic basic auth',
      timestamp: Date.now() / 1000 - 14400,
      relative_date: '4 hours ago',
    },
    {
      sha: '7a123f81e39a04764b82194c5',
      short_sha: '7a123f8',
      author_name: 'Jane Dev',
      author_email: 'janedev@gitlab.com',
      message: 'refactor(store): update state management to support multi-account providers',
      timestamp: Date.now() / 1000 - 86400,
      relative_date: 'yesterday',
    },
  ];

  useEffect(() => {
    if (!activeRepoPath) {
      setCommits(sampleCommits);
      if (sampleCommits.length > 0) {
        setSelectedCommitSha(sampleCommits[0].sha);
      }
      return;
    }

    invoke<CommitInfo[]>('get_commit_history', { repoPath: activeRepoPath, limit: 50, offset: 0 })
      .then((res) => {
        if (res && res.length > 0) {
          setCommits(res);
          setSelectedCommitSha(res[0].sha);
        } else {
          setCommits(sampleCommits);
        }
      })
      .catch(() => {
        setCommits(sampleCommits);
      });
  }, [activeRepoPath]);

  // Load commit details when selectedCommitSha changes
  useEffect(() => {
    if (!selectedCommitSha) return;

    if (!activeRepoPath) {
      const activeCommit = sampleCommits.find((c) => c.sha === selectedCommitSha) || sampleCommits[0];
      setDetails({
        commit: activeCommit,
        changed_files: [
          'src-tauri/src/auth/github.rs',
          'src/components/Sidebar.tsx',
          'src/components/Header.tsx',
        ],
      });
      setSelectedCommitFile('src-tauri/src/auth/github.rs');
      return;
    }

    invoke<any>('get_commit_details', { repoPath: activeRepoPath, sha: selectedCommitSha })
      .then((res) => {
        const filesList = res?.changed_files || [];
        setDetails({
          commit: res?.commit || sampleCommits[0],
          changed_files: filesList,
        });
        if (filesList.length > 0) {
          setSelectedCommitFile(filesList[0]);
        }
      })
      .catch(() => {
        setDetails(null);
      });
  }, [selectedCommitSha, activeRepoPath]);

  // Load file diff when selectedCommitFile changes
  useEffect(() => {
    if (!selectedCommitSha || !selectedCommitFile || !activeRepoPath) {
      setCommitDiffText(
        `// Diff view for ${selectedCommitFile || 'file'}\n+ Add new features and component updates\n- Remove legacy styling definitions`
      );
      return;
    }

    invoke<any>('get_commit_file_diff', { repoPath: activeRepoPath, sha: selectedCommitSha, filePath: selectedCommitFile })
      .then((res) => {
        if (res && res.lines) {
          const formatted = res.lines
            .map((l: any) => `${l.origin} ${l.content}`)
            .join('');
          setCommitDiffText(formatted);
        }
      })
      .catch(() => {
        setCommitDiffText(`// Diff preview unavailable for ${selectedCommitFile}`);
      });
  }, [selectedCommitSha, selectedCommitFile, activeRepoPath]);

  const activeCommit = details?.commit || commits.find((c) => c.sha === selectedCommitSha) || commits[0];
  const changedFiles = details?.changed_files || [];

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-base-1 select-none">
      {activeCommit ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header: Commit Meta Info */}
          <div className="p-4 border-b border-border bg-base-2 space-y-2 flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-extrabold text-text-primary leading-tight">
                {activeCommit.message}
              </h2>
              <button
                onClick={() => handleCopySha(activeCommit.sha)}
                className="px-2 py-1 bg-base-3 hover:bg-base-0 border border-border rounded-md text-xs font-mono text-text-secondary flex items-center gap-1.5 transition flex-shrink-0"
                title="Copy full SHA"
              >
                {copiedSha ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-text-muted" />}
                <span>{activeCommit.short_sha}</span>
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs text-text-muted font-sans pt-1">
              <div className="flex items-center gap-1.5">
                <UserAvatar name={activeCommit.author_name} className="w-5 h-5" iconClassName="w-3 h-3" />
                <span className="font-semibold text-text-primary">{activeCommit.author_name}</span>
              </div>
              <span>•</span>
              <span className="font-mono text-text-secondary">{activeCommit.relative_date}</span>
              {changedFiles.length > 0 && (
                <>
                  <span>•</span>
                  <span className="font-medium text-commito-activeText">
                    {changedFiles.length} file{changedFiles.length === 1 ? '' : 's'} changed
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Content Body: Left File List + Right Diff Code */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Changed Files List in Commit */}
            <div className="w-72 border-r border-border bg-base-1 overflow-y-auto p-2 space-y-0.5 flex-shrink-0">
              <div className="px-2 py-1 text-[10px] font-bold text-text-faint uppercase tracking-wider">
                Changed Files ({changedFiles.length})
              </div>

              {changedFiles.map((filePath) => {
                const isSelected = selectedCommitFile === filePath;
                return (
                  <div
                    key={filePath}
                    onClick={() => setSelectedCommitFile(filePath)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-commito-activeBg text-commito-activeText font-semibold border border-commito-activeText/20'
                        : 'hover:bg-base-2 text-text-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <FileText className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                      <span className="truncate font-mono text-[11px]">{filePath}</span>
                    </div>
                    <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-950 text-amber-400 border border-amber-800/40 rounded-md font-bold uppercase">
                      M
                    </span>
                  </div>
                );
              })}
            </div>

              {/* Diff Text Preview */}
              <div className="flex-1 overflow-auto bg-[#141316] p-4 font-mono text-xs text-text-primary leading-relaxed">
                {commitDiffText ? (
                  <pre className="whitespace-pre-wrap">{commitDiffText}</pre>
                ) : (
                  <div className="text-text-muted italic">Select a file to view commit diff</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-2">
            <GitCommit className="w-8 h-8 text-text-faint" />
            <span className="text-sm font-medium">Select a commit to view details</span>
          </div>
        )}
    </div>
  );
};
