import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Cpu,
  ShieldCheck,
  Zap,
  Info,
  Radio,
  FlaskConical,
} from 'lucide-react';
import { getVersion, getTauriVersion, getName } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useSettingsStore } from '../store/useSettingsStore';
import { Button } from '../../../components/common/Button';
import { useGitRuntime } from '../../git-runtime/useGitRuntime';
import { MinGitSetupModal } from '../../git-runtime/MinGitSetupModal';

import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export const AboutTab: React.FC = () => {
  const { getEffectiveValue, setSettingValue } = useSettingsStore();

  const [appVersion, setAppVersion] = useState<string>('0.1.0');
  const [appName, setAppName] = useState<string>('Git Desktop');
  const [tauriVersion, setTauriVersion] = useState<string>('2.2.0');

  const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'up-to-date' | 'available'>('up-to-date');
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('Just now');
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState<boolean>(false);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState<number>(0);

  const {
    runtimeInfo,
    isLoading: isGitRuntimeLoading,
    isInstalling: isGitInstalling,
    progress: gitProgress,
    checkStatus: checkGitRuntimeStatus,
  } = useGitRuntime();

  const [showMinGitModal, setShowMinGitModal] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchAppMetadata() {
      try {
        const [v, n, tv] = await Promise.all([
          getVersion().catch(() => '0.1.0'),
          getName().catch(() => 'Git Desktop'),
          getTauriVersion().catch(() => '2.2.0'),
        ]);
        if (isMounted) {
          if (v) setAppVersion(v);
          if (n) setAppName(n);
          if (tv) setTauriVersion(tv);
        }
      } catch {
        // Fallbacks already initialized in state
      }
    }
    fetchAppMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdates(true);
    setUpdateStatus('idle');

    try {
      const update = await check();
      if (update) {
        setAvailableUpdate(update);
        setUpdateStatus('available');
      } else {
        setAvailableUpdate(null);
        setUpdateStatus('up-to-date');
      }
    } catch (err) {
      console.warn('Native updater check (fallback to local info in dev):', err);
      setUpdateStatus('up-to-date');
    } finally {
      setIsCheckingUpdates(false);
      setLastCheckedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!availableUpdate) return;
    setIsDownloadingUpdate(true);
    try {
      let downloaded = 0;
      let contentLength = 0;
      await availableUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setUpdateDownloadProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            break;
        }
      });
      await relaunch();
    } catch (err) {
      console.error('Failed to download & install update:', err);
    } finally {
      setIsDownloadingUpdate(false);
    }
  };

  const handleOpenLink = (url: string) => {
    openUrl(url).catch(() => {});
  };

  const autoUpdate = Boolean(getEffectiveValue('app.auto_update') ?? true);
  const betaChannel = Boolean(getEffectiveValue('app.beta_channel') ?? false);

  return (
    <div className="space-y-4 select-none font-sans pb-4">
      {/* ── 1. Hero Application Banner Card ── */}
      <div className="p-4 bg-gradient-to-br from-base-1/90 via-base-1/60 to-base-2/40 border border-border/80 rounded-sm shadow-2xs relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-commito-coral/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-text-primary tracking-tight">{appName}</h3>
                <span className="px-2 py-0.5 rounded-xs bg-commito-coral/15 border border-commito-coral/30 text-commito-coral font-mono text-[10px] font-bold">
                  v{appVersion}
                </span>
                <span className="px-1.5 py-0.2 rounded-xs bg-base-2 border border-border text-text-muted font-mono text-[9px]">
                  Desktop Client
                </span>
              </div>
              <p className="text-[11.5px] text-text-secondary leading-relaxed">
                Modern, high-performance desktop Git client with AI reasoning, GitLab &amp; GitHub integration.
              </p>
            </div>
          </div>

          {/* Quick Check Button */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCheckForUpdates}
            isLoading={isCheckingUpdates}
            leftIcon={!isCheckingUpdates ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
            className="shrink-0 self-start sm:self-center"
          >
            Check for Updates
          </Button>
        </div>
      </div>

      {/* ── 2. Software Updates & Release Channel Section ── */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
            Software Updates &amp; Git Runtime
          </h4>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* Update Status Card */}
        <div className="p-3 bg-base-1/50 border border-border/70 rounded-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 ${
                updateStatus === 'available'
                  ? 'bg-amber-500/15 border border-amber-500/30'
                  : 'bg-git-added/15 border border-git-added/30'
              }`}
            >
              {updateStatus === 'available' ? (
                <Sparkles className="w-4 h-4 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-git-added" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 leading-none">
                <span>
                  {updateStatus === 'available'
                    ? 'New Update Available'
                    : 'Git Desktop is up to date'}
                </span>
                <span className="text-[10.5px] font-mono text-text-muted font-normal">
                  (v{appVersion})
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1 leading-none">
                Last checked: {lastCheckedTime} • Release channel:{' '}
                <span className="text-text-secondary font-medium">
                  {betaChannel ? 'Beta / Preview' : 'Stable'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {updateStatus === 'available' && availableUpdate && (
              <Button
                type="button"
                variant="coral"
                size="xs"
                onClick={handleDownloadAndInstall}
                disabled={isDownloadingUpdate}
                isLoading={isDownloadingUpdate}
                className="shrink-0 text-xs font-bold shadow-xs"
              >
                {isDownloadingUpdate
                  ? `Updating ${updateDownloadProgress}%`
                  : `Install v${availableUpdate.version}`}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdates || isDownloadingUpdate}
              isLoading={isCheckingUpdates}
              className="shrink-0 text-text-muted hover:text-commito-coral"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Portable Git Runtime Status Card */}
        <div className="p-3 bg-base-1/50 border border-border/70 rounded-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 ${
                isGitRuntimeLoading || isGitInstalling
                  ? 'bg-commito-coral/15 border border-commito-coral/30'
                  : runtimeInfo?.is_available
                  ? 'bg-git-added/15 border border-git-added/30'
                  : 'bg-amber-500/15 border border-amber-500/30'
              }`}
            >
              {isGitRuntimeLoading || isGitInstalling ? (
                <RefreshCw className="w-4 h-4 text-commito-coral animate-spin" />
              ) : runtimeInfo?.is_available ? (
                <CheckCircle2 className="w-4 h-4 text-git-added" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 leading-none flex-wrap">
                <span>
                  {runtimeInfo?.is_portable_mingit
                    ? 'Portable MinGit Active'
                    : runtimeInfo?.is_available
                    ? 'System Git Active'
                    : 'Portable Git Not Configured'}
                </span>
                {runtimeInfo?.version && (
                  <span className="text-[10.5px] font-mono text-text-muted font-normal">
                    (v{runtimeInfo.version})
                  </span>
                )}
                {runtimeInfo?.is_portable_mingit && (
                  <span className="px-1.5 py-0.2 rounded-xs bg-commito-coral/10 border border-commito-coral/20 text-commito-coral text-[9px] font-mono font-medium">
                    Portable
                  </span>
                )}
              </div>
              <p
                className="text-[11px] text-text-muted mt-1 leading-none truncate"
                title={runtimeInfo?.executable_path || undefined}
              >
                {isGitInstalling && gitProgress
                  ? `${gitProgress.message} (${gitProgress.percentage.toFixed(0)}%)`
                  : isGitRuntimeLoading
                  ? 'Checking Git runtime environment...'
                  : runtimeInfo?.is_available
                  ? `Runtime: ${runtimeInfo.is_portable_mingit ? 'Bundled Portable MinGit' : 'System PATH'} • ${runtimeInfo.executable_path || 'Ready'}`
                  : 'Git CLI is not detected. Download lightweight MinGit (~25MB) to enable terminal Git.'}
              </p>
              {isGitInstalling && gitProgress && (
                <div className="w-full h-1.5 rounded-full bg-base-3 overflow-hidden mt-2">
                  <div
                    className="h-full bg-commito-coral transition-all duration-150 rounded-full"
                    style={{ width: `${gitProgress.percentage}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => checkGitRuntimeStatus()}
              disabled={isGitRuntimeLoading || isGitInstalling}
              isLoading={isGitRuntimeLoading}
              className="shrink-0 text-text-muted hover:text-commito-coral"
            >
              Check
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => setShowMinGitModal(true)}
              disabled={isGitInstalling}
              className="shrink-0 text-xs"
            >
              Configure
            </Button>
          </div>
        </div>

        {/* Setting Toggle: Auto-check for updates */}
        <div
          onClick={() => setSettingValue('app.auto_update', !autoUpdate)}
          className="p-2.5 rounded-sm border border-border/70 bg-base-1/50 hover:bg-base-1 hover:border-border transition cursor-pointer flex items-center justify-between gap-3 select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 transition-colors ${
                autoUpdate
                  ? 'bg-commito-coral/15 border border-commito-coral/30 text-commito-coral'
                  : 'bg-base-2 border border-border text-text-muted'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-text-primary leading-none">
                Automatically check for updates
              </div>
              <p className="text-[11px] text-text-muted mt-1 leading-normal">
                Check for new releases in the background and notify when an update is available.
              </p>
            </div>
          </div>

          <div
            className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
              autoUpdate ? 'bg-commito-coral border-commito-coral' : 'bg-base-2 border-border'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                autoUpdate ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </div>
        </div>

        {/* Setting Toggle: Beta Preview Channel */}
        <div
          onClick={() => setSettingValue('app.beta_channel', !betaChannel)}
          className="p-2.5 rounded-sm border border-border/70 bg-base-1/50 hover:bg-base-1 hover:border-border transition cursor-pointer flex items-center justify-between gap-3 select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 transition-colors ${
                betaChannel
                  ? 'bg-commito-coral/15 border border-commito-coral/30 text-commito-coral'
                  : 'bg-base-2 border border-border text-text-muted'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-text-primary leading-none">
                Include pre-release beta builds
              </div>
              <p className="text-[11px] text-text-muted mt-1 leading-normal">
                Receive early preview updates with cutting-edge features and experimental optimizations.
              </p>
            </div>
          </div>

          <div
            className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
              betaChannel ? 'bg-commito-coral border-commito-coral' : 'bg-base-2 border-border'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                betaChannel ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </div>
        </div>
      </section>

      {/* ── 3. Runtime & Technology Architecture ── */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
            Architecture &amp; System Info
          </h4>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2.5 bg-base-1/40 border border-border/60 rounded-sm space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
              <Cpu className="w-3.5 h-3.5 text-commito-coral" />
              <span>Tauri Framework</span>
            </div>
            <div className="text-xs font-mono font-semibold text-text-primary">
              v{tauriVersion} (Rust Backend)
            </div>
          </div>

          <div className="p-2.5 bg-base-1/40 border border-border/60 rounded-sm space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
              <Zap className="w-3.5 h-3.5 text-commito-coral" />
              <span>AI Engine &amp; Reasoning</span>
            </div>
            <div className="text-xs font-mono font-semibold text-text-primary">
              Google Gemini 3.5 / 3.6 Flash
            </div>
          </div>

          <div className="p-2.5 bg-base-1/40 border border-border/60 rounded-sm space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-commito-coral" />
              <span>Git Runtime Engine</span>
            </div>
            <div
              className="text-xs font-mono font-semibold text-text-primary truncate"
              title={runtimeInfo?.executable_path || undefined}
            >
              {runtimeInfo?.is_available
                ? `${runtimeInfo.is_portable_mingit ? 'Portable MinGit' : 'System Git'} (v${runtimeInfo.version || 'detected'})`
                : 'Not Configured'}
            </div>
          </div>

          <div className="p-2.5 bg-base-1/40 border border-border/60 rounded-sm space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
              <Info className="w-3.5 h-3.5 text-commito-coral" />
              <span>Target Platform</span>
            </div>
            <div className="text-xs font-mono font-semibold text-text-primary">
              Windows x86_64 (Direct Native)
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Community & Useful Links ── */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
            Resources &amp; Support
          </h4>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              handleOpenLink(
                (import.meta.env.VITE_CYRONIC_ISSUES_URL as string) ||
                  'https://github.com/cyronicstudio/git-desktop/issues'
              )
            }
            className="p-2.5 bg-base-1/40 hover:bg-base-1/80 border border-border/60 hover:border-border-strong rounded-sm flex items-center justify-between text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="min-w-0">
              <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-commito-coral transition-colors">
                Report Bugs
              </span>
              <span className="text-[10.5px] text-text-muted block truncate">
                File bug reports &amp; feedback
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() =>
              handleOpenLink(
                (import.meta.env.VITE_CYRONIC_RELEASES_URL as string) ||
                  'https://github.com/cyronicstudio/git-desktop/releases'
              )
            }
            className="p-2.5 bg-base-1/40 hover:bg-base-1/80 border border-border/60 hover:border-border-strong rounded-sm flex items-center justify-between text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="min-w-0">
              <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-commito-coral transition-colors">
                Release Notes
              </span>
              <span className="text-[10.5px] text-text-muted block truncate">
                See what's new in v{appVersion}
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() =>
              handleOpenLink(
                (import.meta.env.VITE_CYRONIC_DISCORD_URL as string) ||
                  'https://discord.gg/cyronicstudio'
              )
            }
            className="p-2.5 bg-base-1/40 hover:bg-base-1/80 border border-border/60 hover:border-border-strong rounded-sm flex items-center justify-between text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="min-w-0">
              <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-commito-coral transition-colors">
                Developer Community
              </span>
              <span className="text-[10.5px] text-text-muted block truncate">
                Join our official Discord server
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() =>
              handleOpenLink(
                (import.meta.env.VITE_CYRONIC_WEBSITE_URL as string) ||
                  'https://cyronicstudio.com'
              )
            }
            className="p-2.5 bg-base-1/40 hover:bg-base-1/80 border border-border/60 hover:border-border-strong rounded-sm flex items-center justify-between text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="min-w-0">
              <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-commito-coral transition-colors">
                CyronicStudio
              </span>
              <span className="text-[10.5px] text-text-muted block truncate">
                Official developer website
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors shrink-0 ml-1" />
          </button>
        </div>
      </section>

      {/* ── 5. Copyright Footer ── */}
      <div className="pt-2 text-center text-[10.5px] text-text-muted font-mono">
        © 2026 Cyronic Studio. Local-first architecture • All rights reserved.
      </div>

      {/* ── 6. MinGit Runtime Configuration Modal ── */}
      <MinGitSetupModal
        isOpen={showMinGitModal}
        onClose={() => setShowMinGitModal(false)}
      />
    </div>
  );
};
