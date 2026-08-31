import React, { useState, useEffect } from 'react';
import {
  Check,
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
import { Tabs } from '../common/Tabs';
import {
  TokenSignInDialog,
  ProviderConfig,
  ProviderKey,
} from '../../features/account-services/components/TokenSignInDialog';
import { TelemetryService } from '../../services/telemetry/telemetryService';

interface OnboardingScreenProps {
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

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
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

    TelemetryService.registerOnboarding(cleanName, cleanEmail || undefined).catch(() => {});

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
    <div className="h-full w-full bg-base-0 flex flex-col items-center justify-center p-6 select-none font-sans overflow-y-auto animate-in fade-in duration-200">
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
          className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setShowTermsModal(null)}
        >
          <div
            className="w-full max-w-2xl bg-base-1 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + tabs combined into one compact bar */}
            <div className="px-4.5 py-2 bg-base-1 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-text-primary leading-none">
                    CyronicStudio · GitDesktop
                  </h3>
                </div>
                <Tabs<'terms' | 'privacy'>
                  tabs={[
                    { id: 'terms', label: 'Terms of Service' },
                    { id: 'privacy', label: 'Privacy Policy' },
                  ]}
                  activeTab={showTermsModal}
                  onChange={setShowTermsModal}
                  size="xs"
                  variant="coral"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(null)}
                className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4.5 text-xs text-text-secondary leading-relaxed space-y-4 font-sans select-text bg-base-0">
              {showTermsModal === 'terms' ? (
                <>
                  <p className="text-[10.5px] text-text-muted">
                    Last updated: August 2026 &nbsp;·&nbsp; Effective immediately upon installation
                  </p>

                  <DocSection title="1. Acceptance of Terms">
                    By downloading, installing, accessing, or using GitDesktop (the
                    &quot;Software&quot;) published by CyronicStudio, you confirm that you have
                    read, understood, and agree to be bound by these Terms of Service and our
                    Privacy Policy. If you do not agree, you must uninstall and cease use of the
                    Software immediately.
                  </DocSection>

                  <DocSection title="2. License Grant">
                    CyronicStudio grants you a personal, non-exclusive, non-transferable, revocable
                    licence to install and run GitDesktop on devices you own or control, solely for
                    lawful Git version-control workflows. You may not sublicense, sell, rebrand, or
                    distribute the Software or any portion thereof without prior written consent from
                    CyronicStudio.
                  </DocSection>

                  <DocSection title="3. Local-First Architecture">
                    GitDesktop is a client-side desktop application. All Git read/write operations
                    — including clones, fetches, commits, pushes, merges, and rebases — are
                    executed directly between your local machine and your chosen remote hosting
                    providers (GitHub, GitLab, Bitbucket, Azure DevOps, or self-hosted servers).
                    CyronicStudio does not proxy, intercept, or store your repository data.
                  </DocSection>

                  <DocSection title="4. Prohibited Uses">
                    You agree not to use the Software to: (a) infringe third-party intellectual
                    property rights; (b) transmit malware, ransomware, or destructive code;
                    (c) circumvent authentication or access control mechanisms; or (d) violate any
                    applicable local, national, or international law or regulation.
                  </DocSection>

                  <DocSection title="5. User Responsibilities">
                    By using GitDesktop you accept sole responsibility for:
                    <ul className="mt-2 space-y-1.5 list-none">
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted shrink-0 font-mono text-[10px] mt-0.5">—</span>
                        <span><strong className="text-text-primary">Repository integrity</strong> — all commits, pushes, merges, force-pushes, and history rewrites performed through the Software.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted shrink-0 font-mono text-[10px] mt-0.5">—</span>
                        <span><strong className="text-text-primary">Credential security</strong> — safeguarding your Personal Access Tokens, SSH keys, and OAuth sessions. Do not share tokens or store them in insecure locations.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted shrink-0 font-mono text-[10px] mt-0.5">—</span>
                        <span><strong className="text-text-primary">Access permissions</strong> — ensuring you have authorisation to read from or write to any remote repository you interact with via the Software.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted shrink-0 font-mono text-[10px] mt-0.5">—</span>
                        <span><strong className="text-text-primary">Backups</strong> — maintaining your own backups of important repositories and local working copies. CyronicStudio is not liable for data loss resulting from Git operations.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-text-muted shrink-0 font-mono text-[10px] mt-0.5">—</span>
                        <span><strong className="text-text-primary">Compliance</strong> — ensuring your use of the Software and any code you manage complies with applicable licences, export controls, and organisational policies.</span>
                      </li>
                    </ul>
                  </DocSection>

                  <DocSection title="6. Third-Party Services">
                    GitDesktop integrates with third-party Git hosting platforms and optional AI
                    providers. Your use of those services is governed by their own terms of service.
                    CyronicStudio is not responsible for third-party service availability, data
                    handling, or outages.
                  </DocSection>

                  <DocSection title="7. Updates & Changes">
                    CyronicStudio may release updates to the Software or these Terms at any time.
                    Continued use of GitDesktop after an update constitutes acceptance of the
                    revised Terms. Material changes will be communicated via in-app notifications
                    or our Discord server.
                  </DocSection>

                  <DocSection title="8. Disclaimer of Warranties">
                    The Software is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot;
                    without warranties of any kind, express or implied, including but not limited to
                    merchantability, fitness for a particular purpose, or non-infringement.
                    CyronicStudio does not warrant that the Software will be error-free or
                    uninterrupted.
                  </DocSection>

                  <DocSection title="9. Limitation of Liability">
                    To the fullest extent permitted by applicable law, CyronicStudio and its
                    contributors shall not be liable for any indirect, incidental, special,
                    consequential, or punitive damages arising from your use of or inability to use
                    the Software, including loss of data, profits, or business goodwill.
                  </DocSection>

                  <DocSection title="10. Governing Law">
                    These Terms are governed by and construed in accordance with the laws of the
                    jurisdiction in which CyronicStudio operates, without regard to conflict-of-law
                    principles. Any disputes shall be subject to the exclusive jurisdiction of the
                    courts in that jurisdiction.
                  </DocSection>

                  <DocSection title="11. Contact">
                    For legal enquiries, please contact us at{' '}
                    <a
                      href={`mailto:${import.meta.env.VITE_CYRONIC_SUPPORT_EMAIL ?? 'support@cyronicstudio.com'}`}
                      className="text-commito-coral hover:underline"
                    >
                      {import.meta.env.VITE_CYRONIC_SUPPORT_EMAIL ?? 'support@cyronicstudio.com'}
                    </a>
                    .
                  </DocSection>
                </>
              ) : (
                <>
                  <p className="text-[10.5px] text-text-muted">
                    Last updated: August 2026 &nbsp;·&nbsp; Effective immediately upon installation
                  </p>

                  <DocSection title="1. Our Core Commitment — Zero Code Collection">
                    <strong className="text-text-primary">
                      CyronicStudio never inspects, reads, copies, transmits, or sells your source
                      code, file contents, diffs, commit messages, branch names, repository
                      structure, or credentials.
                    </strong>{' '}
                    All Git data is processed exclusively on your local machine and travels only to
                    the remote hosting provider you explicitly configure.
                  </DocSection>

                  <DocSection title="2. What We Collect and Why">
                    We collect the absolute minimum data required to operate and improve GitDesktop.
                    There are exactly two data-collection events:
                    <ul className="mt-2 space-y-2 list-none">
                      <li className="flex items-start gap-2">
                        <span className="text-commito-coral font-bold font-mono text-[10px] mt-0.5 shrink-0">A.</span>
                        <span>
                          <strong className="text-text-primary">App-launch heartbeat</strong> — On
                          every cold start, GitDesktop sends an anonymous ping to our private
                          telemetry server containing only: a randomly-generated installation ID
                          (stored locally, never linked to you personally), the app version, and
                          the OS platform name (e.g. &quot;windows&quot;). This lets us count
                          active users and prioritise platform support. <em>No personal data is
                          included.</em>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-commito-coral font-bold font-mono text-[10px] mt-0.5 shrink-0">B.</span>
                        <span>
                          <strong className="text-text-primary">Onboarding registration</strong> —
                          When you complete the onboarding screen, we transmit your chosen display
                          name and email address to register your download. This data is used solely
                          to count new installs, send critical security announcements, and analyse
                          aggregate download trends. We do{' '}
                          <strong className="text-text-primary">not</strong> share or sell this
                          information to any third party.
                        </span>
                      </li>
                    </ul>
                    <p className="mt-2">
                      <strong className="text-text-primary">Nothing else is collected.</strong>{' '}
                      We do not track usage events, keystrokes, repository names, file paths,
                      network activity, or any other telemetry beyond the two events above.
                    </p>
                  </DocSection>

                  <DocSection title="3. Credential & Token Security">
                    Personal Access Tokens, OAuth access tokens, and any passphrase you enter are
                    stored exclusively in your operating system&apos;s native secure credential
                    store — Windows Credential Manager, macOS Keychain, or the Linux Secret
                    Service (via libsecret). They are never transmitted to CyronicStudio servers.
                  </DocSection>

                  <DocSection title="4. AI Features (Optional & User-Controlled)">
                    If you enable optional AI features (e.g. AI-generated commit messages or
                    release notes), diff summaries are sent directly from your machine to your
                    configured AI provider (such as Google Gemini or OpenAI) using the API key you
                    supply. CyronicStudio does not route, log, or store this traffic.
                  </DocSection>

                  <DocSection title="5. Data Retention & Deletion">
                    The onboarding registration record (display name and email) is retained for up
                    to 24 months to maintain accurate install counts. You may request deletion at
                    any time by emailing{' '}
                    <a
                      href={`mailto:${import.meta.env.VITE_CYRONIC_SUPPORT_EMAIL ?? 'support@cyronicstudio.com'}`}
                      className="text-commito-coral hover:underline"
                    >
                      {import.meta.env.VITE_CYRONIC_SUPPORT_EMAIL ?? 'support@cyronicstudio.com'}
                    </a>{' '}
                    with the subject line &quot;Data Deletion Request&quot;. Anonymous installation
                    IDs are rotated or purged after 12 months of inactivity.
                  </DocSection>

                  <DocSection title="6. Changes to This Policy">
                    We may update this Privacy Policy to reflect changes in our practices or legal
                    requirements. Material changes will be communicated via in-app notification.
                    Continued use of GitDesktop after the effective date constitutes acceptance.
                  </DocSection>
                </>
              )}


            </div>

            {/* Footer */}
            <div className="px-4.5 py-2 bg-base-1 border-t border-border flex items-center justify-between shrink-0">
              {/* Support chips */}
              <div className="flex items-center gap-1.5">
                <SupportLink
                  label="Website"
                  href={import.meta.env.VITE_CYRONIC_WEBSITE_URL ?? 'https://cyronicstudio.com'}
                />
                <SupportLink
                  label="Support"
                  href={`mailto:${import.meta.env.VITE_CYRONIC_SUPPORT_EMAIL ?? 'support@cyronicstudio.com'}`}
                />
                <SupportLink
                  label="Discord"
                  href={import.meta.env.VITE_CYRONIC_DISCORD_URL ?? 'https://discord.gg/cyronicstudio'}
                />
              </div>
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

/* ── Shared helper components for the legal modal ─────────────────────────── */

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-text-primary">{title}</p>
      <div className="text-text-secondary leading-relaxed">{children}</div>
    </div>
  );
}

function SupportLink({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center px-2 py-0.5 rounded-xs bg-base-2 border border-border hover:border-border-strong hover:text-text-primary text-[10.5px] font-medium text-text-secondary transition"
    >
      {label}
    </a>
  );
}
