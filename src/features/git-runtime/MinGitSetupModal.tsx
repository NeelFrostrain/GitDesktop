import React from 'react';
import { Download, CheckCircle, AlertTriangle, Terminal, X, RefreshCw, HardDrive } from 'lucide-react';
import { useGitRuntime } from './useGitRuntime';

interface MinGitSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MinGitSetupModal: React.FC<MinGitSetupModalProps> = ({ isOpen, onClose }) => {
  const {
    runtimeInfo,
    isLoading,
    isInstalling,
    progress,
    installMinGit,
    checkStatus,
  } = useGitRuntime();

  if (!isOpen) return null;

  const handleInstall = async () => {
    try {
      await installMinGit();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-base-1 border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-base-2/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-commito-coral/10 text-commito-coral border border-commito-coral/20">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Git Runtime Configuration</h2>
              <p className="text-xs text-text-muted">Portable MinGit & CLI Environment</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isInstalling}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-base-3 transition disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Current Git Status Box */}
          <div className="p-3.5 rounded-lg bg-base-2 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-secondary">Detected Git Binary</span>
              {isLoading ? (
                <span className="text-text-muted flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Detecting...
                </span>
              ) : runtimeInfo?.is_available ? (
                <span className="inline-flex items-center gap-1 text-git-added font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> Available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-git-modified font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> Not Found
                </span>
              )}
            </div>

            {runtimeInfo?.is_available ? (
              <div className="text-text-muted font-mono space-y-1 pt-1 border-t border-border/40 text-[11px]">
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="text-text-primary font-semibold">{runtimeInfo.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="text-text-primary">
                    {runtimeInfo.is_portable_mingit ? 'Portable MinGit (Bundled)' : 'System Installed Git'}
                  </span>
                </div>
                {runtimeInfo.executable_path && (
                  <div className="truncate text-text-faint text-[10px]" title={runtimeInfo.executable_path}>
                    {runtimeInfo.executable_path}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-text-muted text-xs leading-relaxed">
                Git CLI is not detected in your system PATH. The application's GUI features will work normally, but terminal commands require Git.
              </p>
            )}
          </div>

          {/* MinGit Info Card */}
          <div className="p-3.5 rounded-lg bg-base-0/60 border border-border space-y-2">
            <div className="flex items-center gap-2 font-semibold text-text-primary">
              <HardDrive className="w-4 h-4 text-gitlab-teal" />
              <span>Portable MinGit (Git for Windows)</span>
            </div>
            <p className="text-text-muted text-xs leading-relaxed">
              Official lightweight standalone Git (~25 MB download). Does not require administrator privileges and automatically enables <code className="text-text-primary font-mono bg-base-3 px-1 rounded">git</code> inside the terminal on any PC.
            </p>
          </div>

          {/* Progress Bar (when downloading/extracting) */}
          {isInstalling && progress && (
            <div className="space-y-2 p-3.5 rounded-lg bg-base-2 border border-border animate-in fade-in duration-100">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-text-primary">{progress.message}</span>
                <span className="text-commito-coral font-mono">{progress.percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-base-3 overflow-hidden">
                <div
                  className="h-full bg-commito-coral transition-all duration-200 rounded-full"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-base-2/40">
          <button
            type="button"
            onClick={checkStatus}
            disabled={isInstalling}
            className="px-3 py-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-base-3 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isInstalling}
              className="px-3 py-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-base-3 transition cursor-pointer disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleInstall}
              disabled={isInstalling}
              className="px-4 py-1.5 rounded-md bg-commito-coral hover:bg-commito-coralHover text-white font-medium shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${isInstalling ? 'animate-bounce' : ''}`} />
              <span>{runtimeInfo?.mingit_installed ? 'Reinstall MinGit' : 'Download MinGit (~25MB)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
