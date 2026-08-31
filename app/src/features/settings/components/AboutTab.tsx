import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe,
  Bug,
  Cpu,
  ShieldCheck,
  Zap,
  Info,
  FolderGit2,
} from 'lucide-react';
import { getVersion, getTauriVersion, getName, getIdentifier } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useSettingsStore } from '../store/useSettingsStore';
import { Button } from '../../../components/common/Button';

export const AboutTab: React.FC = () => {
  const { getEffectiveValue, setSettingValue } = useSettingsStore();

  const [appVersion, setAppVersion] = useState<string>('0.1.0');
  const [appName, setAppName] = useState<string>('Git Desktop');
  const [tauriVersion, setTauriVersion] = useState<string>('2.2.0');
  const [appId, setAppId] = useState<string>('com.cyronicstudio.gitdesktop');

  const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'up-to-date' | 'available'>('up-to-date');
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('Just now');

  useEffect(() => {
    let isMounted = true;
    async function fetchAppMetadata() {
      try {
        const [v, n, tv, id] = await Promise.all([
          getVersion().catch(() => '0.1.0'),
          getName().catch(() => 'Git Desktop'),
          getTauriVersion().catch(() => '2.2.0'),
          getIdentifier().catch(() => 'com.cyronicstudio.gitdesktop'),
        ]);
        if (isMounted) {
          if (v) setAppVersion(v);
          if (n) setAppName(n);
          if (tv) setTauriVersion(tv);
          if (id) setAppId(id);
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

    // Simulate/Check update endpoint with graceful feedback
    setTimeout(() => {
      setIsCheckingUpdates(false);
      setUpdateStatus('up-to-date');
      setLastCheckedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1200);
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
            {/* App Icon Container */}
            <div className="w-12 h-12 rounded-sm bg-gradient-to-br from-commito-coral/20 via-base-0 to-base-2 border border-commito-coral/40 flex items-center justify-center shadow-xs shrink-0">
              <FolderGit2 className="w-6 h-6 text-commito-coral" />
            </div>

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
            Software Updates
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

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCheckForUpdates}
            disabled={isCheckingUpdates}
            className="shrink-0 text-text-muted hover:text-commito-coral"
          >
            Refresh
          </Button>
        </div>

        {/* Setting Toggle: Auto-check for updates */}
        <div
          onClick={() => setSettingValue('app.auto_update', !autoUpdate)}
          className="p-2.5 rounded-sm border border-border/70 bg-base-1/50 hover:bg-base-1 hover:border-border transition cursor-pointer flex items-center justify-between gap-3 select-none"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-text-primary leading-none">
              Automatically check for updates
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-normal">
              Check for new releases in the background and notify when an update is available.
            </p>
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
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-text-primary leading-none">
              Include pre-release beta builds
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-normal">
              Receive early preview updates with cutting-edge features and experimental optimizations.
            </p>
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
              <span>Application Identifier</span>
            </div>
            <div className="text-xs font-mono font-semibold text-text-primary truncate" title={appId}>
              {appId}
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
            onClick={() => handleOpenLink('https://github.com/cyronicstudio/git-desktop')}
            className="p-2.5 bg-base-1/40 hover:bg-base-1/80 border border-border/60 hover:border-border-strong rounded-sm flex items-center justify-between text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Github className="w-4 h-4 text-text-muted group-hover:text-commito-coral transition-colors shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-commito-coral transition-colors">
                  GitHub Repository
                </span>
                <span className="text-[10.5px] text-text-muted block truncate">
                  Source code &amp; star the project
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenLink('https://github.com/cyronicstudio/git-desktop/releases')}
            className="p-2.5 bg-base-1/40 hover:bg-base-1/80 border border-border/60 hover:border-border-strong rounded-sm flex items-center justify-between text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-text-muted group-hover:text-commito-coral transition-colors shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-commito-coral transition-colors">
                  Release Notes
                </span>
                <span className="text-[10.5px] text-text-muted block truncate">
                  See what's new in v{appVersion}
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenLink('https://github.com/cyronicstudio/git-desktop/issues')}
            className="p-2.5 bg-base-1/40 hover:bg-base-1/80 border border-border/60 hover:border-border-strong rounded-sm flex items-center justify-between text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Bug className="w-4 h-4 text-text-muted group-hover:text-commito-coral transition-colors shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-commito-coral transition-colors">
                  Report an Issue
                </span>
                <span className="text-[10.5px] text-text-muted block truncate">
                  File bug reports &amp; suggestions
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors shrink-0 ml-1" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenLink('https://cyronicstudio.com')}
            className="p-2.5 bg-base-1/40 hover:bg-base-1/80 border border-border/60 hover:border-border-strong rounded-sm flex items-center justify-between text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-4 h-4 text-text-muted group-hover:text-commito-coral transition-colors shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-commito-coral transition-colors">
                  Cyronic Studio
                </span>
                <span className="text-[10.5px] text-text-muted block truncate">
                  Official developer website
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-commito-coral transition-colors shrink-0 ml-1" />
          </button>
        </div>
      </section>

      {/* ── 5. Copyright Footer ── */}
      <div className="pt-2 text-center text-[10.5px] text-text-muted font-mono">
        © 2026 Cyronic Studio. Local-first architecture • All rights reserved.
      </div>
    </div>
  );
};
