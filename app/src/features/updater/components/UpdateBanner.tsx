import React from 'react';
import { Download, X, AlertCircle, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { useUpdaterStore } from '../useUpdaterStore';
import { Button } from '../../../components/common/Button';

export const UpdateBanner: React.FC = () => {
  const {
    showBanner,
    availableUpdate,
    status,
    downloadProgress,
    errorMessage,
    downloadAndInstall,
    dismissBanner,
  } = useUpdaterStore();

  if (!showBanner || !availableUpdate) return null;

  const isDownloading = status === 'downloading';
  const isReady = status === 'ready';

  return (
    <div className="fixed bottom-5 right-5 z-[99998] max-w-sm w-full animate-in slide-in-from-bottom-2 fade-in duration-150 select-none font-sans">
      <div className="p-3.5 bg-base-0 border border-border-strong rounded-sm shadow-2xl backdrop-blur-md flex flex-col gap-2.5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2.5">
          {/* Icon chip */}
          <div className="w-6 h-6 rounded-sm bg-base-1 border border-border flex items-center justify-center shrink-0 mt-0.5 text-commito-coral">
            {isDownloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUpCircle className="w-3.5 h-3.5 text-commito-coral" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <h4 className="text-xs font-bold leading-tight text-text-primary">
                Update Available
              </h4>
              <span className="px-1.5 py-0.2 rounded-xs bg-commito-coral/15 border border-commito-coral/30 text-commito-coral font-mono text-[9.5px] font-bold">
                v{availableUpdate.version}
              </span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {isDownloading
                ? `Downloading update package... ${downloadProgress}%`
                : isReady
                ? 'Update downloaded. Restarting Git Desktop...'
                : 'A new update is ready to install.'}
            </p>
          </div>

          {/* Dismiss Button */}
          {!isDownloading && (
            <button
              type="button"
              onClick={dismissBanner}
              className="w-5.5 h-5.5 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-1 transition cursor-pointer flex items-center justify-center shrink-0 -mr-1 -mt-1"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Progress Bar (Visible while downloading) */}
        {isDownloading && (
          <div className="w-full bg-base-2 h-1.5 rounded-full overflow-hidden border border-border">
            <div
              className="bg-commito-coral h-full transition-all duration-150 rounded-full"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}

        {/* Error Notification Box */}
        {errorMessage && (
          <div className="p-2 bg-git-removed-bg/60 border border-git-removed/40 rounded-xs text-[11px] text-git-removed flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="leading-tight break-words">{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-end gap-2 pt-0.5">
          {!isDownloading && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={dismissBanner}
            >
              Later
            </Button>
          )}
          <Button
            type="button"
            variant="coral"
            size="xs"
            onClick={downloadAndInstall}
            isLoading={isDownloading}
            disabled={isDownloading}
            leftIcon={!isDownloading ? <Download className="w-3.5 h-3.5" /> : undefined}
          >
            {isDownloading
              ? `Installing ${downloadProgress}%`
              : `Update & Restart`}
          </Button>
        </div>
      </div>
    </div>
  );
};
