import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ExternalLink,
  Loader2,
  Check,
  Copy,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  User,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAccountServicesStore } from '../store/accountStore';
import { Button } from '../../../components/common/Button';
import { ProviderAccount } from '../types';

export type ProviderKey = 'gitlab' | 'github' | 'bitbucket' | 'azure';

export interface ProviderConfig {
  id: ProviderKey;
  name: string;
  badge: string;
  defaultUrl: string;
  description: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  icon?: React.ReactNode;
}

interface ScopeItem {
  name: string;
  description: string;
  required?: boolean;
}

interface TokenSignInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ProviderConfig | null;
  initialInstanceUrl?: string;
  onSuccess?: (account: ProviderAccount) => void;
}

const PROVIDER_SCOPES: Record<ProviderKey, ScopeItem[]> = {
  gitlab: [
    { name: 'api', description: 'Full API access to read & write projects, MRs, and pipelines', required: true },
    { name: 'read_user', description: 'Read user profile details and commit email', required: true },
    { name: 'read_repository', description: 'Pull and clone repositories', required: true },
    { name: 'write_repository', description: 'Push commits, branches, and tags', required: true },
  ],
  github: [
    { name: 'repo', description: 'Full control of private and public repositories, cloning, and pushing', required: true },
    { name: 'read:user', description: 'Read user profile and public organizations', required: true },
    { name: 'user:email', description: 'Access user primary verified email address', required: true },
    { name: 'workflow', description: 'Allows updating GitHub Actions workflow definitions', required: false },
  ],
  bitbucket: [
    { name: 'Account: Read', description: 'Access user profile and email address', required: true },
    { name: 'Repositories: Read & Write', description: 'Clone, pull, commit, and push repositories', required: true },
    { name: 'Pull requests: Read & Write', description: 'Inspect, create, and review Pull Requests', required: true },
  ],
  azure: [
    { name: 'Code: Read & Write', description: 'Access, clone, commit, and manage Git repositories & PRs', required: true },
    { name: 'Project & Team: Read', description: 'Read organization projects and team membership', required: false },
  ],
};

