import React, { useState, useEffect } from 'react';
import {
  Check,
  FileText,
  X,
  ArrowRight,
  ArrowLeft,
  Key,
  Globe,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useAccountServicesStore } from '../../features/account-services/store/accountStore';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';
import { UserAvatar } from '../common/UserAvatar';
import {
  TokenSignInDialog,
  ProviderConfig,
  ProviderKey,
} from '../../features/account-services/components/TokenSignInDialog';

interface OnboardingScreenProps {
  isOpen: boolean;
  onComplete: (name: string, email?: string) => void;
}

const ONBOARDING_PROVIDERS: ProviderConfig[] = [
  {
    id: 'gitlab',
    name: 'GitLab',
    badge: 'Cloud & Self-Hosted',
    defaultUrl: 'https://gitlab.com',
    description: 'Connect to GitLab.com or your self-hosted GitLab server.',
    colorClass: 'text-orange-400',
    borderClass: 'border-orange-800/40',
    bgClass: 'bg-orange-950/40',
  },
  {
    id: 'github',
    name: 'GitHub',
    badge: 'Cloud & Enterprise',
    defaultUrl: 'https://github.com',
    description: 'Connect to GitHub.com or GitHub Enterprise Server.',
    colorClass: 'text-purple-400',
    borderClass: 'border-purple-800/40',
    bgClass: 'bg-purple-950/40',
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    badge: 'Atlassian Cloud',
    defaultUrl: 'https://bitbucket.org',
    description: 'Connect to Atlassian Bitbucket repositories with App Password.',
    colorClass: 'text-blue-400',
    borderClass: 'border-blue-800/40',
    bgClass: 'bg-blue-950/40',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ isOpen, onComplete }) => {
  const { setUser } = useGitStore();
  const { accounts, loadAccounts, startOAuth } = useAccountServicesStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState<'terms' | 'privacy' | null>(null);

  const [tokenDialogProvider, setTokenDialogProvider] = useState<ProviderConfig | null>(null);
  const [waitingOAuthProvider, setWaitingOAuthProvider] = useState<ProviderKey | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Sync listener for background OAuth completion
  useEffect(() => {
    let unlistenSynced: (() => void) | undefined;
    let unlistenErr: (() => void) | undefined;

    listen<any>('oauth-account-synced', async () => {
      await loadAccounts();
      setWaitingOAuthProvider(null);
      setOauthError(null);
    }).then((fn) => {
      unlistenSynced = fn;
    });

    listen<string>('oauth-account-error', (event) => {
      setWaitingOAuthProvider(null);
      setOauthError(event.payload || 'OAuth sign-in failed. Try logging in with a Token.');
    });

    return () => {
      if (unlistenSynced) unlistenSynced();
      if (unlistenErr) unlistenErr();
    };
  }, [loadAccounts]);

  if (!isOpen) return null;

  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !acceptedTerms) return;
    setStep(2);
  };

  const handleFinishOnboarding = () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    try {
      localStorage.setItem('app_onboarded', 'true');
      localStorage.setItem('app_user_display_name', cleanName);
      if (cleanEmail) {
        localStorage.setItem('app_user_email', cleanEmail);
      }
    } catch {
      // ignore localStorage quota errors
    }

    // If an account is already connected, keep it active; otherwise set local identity
    const activeAcc = accounts.find((a) => a.is_active) || accounts[0];
    if (activeAcc) {
      setUser({
        id: activeAcc.id,
        name: activeAcc.display_name || cleanName,
        username: activeAcc.handle.replace(/^@/, ''),
        email: activeAcc.commit_email || cleanEmail || null,
        avatar_url: activeAcc.avatar_url || null,
        web_url: activeAcc.instance_url,
        server_url: activeAcc.instance_url,
        provider: activeAcc.provider,
      });
    } else {
      setUser({
        id: 'local_user',
        name: cleanName,
        username: cleanName.toLowerCase().replace(/\s+/g, '_'),
        email: cleanEmail || null,
        avatar_url: null,
        web_url: '',
        server_url: '',
        provider: 'custom',
      });
    }

    useLogStore
      .getState()
      .addLog(
        'info',
        'System',
        `Welcome to GitDesktop, ${cleanName}! Workspace profile initialized.`
      );

    onComplete(cleanName, cleanEmail || undefined);
  };

  const handleBrowserOAuth = async (provider: ProviderConfig) => {
    setOauthError(null);
    setWaitingOAuthProvider(provider.id);
    try {
      await startOAuth(provider.id, provider.defaultUrl);
    } catch (err: any) {
      setOauthError(err?.message || `Failed to start ${provider.name} browser sign-in.`);
      setWaitingOAuthProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-base-0 flex flex-col items-center justify-center p-6 select-none font-sans overflow-y-auto animate-in fade-in duration-200">
      {/* Background Subtle Gradient Accents */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-40" />

      {/* Main Center Content */}
      <div className="relative w-full max-w-md flex flex-col gap-6 z-10">
        {/* Title */}
        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            {step === 1 ? 'Configure Your Git Identity' : 'Connect Your Git Accounts'}
          </h1>
          <p className="text-xs text-text-secondary">
            {step === 1
              ? 'Set your name and commit email to sign your commits and repository activity.'
              : 'Sign in to your remote Git providers. Personal Access Token is recommended.'}
          </p>
        </div>

        {/* STEP 1: Git Identity & Agreements */}
        {step === 1 && (
          <form onSubmit={handleStep1Continue} className="flex flex-col gap-4">
            {/* Name Field (Required) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-primary flex items-center gap-1">
                <span>Full Name or Nickname</span>
                <span className="text-commito-coral">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Neel Frostrain"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-base-1/80 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition font-sans shadow-2xs"
                autoFocus
              />
            </div>

            {/* Email Field (Optional / Recommended) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-primary">
                  <span>Commit Email</span>
                </label>
                <span className="text-[10px] text-text-muted font-normal">Optional</span>
              </div>
              <input
                type="email"
                placeholder="e.g. you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-base-1/80 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition font-sans shadow-2xs"
              />
            </div>

            {/* Terms of Service Checkbox (Required) */}
            <div className="pt-2 border-t border-border/80 flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  checked={acceptedTerms}
                  onChange={setAcceptedTerms}
                  size="md"
                  className="mt-0.5"
                />
                <div className="text-xs text-text-secondary leading-relaxed">
                  <span>I have read and agree to the </span>
                  <button
                    type="button"
                    onClick={() => setShowTermsModal('terms')}
                    className="text-commito-coral hover:underline font-semibold cursor-pointer"
                  >
                    Terms of Service
                  </button>
                  <span> and </span>
                  <button
                    type="button"
                    onClick={() => setShowTermsModal('privacy')}
                    className="text-commito-coral hover:underline font-semibold cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  <span className="text-commito-coral font-bold"> *</span>
                </div>
              </div>
            </div>

            {/* Submit / Continue Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="coral"
                size="md"
                disabled={!name.trim() || !acceptedTerms}
                className="w-full justify-center shadow-md py-2.5"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Connect Account
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Connect Git Account (Token Recommended) */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            {oauthError && (
              <div className="p-2.5 bg-git-removed-bg border border-git-removed/40 rounded-sm text-xs text-git-removed flex items-center justify-between gap-2">
                <span>{oauthError}</span>
                <button
                  type="button"
                  onClick={() => setOauthError(null)}
                  className="text-git-removed hover:text-text-primary p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Provider List */}
            <div className="flex flex-col gap-2.5">
              {ONBOARDING_PROVIDERS.map((provider) => {
                const connectedAccount = accounts.find(
                  (a) => a.provider.toLowerCase() === provider.id
                );
                const isWaiting = waitingOAuthProvider === provider.id;

                return (
                  <div
                    key={provider.id}
                    className="p-3 bg-base-1/80 border border-border rounded-sm flex items-center justify-between gap-3 hover:border-border-strong transition"
                  >
                    {/* Left: Name & Status */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text-primary">
                          {provider.name}
                        </span>
                        <span className="text-[9.5px] font-mono text-text-muted">
                          {provider.badge}
                        </span>
                      </div>
                      {connectedAccount ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-git-added font-semibold mt-0.5">
                          <UserAvatar
                            url={connectedAccount.avatar_url}
                            name={connectedAccount.display_name}
                            handle={connectedAccount.handle}
                            provider={connectedAccount.provider}
                            className="w-4 h-4 rounded-full"
                            iconClassName="w-2.5 h-2.5"
                          />
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Connected ({connectedAccount.handle})</span>
                        </div>
                      ) : (
                        <p className="text-[10.5px] text-text-muted truncate mt-0.5">
                          {provider.description}
                        </p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {connectedAccount ? (
                        <span className="px-2 py-0.8 bg-git-added-bg border border-git-added/30 text-git-added text-[10px] font-bold rounded-xs flex items-center gap-1 font-mono">
                          <Check className="w-3 h-3" />
                          Ready
                        </span>
                      ) : isWaiting ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-commito-coral/10 text-commito-coral border border-commito-coral/30 rounded-xs text-[10.5px] font-mono font-bold animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Waiting...</span>
                        </div>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="coral"
                            size="xs"
                            onClick={() => setTokenDialogProvider(provider)}
                            leftIcon={<Key className="w-3 h-3" />}
                            title="Sign in with Personal Access Token (Recommended)"
                          >
                            Use Token
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => handleBrowserOAuth(provider)}
                            leftIcon={<Globe className="w-3 h-3" />}
                            title="Sign in using your default web browser"
                          >
                            Browser
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setStep(1)}
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Back
              </Button>

              <div className="flex items-center gap-2">
                {accounts.length === 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleFinishOnboarding}
                  >
                    Skip for Now
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="coral"
                    size="md"
                    onClick={handleFinishOnboarding}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Finish & Get Started ({accounts.length} Connected)
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Embedded Terms of Service & Privacy Policy Modal */}
      {showTermsModal && (
        <div
          className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowTermsModal(null)}
        >
          <div
            className="w-full max-w-lg bg-base-1 border border-border rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-base-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-commito-coral" />
                <h3 className="text-xs font-bold text-text-primary">
                  {showTermsModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(null)}
                className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-3 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Content */}
            <div className="p-4 overflow-y-auto text-xs text-text-secondary leading-relaxed space-y-3 font-sans">
              {showTermsModal === 'terms' ? (
                <>
                  <p className="font-semibold text-text-primary">1. Acceptance of Terms</p>
                  <p>
                    By downloading, installing, or using GitDesktop, you agree to comply with and be
                    bound by these Terms of Service. If you do not agree to these terms, do not use
                    the application.
                  </p>
                  <p className="font-semibold text-text-primary">2. Local Data & Git Operations</p>
                  <p>
                    GitDesktop operates as a client-side Git management desktop tool. All Git
                    operations, credentials, and local commits are processed on your local device
                    and directly between your computer and your configured Git hosting providers
                    (e.g. GitHub, GitLab, Bitbucket).
                  </p>
                  <p className="font-semibold text-text-primary">3. User Responsibility</p>
                  <p>
                    You are solely responsible for all Git repositories, code commits, branch
                    pushes, and credentials managed using this application.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-text-primary">
                    1. Privacy First & Local Storage
                  </p>
                  <p>
                    GitDesktop does not sell or distribute your personal source code. Repository
                    data, commit history, and personal settings remain stored on your local disk.
                  </p>
                  <p className="font-semibold text-text-primary">2. Authentication & Credentials</p>
                  <p>
                    Authentication tokens (such as GitHub, GitLab, or Bitbucket Personal Access Tokens)
                    are stored securely in your operating system's native credential manager.
                  </p>
                  <p className="font-semibold text-text-primary">3. AI Services (Optional)</p>
                  <p>
                    When using optional AI features (such as AI commit message generation), diff
                    snippets are processed securely via your chosen API provider strictly for
                    generating summaries.
                  </p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-base-2 border-t border-border flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowTermsModal(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Token Sign-In Dialog Modal */}
      {tokenDialogProvider && (
        <TokenSignInDialog
          isOpen={Boolean(tokenDialogProvider)}
          provider={tokenDialogProvider}
          initialInstanceUrl={tokenDialogProvider.defaultUrl}
          onClose={() => setTokenDialogProvider(null)}
          onSuccess={async () => {
            await loadAccounts();
            setTokenDialogProvider(null);
          }}
        />
      )}
    </div>
  );
};
