import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Loader2,
  Globe,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useAccountServicesStore } from '../store/accountStore';
import { Button } from '../../../components/common/Button';

type ProviderKey = 'gitlab' | 'github' | 'bitbucket';

interface ProviderConfig {
  id: ProviderKey;
  name: string;
  badge: string;
  defaultUrl: string;
  description: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  btnVariant: 'coral' | 'primary' | 'secondary';
  icon: React.ReactNode;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'gitlab',
    name: 'GitLab',
    badge: 'Cloud & Self-Hosted',
    defaultUrl: 'https://gitlab.com',
    description: 'Sign in securely via GitLab.com or your organization’s self-hosted instance.',
    colorClass: 'text-commito-coral',
    borderClass: 'border-commito-coral/30',
    bgClass: 'bg-commito-coral/10',
    btnVariant: 'coral',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="m23.6 9.6-2.1-6.5c-.2-.6-.9-.9-1.5-.6l-4.5 3.3H8.5L4 2.5C3.4 2.2 2.7 2.5 2.5 3.1L.4 9.6c-.2.5 0 1.1.4 1.4L12 19.8l11.2-8.8c.4-.3.6-.9.4-1.4z" />
      </svg>
    ),
  },
  {
    id: 'github',
    name: 'GitHub',
    badge: 'Cloud & Enterprise',
    defaultUrl: 'https://github.com',
    description: 'Authorize with your GitHub.com account or GitHub Enterprise Server in 1 click.',
    colorClass: 'text-purple-400',
    borderClass: 'border-purple-800/40',
    bgClass: 'bg-purple-950/40',
    btnVariant: 'coral',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    badge: 'Atlassian Cloud',
    defaultUrl: 'https://bitbucket.org',
    description: 'Authorize with your Atlassian Bitbucket account in 1 click.',
    colorClass: 'text-blue-400',
    borderClass: 'border-blue-800/40',
    bgClass: 'bg-blue-950/40',
    btnVariant: 'coral',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.517.865 1.022.865h15.244a.774.774 0 0 0 .769-.646l3.475-20.03a.77.77 0 0 0-.769-.891H.778zM14.52 14.36H9.414L8.14 7.026h7.79l-1.41 7.334z" />
      </svg>
    ),
  },
];

export const ProviderPickerCard: React.FC = () => {
  const { accounts, startOAuth, loadAccounts } = useAccountServicesStore();

  const [activeWaitingProvider, setActiveWaitingProvider] = useState<ProviderKey | null>(null);
  const [customUrls, setCustomUrls] = useState<Record<ProviderKey, string>>({
    gitlab: 'https://gitlab.com',
    github: 'https://github.com',
    bitbucket: 'https://bitbucket.org',
  });
  const [expandedUrlProvider, setExpandedUrlProvider] = useState<ProviderKey | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Automatic sync listener
  useEffect(() => {
    let unlistenSynced: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    listen<any>('oauth-account-synced', async (event) => {
      if (event.payload) {
        await loadAccounts();
        setActiveWaitingProvider(null);
        setSuccessMsg(`Successfully signed in as ${event.payload.handle || event.payload.display_name}!`);
      }
    }).then((fn) => {
      unlistenSynced = fn;
    });

    listen<string>('oauth-account-error', (event) => {
      setActiveWaitingProvider(null);
      setError(event.payload || 'OAuth authentication failed');
    });

    return () => {
      if (unlistenSynced) unlistenSynced();
      if (unlistenError) unlistenError();
    };
  }, [loadAccounts]);


  // Clear waiting state if accounts list changes
  useEffect(() => {
    if (activeWaitingProvider && accounts.length > 0) {
      setActiveWaitingProvider(null);
    }
  }, [accounts]);

  const handleSignIn = async (provider: ProviderConfig) => {
    setError(null);
    setSuccessMsg(null);
    setActiveWaitingProvider(provider.id);

    const instanceUrl = customUrls[provider.id] || provider.defaultUrl;

    try {
      await startOAuth(provider.id, instanceUrl);
      setSuccessMsg(`Browser opened for ${provider.name}. Complete sign-in in your browser.`);
    } catch (err: any) {
      setError(err?.message || `Failed to initiate ${provider.name} browser sign-in`);
      setActiveWaitingProvider(null);
    }
  };

  const handleCancelWaiting = () => {
    setActiveWaitingProvider(null);
    setError(null);
  };

  return (
    <div className="space-y-3.5 select-none font-sans">
      {/* Notifications */}
      {error && (
        <div className="p-2.5 bg-git-removed-bg border border-git-removed/40 rounded-sm text-xs text-git-removed flex items-center justify-between gap-2 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-git-removed hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 bg-git-added-bg border border-git-added/40 rounded-sm text-xs text-git-added flex items-center justify-between gap-2 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-git-added hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Provider List - Clean Cards */}
      <div className="space-y-2.5">
        {PROVIDERS.map((provider) => {
          const isWaiting = activeWaitingProvider === provider.id;
          const isUrlExpanded = expandedUrlProvider === provider.id;

          return (
            <div
              key={provider.id}
              className={`p-3.5 rounded-sm border transition-all duration-150 shadow-2xs ${
                isWaiting
                  ? 'bg-base-2 border-commito-coral ring-1 ring-commito-coral/30'
                  : 'bg-base-1 border-border hover:border-border-strong hover:bg-base-1/80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left: Icon & Info */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-sm ${provider.bgClass} ${provider.borderClass} border flex items-center justify-center ${provider.colorClass} shrink-0`}
                  >
                    {provider.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-text-primary">
                        {provider.name}
                      </span>
                      <span
                        className={`text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border ${provider.bgClass} ${provider.borderClass} ${provider.colorClass}`}
                      >
                        {provider.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                      {provider.description}
                    </p>
                  </div>
                </div>

                {/* Right: 1-Click Sign In Button */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isWaiting ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-commito-coral/15 text-commito-coral border border-commito-coral/40 rounded-sm text-xs font-semibold animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Waiting for browser...</span>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelWaiting}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant={provider.btnVariant}
                      size="sm"
                      onClick={() => handleSignIn(provider)}
                      leftIcon={<Globe className="w-3.5 h-3.5" />}
                      rightIcon={<ExternalLink className="w-3 h-3" />}
                    >
                      Sign In with {provider.name}
                    </Button>
                  )}
                </div>
              </div>

              {/* Optional Self-Hosted / Custom URL Toggle */}
              <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedUrlProvider(isUrlExpanded ? null : provider.id)
                  }
                  className="text-[10.5px] text-text-muted hover:text-text-primary flex items-center gap-1 self-start cursor-pointer transition font-medium"
                >
                  <span>Self-hosted / Enterprise URL</span>
                  {isUrlExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {isUrlExpanded && (
                  <div className="p-2 bg-base-0 border border-border rounded-sm flex items-center gap-2 animate-in fade-in duration-100">
                    <span className="text-[11px] font-medium text-text-secondary shrink-0">
                      Instance URL:
                    </span>
                    <input
                      type="url"
                      value={customUrls[provider.id]}
                      onChange={(e) =>
                        setCustomUrls({
                          ...customUrls,
                          [provider.id]: e.target.value,
                        })
                      }
                      placeholder={provider.defaultUrl}
                      className="flex-1 bg-transparent border-none text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Footer Note */}
      <div className="flex items-start justify-center gap-2 py-2 px-3 bg-base-1/50 border border-border/60 rounded-sm text-[10.5px] text-text-muted text-center shadow-2xs">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          Secure OAuth 2.0 PKCE authentication in your default browser — credentials stored securely in OS keyring.
        </span>
      </div>
    </div>
  );
};

