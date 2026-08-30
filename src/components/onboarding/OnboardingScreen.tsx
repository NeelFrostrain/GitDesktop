import React, { useState } from 'react';
import { Check, FileText, X } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';

interface OnboardingScreenProps {
  isOpen: boolean;
  onComplete: (name: string, email?: string) => void;
}

/**
 * Solid full-background first-time user onboarding screen.
 * Captures display name, optional email, and requires accepting Terms & Privacy Policy.
 */
export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ isOpen, onComplete }) => {
  const { setUser } = useGitStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState<'terms' | 'privacy' | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !acceptedTerms) return;

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    // Persist onboarding state in localStorage
    try {
      localStorage.setItem('app_onboarded', 'true');
      localStorage.setItem('app_user_display_name', cleanName);
      if (cleanEmail) {
        localStorage.setItem('app_user_email', cleanEmail);
      }
    } catch {
      // ignore localStorage quota errors
    }

    // Set active workspace user
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

    useLogStore
      .getState()
      .addLog('info', 'System', `Welcome to GitDesktop, ${cleanName}! Workspace profile initialized.`);

    onComplete(cleanName, cleanEmail || undefined);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-base-0 flex flex-col items-center justify-center p-6 select-none font-sans overflow-y-auto animate-in fade-in duration-200">
      {/* Background Subtle Gradient Accents */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-40" />

      {/* Main Center Content */}
      <div className="relative w-full max-w-md flex flex-col gap-6 z-10">
        {/* Profile Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              className="w-full px-3 py-2 bg-base-1/80 border border-border hover:border-border-strong focus:border-gitlab-teal rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition font-sans shadow-2xs"
            />
          </div>

          {/* Terms and Privacy Policy Checkbox (Required) */}
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

          {/* Submit / Get Started Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="coral"
              size="md"
              disabled={!name.trim() || !acceptedTerms}
              className="w-full justify-center shadow-md py-2.5"
              leftIcon={<Check className="w-4 h-4" />}
            >
              Get Started
            </Button>
          </div>
        </form>
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
                  <p className="font-semibold text-text-primary">
                    1. Acceptance of Terms
                  </p>
                  <p>
                    By downloading, installing, or using GitDesktop, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, do not use the application.
                  </p>
                  <p className="font-semibold text-text-primary">
                    2. Local Data & Git Operations
                  </p>
                  <p>
                    GitDesktop operates as a client-side Git management desktop tool. All Git operations, credentials, and local commits are processed on your local device and directly between your computer and your configured Git hosting providers (e.g. GitHub, GitLab).
                  </p>
                  <p className="font-semibold text-text-primary">
                    3. User Responsibility
                  </p>
                  <p>
                    You are solely responsible for all Git repositories, code commits, branch pushes, and credentials managed using this application.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-text-primary">
                    1. Privacy First & Local Storage
                  </p>
                  <p>
                    GitDesktop does not sell or distribute your personal source code. Repository data, commit history, and personal settings remain stored on your local disk.
                  </p>
                  <p className="font-semibold text-text-primary">
                    2. Authentication & Credentials
                  </p>
                  <p>
                    Authentication tokens (such as GitHub or GitLab Personal Access Tokens) are stored securely in your operating system's native credential manager or local application vault.
                  </p>
                  <p className="font-semibold text-text-primary">
                    3. AI Services (Optional)
                  </p>
                  <p>
                    When using optional AI features (such as AI commit message generation), diff snippets are processed securely via your chosen API provider strictly for generating summaries.
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
    </div>
  );
};
