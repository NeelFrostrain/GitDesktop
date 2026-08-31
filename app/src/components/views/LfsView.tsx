import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  AlertTriangle,
  Download,
  Upload,
  Sparkles,
  Search,
  Copy,
  Check,
  Database,
  Loader2,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useToastStore } from '../../store/useToastStore';
import { useLogStore } from '../../store/useLogStore';
import { LfsFile, LfsLock } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';
import { getFileIcon } from '../sidebar/changes/FileTreeItem';

const PRESET_PATTERNS = [
  { label: 'ML Models', pattern: '*.onnx', desc: 'Neural network weights' },
  { label: 'Binaries', pattern: '*.bin', desc: 'Binary payloads' },
  { label: 'PyTorch', pattern: '*.pt', desc: 'Model checkpoints' },
  { label: 'Archives', pattern: '*.zip', desc: 'Compressed assets' },
  { label: 'Photoshop', pattern: '*.psd', desc: 'Design layers' },
  { label: 'Video', pattern: '*.mp4', desc: 'Media captures' },
  { label: '3D Mesh', pattern: '*.fbx', desc: '3D assets' },
  { label: 'Database', pattern: '*.sqlite', desc: 'Embedded database' },
];

/**
 * Main view for managing Git Large File Storage (LFS) tracking rules, downloads, uploads,
 * and exclusive binary lock acquisition/release.
 */
