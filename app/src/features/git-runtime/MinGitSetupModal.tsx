import React, { useEffect, useRef } from 'react';
import {
  Download,
  CheckCircle,
  AlertTriangle,
  Terminal,
  X,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { useGitRuntime } from './useGitRuntime';
import { Button } from '../../components/common/Button';

interface MinGitSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MinGitSetupModal: React.FC<MinGitSetupModalProps> = ({ isOpen, onClose }) => {
  const { runtimeInfo, isLoading, isInstalling, progress, installMinGit, checkStatus } =
    useGitRuntime();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isInstalling) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isInstalling, onClose]);

  if (!isOpen) return null;

  const handleInstall = async () => {
    try {
      await installMinGit();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-100 select-none font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isInstalling) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[460px] bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Unified 1-Row Header */}
        <div className="px-3.5 py-2.5 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-xs bg-commito-coral/15 border border-commito-coral/30 text-commito-coral flex items-center justify-center shrink-0">
              <Terminal className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs font-bold text-text-primary leading-none truncate">
                Git Runtime Configuration
              </h2>
              <span className="text-border">•</span>
              <span className="text-[10.5px] text-text-muted truncate">Portable MinGit &amp; CLI</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isInstalling}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0 disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-2.5 bg-base-0 text-xs">
          {/* Current Git Status Box */}
          <div className="p-3 rounded-sm bg-base-1 border border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">Detected Git Binary</span>
              {isLoading ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] text-text-muted">
                  <RefreshCw className="w-3 h-3 animate-spin text-commito-coral" /> Detecting...
                </span>
              ) : runtimeInfo?.is_available ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-git-added/15 border border-git-added/30 text-git-added text-[10.5px] font-semibold">
                  <CheckCircle className="w-3 h-3" /> Available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10.5px] font-semibold">
                  <AlertTriangle className="w-3 h-3" /> Not Found
                </span>
              )}
            </div>

            {runtimeInfo?.is_available ? (
              <div className="text-[11px] font-mono space-y-1 pt-1.5 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Version:</span>
                  <span className="text-text-primary font-semibold">{runtimeInfo.version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Type:</span>
                  <span className="text-text-primary">
                    {runtimeInfo.is_portable_mingit
                      ? 'Portable MinGit (Bundled)'
                      : 'System Installed Git'}
                  </span>
                </div>
                {runtimeInfo.executable_path && (
                  <div className="pt-0.5">
                    <div
                      className="p-1.5 rounded-xs bg-base-2 border border-border/60 text-[10px] font-mono text-text-muted truncate select-text"
                      title={runtimeInfo.executable_path}
                    >
                      {runtimeInfo.executable_path}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-text-muted text-[11px] leading-relaxed pt-1.5 border-t border-border/50">
                Git CLI is not detected in your system PATH. The application's GUI features will
                work normally, but terminal CLI commands require Git.
              </p>
            )}
          </div>

          {/* MinGit Info Card */}
          <div className="p-3 rounded-sm bg-base-1/50 border border-border/70 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
              <HardDrive className="w-3.5 h-3.5 text-commito-coral" />
              <span>Portable MinGit (Git for Windows)</span>
            </div>
            <p className="text-text-muted text-[11px] leading-relaxed">
              Official lightweight standalone Git (~25 MB download). Does not require administrator
              privileges and automatically enables{' '}
              <code className="text-text-primary font-mono bg-base-2 px-1 py-0.5 rounded-xs text-[10.5px]">git</code> inside
              the terminal on any PC.
            </p>
          </div>

          {/* Progress Bar (when downloading/extracting) */}
          {isInstalling && progress && (
            <div className="space-y-1.5 p-3 rounded-sm bg-base-1 border border-border animate-in fade-in duration-100">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-text-primary">{progress.message}</span>
                <span className="text-commito-coral font-mono">
                  {progress.percentage.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-base-2 overflow-hidden">
                <div
                  className="h-full bg-commito-coral transition-all duration-150 rounded-full"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Unified Modal Footer with Standard Button Components */}
        <div className="px-3.5 py-2.5 bg-base-1 border-t border-border flex items-center justify-between gap-2 shrink-0 min-h-[42px]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={checkStatus}
            disabled={isInstalling || isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isInstalling}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="coral"
              size="sm"
              onClick={handleInstall}
              disabled={isInstalling}
              isLoading={isInstalling}
              leftIcon={!isInstalling ? <Download className="w-3.5 h-3.5" /> : undefined}
            >
              {runtimeInfo?.mingit_installed ? 'Reinstall MinGit' : 'Download MinGit (~25MB)'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
