import React, { useState, useEffect } from 'react';
import {
  Loader2,
  Globe,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  Key,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useAccountServicesStore } from '../store/accountStore';
import { Button } from '../../../components/common/Button';
import { TokenSignInDialog, ProviderConfig, ProviderKey } from './TokenSignInDialog';

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'gitlab',
    name: 'GitLab',
    badge: 'Cloud & Self-Hosted',
    defaultUrl: 'https://gitlab.com',
    description: 'Sign in securely via GitLab.com or your organization’s self-hosted instance.',
    colorClass: 'text-orange-400',
    borderClass: 'border-orange-800/40',
    bgClass: 'bg-orange-950/40',
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
  },
];

export const ProviderPickerCard: React.FC = () => {
  const { accounts, startOAuth, loadAccounts } = useAccountServicesStore();

  const [activeWaitingProvider, setActiveWaitingProvider] = useState<ProviderKey | null>(null);
  const [tokenDialogProvider, setTokenDialogProvider] = useState<ProviderConfig | null>(null);
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
        setSuccessMsg(
          `Successfully signed in as ${event.payload.handle || event.payload.display_name}!`
        );
      }
    }).then((fn) => {
      unlistenSynced = fn;
    });

    listen<string>('oauth-account-error', (event) => {
      setActiveWaitingProvider(null);
      setError(event.payload || 'OAuth authentication failed');
      setSuccessMsg(null);
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
        <div className="p-2.5 bg-git-removed-bg border border-git-removed/40 rounded-sm text-xs text-git-removed flex items-center justify-between gap-2 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-git-removed hover:opacity-75 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 bg-git-added-bg border border-git-added/40 rounded-sm text-xs text-git-added flex items-center justify-between gap-2 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-git-added hover:opacity-75 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Provider List */}
      <div className="space-y-2">
        {PROVIDERS.map((provider) => {
          const isWaiting = activeWaitingProvider === provider.id;
          const isUrlExpanded = expandedUrlProvider === provider.id;

          return (
            <div
              key={provider.id}
              className={`p-3 rounded-sm border transition-all duration-150 select-none ${
                isWaiting
                  ? 'bg-base-1 border-border-strong shadow-xs'
                  : 'bg-base-1/50 border-border hover:border-border-strong hover:bg-base-1/90'
              }`}
            >
              <div className="flex items-center justify-between gap-3.5">
                {/* Left: Info */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-text-primary">
                      {provider.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-xs border ${provider.bgClass} ${provider.borderClass} ${provider.colorClass}`}
                    >
                      {provider.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-tight truncate">
                    {provider.description}
                  </p>
                </div>

                {/* Right: 1-Click Sign In Button / Waiting CTA */}
                <div className="flex items-center gap-2 shrink-0">
                  {isWaiting ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-commito-coral/10 text-commito-coral border border-commito-coral/30 rounded-xs text-[11px] font-mono font-bold animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Waiting for browser...</span>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={handleCancelWaiting}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setTokenDialogProvider(provider)}
                        leftIcon={<Key className="w-3.5 h-3.5" />}
                        title={`Sign in to ${provider.name} using a Personal Access Token`}
                      >
                        Use Token
                      </Button>
                      <Button
                        type="button"
                        variant="coral"
                        size="sm"
                        onClick={() => handleSignIn(provider)}
                        leftIcon={<Globe className="w-3.5 h-3.5" />}
                        title={`Sign in to ${provider.name} using your web browser`}
                      >
                        Browser
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Self-Hosted / Custom URL Toggle */}
              <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpandedUrlProvider(isUrlExpanded ? null : provider.id)}
                  className="text-[10.5px] text-text-muted hover:text-text-primary flex items-center gap-1 self-start cursor-pointer transition font-mono"
                >
                  <span>Self-hosted / Enterprise URL</span>
                  {isUrlExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {isUrlExpanded && (
                  <div className="p-2 bg-base-2 border border-border rounded-xs flex items-center gap-2 animate-in fade-in duration-100 mt-0.5">
                    <span className="text-[11px] font-medium text-text-secondary shrink-0 font-mono">
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
                      className="flex-1 bg-transparent border-none text-xs font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Footer Note */}
      <div className="flex items-center justify-start gap-2 py-2 px-3 bg-base-1/40 border border-border rounded-sm text-[11px] text-text-muted text-center">
        <span>
          Secure OAuth 2.0 PKCE authentication in your default browser or direct Personal Access Token login — credentials stored in your operating system's keyring.
        </span>
      </div>

      {/* Personal Access Token Dialog */}
      {tokenDialogProvider && (
        <TokenSignInDialog
          isOpen={Boolean(tokenDialogProvider)}
          provider={tokenDialogProvider}
          initialInstanceUrl={customUrls[tokenDialogProvider.id]}
          onClose={() => setTokenDialogProvider(null)}
          onSuccess={(account) => {
            setSuccessMsg(
              `Successfully connected ${tokenDialogProvider.name} account (${account.handle})!`
            );
            setTokenDialogProvider(null);
          }}
        />
      )}
    </div>
  );
};