export const LfsView: React.FC = () => {
  const { activeRepoPath, setError } = useGitStore();
  const { showToast } = useToastStore();

  const [isLfsInstalled, setIsLfsInstalled] = useState<boolean>(true);
  const [lfsFiles, setLfsFiles] = useState<LfsFile[]>([]);
  const [lfsLocks, setLfsLocks] = useState<LfsLock[]>([]);
  const [trackedPatterns, setTrackedPatterns] = useState<string[]>([]);
  const [trackPattern, setTrackPattern] = useState('');
  const [lockFilePath, setLockFilePath] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOperating, setIsOperating] = useState<string | null>(null);
  const [copiedOid, setCopiedOid] = useState<string | null>(null);

  const loadLfsData = useCallback(async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      const [files, locks, patterns] = await Promise.allSettled([
        GitService.listLfsFiles(activeRepoPath),
        GitService.listLfsLocks(activeRepoPath),
        GitService.listLfsTrackedPatterns(activeRepoPath),
      ]);

      if (files.status === 'fulfilled') setLfsFiles(files.value || []);
      if (locks.status === 'fulfilled') setLfsLocks(locks.value || []);
      if (patterns.status === 'fulfilled') setTrackedPatterns(patterns.value || []);
    } catch {
      // Ignore background load errors
    } finally {
      setIsLoading(false);
    }
  }, [activeRepoPath]);

  useEffect(() => {
    if (!activeRepoPath) return;

    GitService.checkLfsInstalled()
      .then((installed) => setIsLfsInstalled(installed))
      .catch(() => setIsLfsInstalled(false));

    loadLfsData();
  }, [activeRepoPath, loadLfsData]);

  const handleInstallLfs = async () => {
    if (!activeRepoPath) return;
    setIsOperating('install');
    try {
      await GitService.installLfs(activeRepoPath);
      useLogStore.getState().addLog('success', 'Git LFS', 'Installed and configured Git LFS hooks');
      showToast({
        type: 'success',
        title: 'Git LFS Initialized',
        message: 'Git LFS hooks successfully configured for this repository.',
      });
      loadLfsData();
    } catch (err: unknown) {
      setError(toAppError(err, 'LFS_ERROR'));
    } finally {
      setIsOperating(null);
    }
  };

  const handleLfsPull = async () => {
    if (!activeRepoPath) return;
    setIsOperating('pull');
    try {
      const output = await GitService.lfsPull(activeRepoPath);
      useLogStore
        .getState()
        .addLog('success', 'Git LFS', `Pulled LFS objects: ${output || 'Complete'}`);
      showToast({
        type: 'success',
        title: 'LFS Objects Pulled',
        message: output
          ? output.slice(0, 100)
          : 'All LFS pointers downloaded to local working tree.',
      });
      loadLfsData();
    } catch (err: unknown) {
      setError(toAppError(err, 'LFS_ERROR'));
    } finally {
      setIsOperating(null);
    }
  };

  const handleLfsPush = async () => {
    if (!activeRepoPath) return;
    setIsOperating('push');
    try {
      const output = await GitService.lfsPush(activeRepoPath);
      useLogStore
        .getState()
        .addLog('success', 'Git LFS', `Pushed LFS objects: ${output || 'Complete'}`);
      showToast({
        type: 'success',
        title: 'LFS Objects Pushed',
        message: output ? output.slice(0, 100) : 'Uploaded LFS objects to remote storage.',
      });
      loadLfsData();
    } catch (err: unknown) {
      setError(toAppError(err, 'LFS_ERROR'));
    } finally {
      setIsOperating(null);
    }
  };

  const handleTrackPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !trackPattern.trim()) return;

    try {
      await GitService.trackLfsPattern(activeRepoPath, trackPattern.trim());
      useLogStore
        .getState()
        .addLog('success', 'Git LFS', `Tracking pattern '${trackPattern.trim()}'`);
      showToast({
        type: 'success',
        title: 'Pattern Tracked',
        message: `Added '${trackPattern.trim()}' to .gitattributes filter=lfs`,
      });
      setTrackPattern('');
      loadLfsData();
    } catch (error: unknown) {
      setError(toAppError(error, 'LFS_ERROR'));
    }
  };

  const handleTrackPreset = async (pattern: string) => {
    if (!activeRepoPath) return;
    try {
      await GitService.trackLfsPattern(activeRepoPath, pattern);
      useLogStore.getState().addLog('success', 'Git LFS', `Tracking pattern '${pattern}'`);
      showToast({
        type: 'success',
        title: 'Pattern Tracked',
        message: `Added '${pattern}' to .gitattributes`,
      });
      loadLfsData();
    } catch (error: unknown) {
      setError(toAppError(error, 'LFS_ERROR'));
    }
  };

  const handleUntrackPattern = async (pattern: string) => {
    if (!activeRepoPath) return;
    try {
      await GitService.untrackLfsPattern(activeRepoPath, pattern);
      useLogStore.getState().addLog('info', 'Git LFS', `Untracked LFS pattern '${pattern}'`);
      showToast({
        type: 'info',
        title: 'Pattern Untracked',
        message: `Removed '${pattern}' from LFS tracking.`,
      });
      loadLfsData();
    } catch (error: unknown) {
      setError(toAppError(error, 'LFS_ERROR'));
    }
  };

  const handleLockFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !lockFilePath.trim()) return;

    try {
      await GitService.lockLfsFile(activeRepoPath, lockFilePath.trim());
      useLogStore
        .getState()
        .addLog('success', 'Git LFS', `Locked LFS file '${lockFilePath.trim()}'`);
      showToast({
        type: 'success',
        title: 'File Locked',
        message: `Acquired exclusive lock for ${lockFilePath.trim()}`,
      });
      setLockFilePath('');
      loadLfsData();
    } catch (error: unknown) {
      setError(toAppError(error, 'LFS_ERROR'));
    }
  };

  const handleUnlockFile = async (path: string, force = false) => {
    if (!activeRepoPath) return;
    try {
      await GitService.unlockLfsFile(activeRepoPath, path, force);
      useLogStore.getState().addLog('info', 'Git LFS', `Unlocked LFS file '${path}'`);
      showToast({
        type: 'info',
        title: 'File Unlocked',
        message: `Released lock for ${path}`,
      });
      loadLfsData();
    } catch (error: unknown) {
      setError(toAppError(error, 'LFS_ERROR'));
    }
  };

  const handleCopyOid = (oid: string) => {
    navigator.clipboard.writeText(oid);
    setCopiedOid(oid);
    setTimeout(() => setCopiedOid(null), 2000);
  };

  const filteredLfsFiles = useMemo(() => {
    if (!fileFilter.trim()) return lfsFiles;
    const lower = fileFilter.toLowerCase();
    return lfsFiles.filter(
      (f) => f.path.toLowerCase().includes(lower) || f.oid.toLowerCase().includes(lower)
    );
  }, [lfsFiles, fileFilter]);

  return (
    <div className="flex-1 h-full bg-base-0 overflow-y-auto p-1.5 md:p-2 select-none space-y-4 scrollbar-thin">
      {/* ── Top Header Banner & Quick Actions ── */}
      <div className="p-4 rounded-xs border border-border bg-base-1/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-commito-coral" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Git Large File Storage (LFS) & Exclusive Locks
            </h2>
          </div>
          <p className="text-[11px] text-text-muted mt-1 leading-normal">
            Manage heavy binary assets, model weights, archives, and exclusive lock states across
            team members.
          </p>
        </div>

        {/* Global Operations Toolbar */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleInstallLfs}
            disabled={isOperating === 'install'}
            className="h-7.5 px-3 rounded-xs bg-base-0 hover:bg-base-2 active:bg-base-3 border border-border text-text-primary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            title="Run 'git lfs install' to configure local hooks"
          >
            {isOperating === 'install' ? (
              <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-commito-coral shrink-0" />
            )}
            <span>Init LFS</span>
          </button>

          <button
            type="button"
            onClick={handleLfsPull}
            disabled={isOperating === 'pull'}
            className="h-7.5 px-3 rounded-xs bg-base-0 hover:bg-base-2 active:bg-base-3 border border-border text-git-added text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            title="Download LFS binaries for current commits"
          >
            {isOperating === 'pull' ? (
              <Loader2 className="w-3.5 h-3.5 text-git-added animate-spin shrink-0" />
            ) : (
              <Download className="w-3.5 h-3.5 text-git-added shrink-0" />
            )}
            <span>LFS Pull</span>
          </button>

          <button
            type="button"
            onClick={handleLfsPush}
            disabled={isOperating === 'push'}
            className="h-7.5 px-3 rounded-xs bg-base-0 hover:bg-base-2 active:bg-base-3 border border-border text-sky-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            title="Push all local LFS binary objects to remote"
          >
            {isOperating === 'push' ? (
              <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span>LFS Push</span>
          </button>

          <button
            type="button"
            onClick={loadLfsData}
            disabled={isLoading}
            className="h-7.5 px-3 rounded-xs bg-base-0 hover:bg-base-2 active:bg-base-3 border border-border text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            title="Refresh LFS files & active lock status"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin shrink-0" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-text-muted shrink-0" />
            )}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {!isLfsInstalled && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xs text-amber-400 text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Git LFS binary was not detected on system PATH. Install Git LFS to utilize heavy binary
            tracking.
          </span>
        </div>
      )}

      {/* ── 2-Column Grid: Pattern Tracking + File Locks ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: LFS Pattern Tracking Rules */}
        <div className="bg-base-1/60 border border-border rounded-xs p-4 space-y-3.5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-commito-coral" />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Tracked File Patterns
              </h3>
            </div>
            <span className="text-[10px] font-mono text-text-muted bg-base-0 px-1.5 py-0.2 rounded-xs border border-border">
              {trackedPatterns.length} {trackedPatterns.length === 1 ? 'rule' : 'rules'} in .gitattributes
            </span>
          </div>

          {/* Add Pattern Form */}
          <form onSubmit={handleTrackPattern} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. *.onnx, *.bin, *.zip, assets/*.psd"
              value={trackPattern}
              onChange={(e) => setTrackPattern(e.target.value)}
              className="flex-1 h-8 px-3 bg-base-0 border border-border hover:border-border-strong focus:border-border-strong rounded-xs text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs select-text"
            />
            <button
              type="submit"
              disabled={!trackPattern.trim()}
              className="h-8 px-3.5 rounded-xs bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Track</span>
            </button>
          </form>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Quick Binary Presets:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PATTERNS.map((p) => {
                const isTracked = trackedPatterns.includes(p.pattern);
                return (
                  <button
                    key={p.pattern}
                    type="button"
                    onClick={() =>
                      isTracked ? handleUntrackPattern(p.pattern) : handleTrackPreset(p.pattern)
                    }
                    className={`px-2 py-1 rounded-xs text-[10.5px] font-mono transition cursor-pointer flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
                      isTracked
                        ? 'bg-commito-coral/15 border-commito-coral/40 text-commito-coral font-bold'
                        : 'bg-base-0 hover:bg-base-2 border-border text-text-muted hover:text-text-primary'
                    }`}
                    title={`${p.desc} (${p.pattern})`}
                  >
                    <span>{p.label}</span>
                    <span className="opacity-70 text-[9.5px]">({p.pattern})</span>
                    {isTracked && <Check className="w-2.5 h-2.5 text-commito-coral" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tracked Patterns List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin pt-1 flex-1">
            {trackedPatterns.length === 0 ? (
              <div className="p-6 text-center rounded-xs border border-dashed border-border/80 bg-base-0/30 text-text-muted text-xs">
                No active tracking rules found in .gitattributes
              </div>
            ) : (
              trackedPatterns.map((pat) => (
                <div
                  key={pat}
                  className="px-3 py-2 bg-base-0 border border-border hover:border-border-strong rounded-xs flex items-center justify-between text-xs font-mono group transition shadow-2xs"
                >
                  <span className="text-text-primary font-medium truncate select-text">{pat}</span>
                  <button
                    type="button"
                    onClick={() => handleUntrackPattern(pat)}
                    className="p-1 rounded-xs text-text-muted hover:text-git-removed hover:bg-git-removed-bg transition cursor-pointer"
                    title="Untrack pattern"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 2: Exclusive Binary File Locks */}
        <div className="bg-base-1/60 border border-border rounded-xs p-4 space-y-3.5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-commito-coral" />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Exclusive Binary File Locks
              </h3>
            </div>
            <span className="text-[10px] font-mono text-text-muted bg-base-0 px-1.5 py-0.2 rounded-xs border border-border">
              {lfsLocks.length} {lfsLocks.length === 1 ? 'lock' : 'locks'} active
            </span>
          </div>

          {/* Lock File Form */}
          <form onSubmit={handleLockFile} className="flex gap-2">
            <input
              type="text"
              placeholder="Path to lock, e.g. assets/textures/hero.psd"
              value={lockFilePath}
              onChange={(e) => setLockFilePath(e.target.value)}
              className="flex-1 h-8 px-3 bg-base-0 border border-border hover:border-border-strong focus:border-border-strong rounded-xs text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs select-text"
            />
            <button
              type="submit"
              disabled={!lockFilePath.trim()}
              className="h-8 px-3.5 rounded-xs bg-base-0 hover:bg-base-2 active:bg-base-3 border border-border text-text-primary font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 active:scale-95"
            >
              <Lock className="w-3.5 h-3.5 text-commito-coral" />
              <span>Lock</span>
            </button>
          </form>

          {/* Active Locks List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin pt-1 flex-1">
            {lfsLocks.length === 0 ? (
              <div className="p-6 text-center rounded-xs border border-dashed border-border/80 bg-base-0/30 text-text-muted text-xs">
                No active remote file locks recorded.
              </div>
            ) : (
              lfsLocks.map((lock) => (
                <div
                  key={lock.id}
                  className="p-2.5 bg-base-0 border border-border hover:border-border-strong rounded-xs flex items-center justify-between gap-2 text-xs shadow-2xs transition"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <div className="font-mono font-medium text-text-primary truncate select-text">
                      {lock.path}
                    </div>
                    <div className="text-[10.5px] text-text-muted flex items-center gap-2 mt-0.5">
                      <span>
                        Owner: <strong className="text-text-secondary">{lock.owner}</strong>
                      </span>
                      <span>•</span>
                      <span>{lock.locked_at}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUnlockFile(lock.path, false)}
                      className="px-2.5 py-1 bg-base-1 hover:bg-base-2 border border-border text-text-primary rounded-xs text-[10.5px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-2xs"
                      title="Release lock normally"
                    >
                      <Unlock className="w-3 h-3 text-git-added" />
                      <span>Unlock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnlockFile(lock.path, true)}
                      className="px-2.5 py-1 bg-base-1 hover:bg-git-removed-bg hover:text-git-removed border border-border text-text-muted rounded-xs text-[10.5px] font-medium transition cursor-pointer active:scale-95 shadow-2xs"
                      title="Force break lock"
                    >
                      <span>Force</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Tracked LFS Working Files Table ── */}
      <div className="bg-base-1/60 border border-border rounded-xs p-4 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              LFS Objects in Working Tree
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs bg-base-0 border border-border text-text-muted">
              {lfsFiles.length}
            </span>
          </div>

          <div className="relative w-56">
            <Search className="w-3 h-3 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search LFS files..."
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              className="w-full h-7.5 pl-8 pr-2.5 bg-base-0 border border-border hover:border-border-strong focus:border-border-strong rounded-xs text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs select-text"
            />
          </div>
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
          {filteredLfsFiles.length === 0 ? (
            <div className="p-8 text-center rounded-xs border border-dashed border-border/80 bg-base-0/30 text-text-muted text-xs">
              {fileFilter
                ? `No LFS files matching "${fileFilter}"`
                : 'No LFS tracked objects committed in repository yet.'}
            </div>
          ) : (
            filteredLfsFiles.map((file) => (
              <div
                key={file.oid + file.path}
                className="px-3.5 py-2.5 bg-base-0 border border-border hover:border-border-strong rounded-xs flex items-center justify-between gap-3 text-xs transition shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {getFileIcon(file.path)}
                  <span className="font-mono text-xs text-text-primary truncate select-text">{file.path}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-[10.5px]">
                  <span className="text-text-muted/80 bg-base-1 border border-border px-1.5 py-0.5 rounded-xs truncate max-w-[120px] select-text">
                    {file.oid.slice(0, 10)}...
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCopyOid(file.oid)}
                    className="p-1 rounded-xs text-text-muted hover:text-text-primary hover:bg-base-1 transition cursor-pointer"
                    title="Copy full LFS OID"
                  >
                    {copiedOid === file.oid ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLockFilePath(file.path);
                      handleLockFile({
                        preventDefault: () => {},
                      } as React.FormEvent);
                    }}
                    className="px-2.5 py-1 rounded-xs bg-base-1 hover:bg-base-2 border border-border text-text-muted hover:text-text-primary text-[10.5px] font-sans font-medium transition cursor-pointer shadow-2xs active:scale-95"
                    title="Lock this file"
                  >
                    Lock
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