export const TokenSignInDialog: React.FC<TokenSignInDialogProps> = ({
  isOpen,
  onClose,
  provider,
  initialInstanceUrl,
  onSuccess,
}) => {
  const { connectWithToken, loadAccounts } = useAccountServicesStore();

  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [instanceUrl, setInstanceUrl] = useState(
    initialInstanceUrl || provider?.defaultUrl || 'https://gitlab.com'
  );
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedScope, setCopiedScope] = useState<string | null>(null);
  const [showScopeList, setShowScopeList] = useState(false);

  useEffect(() => {
    if (provider) {
      setInstanceUrl(initialInstanceUrl || provider.defaultUrl);
      setToken('');
      setUsername('');
      setError(null);
      setShowToken(false);
    }
  }, [provider, initialInstanceUrl]);

  if (!isOpen || !provider) return null;

  const scopes = PROVIDER_SCOPES[provider.id] || [];

  const getGenerateUrl = (): string => {
    const cleanUrl = (instanceUrl || provider.defaultUrl).trim().replace(/\/+$/, '');
    if (provider.id === 'gitlab') {
      return `${cleanUrl}/-/user_settings/personal_access_tokens`;
    }
    if (provider.id === 'github') {
      if (cleanUrl.includes('github.com')) {
        return 'https://github.com/settings/tokens/new?description=GitDesktop&scopes=repo,read:user,user:email,workflow';
      }
      return `${cleanUrl}/settings/tokens/new?description=GitDesktop&scopes=repo,read:user,user:email,workflow`;
    }
    if (provider.id === 'bitbucket') {
      return 'https://bitbucket.org/account/settings/app-passwords/';
    }
    if (provider.id === 'azure') {
      const clean = (instanceUrl || provider.defaultUrl).trim().replace(/\/+$/, '');
      try {
        const parsed = new URL(clean);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          return `${parsed.origin}/${pathParts[0]}/_usersSettings/tokens`;
        }
      } catch {}
      return 'https://aex.dev.azure.com/me';
    }
    return cleanUrl;
  };

  const handleOpenTokenSettings = async () => {
    try {
      const url = getGenerateUrl();
      await openUrl(url);
    } catch {
      window.open(getGenerateUrl(), '_blank');
    }
  };

  const handleCopyScope = (scopeName: string) => {
    navigator.clipboard.writeText(scopeName);
    setCopiedScope(scopeName);
    setTimeout(() => setCopiedScope(null), 1800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter your Personal Access Token.');
      return;
    }

    if (provider.id === 'bitbucket' && !username.trim()) {
      setError('Please enter your Bitbucket Username for App Password authentication.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const account = await connectWithToken(
        provider.id,
        token.trim(),
        instanceUrl.trim(),
        username.trim() || undefined
      );

      await loadAccounts();
      if (onSuccess) onSuccess(account);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate with the provided token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 font-sans">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <span>Sign In to {provider.name}</span>
              <span
                className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-xs border ${provider.bgClass} ${provider.borderClass} ${provider.colorClass}`}
              >
                Personal Token
              </span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-4 space-y-4 bg-base-0 flex-1">
          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-git-removed-bg border border-git-removed/40 rounded-sm text-xs text-git-removed flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Quick Action: Open Provider Token Settings */}
          <div className="p-3.5 bg-base-1/80 border border-border rounded-sm space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-commito-coral" />
                  <span>Step 1: Generate Access Token</span>
                </h4>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {provider.id === 'bitbucket'
                    ? 'Generate an App Password from your Bitbucket Settings.'
                    : provider.id === 'azure'
                      ? 'Generate a Personal Access Token (PAT) from your Azure DevOps Organization.'
                      : `Create a Personal Access Token on ${provider.name}.`}
                </p>
              </div>

              <Button
                type="button"
                variant="coral"
                size="xs"
                onClick={handleOpenTokenSettings}
                rightIcon={<ExternalLink className="w-3 h-3 opacity-80" />}
              >
                Open Token Page
              </Button>
            </div>

            {/* Provider-Specific Step-by-Step Instructions */}
            {provider.id === 'azure' && (
              <div className="pt-2 border-t border-border/60 text-[11px] text-text-secondary space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">1.</span>
                  <span>Click <strong>Open Token Page</strong> to open your Azure DevOps Personal Access Tokens page.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">2.</span>
                  <span>Click <strong>+ New Token</strong> and set Name as <strong>GitDesktop</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">3.</span>
                  <span>Under <strong>Organization</strong>, ensure your organization is selected, and set <strong>Expiration</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">4.</span>
                  <span>Under <strong>Scopes</strong>, select <strong>Code (Read & Write)</strong> to enable cloning, commits, and Pull Requests.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">5.</span>
                  <span>Click <strong>Create</strong>, copy the generated token string, and paste it into the field below.</span>
                </div>
              </div>
            )}

            {provider.id === 'gitlab' && (
              <div className="pt-2 border-t border-border/60 text-[11px] text-text-secondary space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">1.</span>
                  <span>Click <strong>Open Token Page</strong> to navigate to User Settings &gt; Access Tokens.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">2.</span>
                  <span>Set token name as <strong>GitDesktop</strong> and clear or choose an Expiration date.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">3.</span>
                  <span>Check scopes: <strong>api</strong>, <strong>read_user</strong>, <strong>read_repository</strong>, and <strong>write_repository</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">4.</span>
                  <span>Click <strong>Create personal access token</strong>, copy the token, and paste it below.</span>
                </div>
              </div>
            )}

            {provider.id === 'github' && (
              <div className="pt-2 border-t border-border/60 text-[11px] text-text-secondary space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">1.</span>
                  <span>Click <strong>Open Token Page</strong> to open GitHub Personal Access Tokens (Classic).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">2.</span>
                  <span>Set Note as <strong>GitDesktop</strong> and select your preferred Expiration.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">3.</span>
                  <span>Select scopes: <strong>repo</strong>, <strong>read:user</strong>, <strong>user:email</strong>, and <strong>workflow</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">4.</span>
                  <span>Click <strong>Generate token</strong>, copy the generated token, and paste it below.</span>
                </div>
              </div>
            )}

            {provider.id === 'bitbucket' && (
              <div className="pt-2 border-t border-border/60 text-[11px] text-text-secondary space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">1.</span>
                  <span>Click <strong>Open Token Page</strong> to open Bitbucket Personal Settings &gt; App Passwords.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">2.</span>
                  <span>Click <strong>Create app password</strong> and label it <strong>GitDesktop</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">3.</span>
                  <span>Check permissions: <strong>Account (Read)</strong>, <strong>Repositories (Read & Write)</strong>, and <strong>Pull requests (Read & Write)</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-commito-coral text-[10px] w-4 text-right">4.</span>
                  <span>Click <strong>Create</strong>, copy the password, and enter your Bitbucket Username and App Password below.</span>
                </div>
              </div>
            )}
          </div>

          {/* Required Scopes Collapsible Card */}
          <div className="border border-border rounded-sm bg-base-1/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowScopeList(!showScopeList)}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-base-1 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">
                  Required Permission Scopes
                </span>
                <span className="chip chip-stat text-[9.5px]">
                  {scopes.length} Scopes
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-muted">
                <span>{showScopeList ? 'Hide' : 'View Scopes'}</span>
                {showScopeList ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {showScopeList && (
              <div className="p-3 border-t border-border/80 space-y-2 bg-base-0/60 animate-in fade-in duration-100">
                <div className="space-y-1.5">
                  {scopes.map((scope) => (
                    <div
                      key={scope.name}
                      className="flex items-center justify-between gap-2 p-1.5 bg-base-1 rounded-xs border border-border/60 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10.5px] font-bold text-commito-coral bg-commito-coral/10 px-1.5 py-0.2 rounded-xs border border-commito-coral/20">
                          {scope.name}
                        </span>
                        <span className="text-[11px] text-text-muted truncate">
                          {scope.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {scope.required && (
                          <span className="text-[9.5px] font-semibold text-git-added">
                            Required
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyScope(scope.name)}
                          className="p-1 text-text-muted hover:text-text-primary transition cursor-pointer"
                          title="Copy scope name"
                        >
                          {copiedScope === scope.name ? (
                            <Check className="w-3 h-3 text-git-added" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <form id="token-signin-form" onSubmit={handleSubmit} className="space-y-3 pt-1">
            {/* Instance / Host URL */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-text-muted" />
                <span>Instance / Host URL</span>
              </label>
              <input
                type="url"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                placeholder={provider.defaultUrl}
                className="w-full bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm px-2.5 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted/50 focus:outline-none transition"
                required
              />
            </div>

            {/* Bitbucket Username (if Bitbucket) */}
            {provider.id === 'bitbucket' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-text-muted" />
                  <span>Bitbucket Username</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. john_doe"
                  className="w-full bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm px-2.5 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted/50 focus:outline-none transition"
                  required
                />
                <p className="text-[10.5px] text-text-muted">
                  Your Bitbucket username is required for App Password authentication.
                </p>
              </div>
            )}

            {/* Personal Access Token */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-text-muted" />
                  <span>
                    {provider.id === 'bitbucket' ? 'App Password' : 'Personal Access Token'}
                  </span>
                </span>
                <span className="text-[10px] text-text-muted font-normal">
                  Stored securely in OS keyring
                </span>
              </label>

              <div className="relative flex items-center">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={
                    provider.id === 'gitlab'
                      ? 'glpat-xxxxxxxxxxxxxxxxxxxx'
                      : provider.id === 'github'
                        ? 'ghp_xxxxxxxxxxxxxxxxxxxx'
                        : provider.id === 'azure'
                          ? 'Enter Azure DevOps PAT (e.g. 52-char token)'
                          : 'Enter Bitbucket App Password'
                  }
                  className="w-full bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm px-2.5 py-1.5 pr-9 text-xs text-text-primary font-mono placeholder:text-text-muted/40 focus:outline-none transition"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 text-text-muted hover:text-text-primary transition cursor-pointer p-0.5"
                  title={showToken ? 'Hide Token' : 'Show Token'}
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-border bg-base-1 flex items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="token-signin-form"
            variant="coral"
            size="sm"
            disabled={isSubmitting || !token.trim()}
            leftIcon={
              isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Key className="w-3.5 h-3.5" />
              )
            }
          >
            {isSubmitting ? 'Authenticating...' : 'Connect Account'}
          </Button>
        </div>
      </div>
    </div>
  );
};
