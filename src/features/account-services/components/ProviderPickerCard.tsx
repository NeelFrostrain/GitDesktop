import React, { useState } from 'react';
import { ExternalLink, Loader2, ArrowRight } from 'lucide-react';
import { useAccountServicesStore } from '../store/accountStore';

export const ProviderPickerCard: React.FC = () => {
  const { startOAuth } = useAccountServicesStore();
  const [selectedProvider, setSelectedProvider] = useState<'gitlab' | 'github'>('gitlab');
  const [instanceUrl, setInstanceUrl] = useState('https://gitlab.com');
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProviderSelect = (provider: 'gitlab' | 'github') => {
    setSelectedProvider(provider);
    if (provider === 'gitlab') {
      setInstanceUrl('https://gitlab.com');
    } else {
      setInstanceUrl('https://github.com');
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsWaiting(true);
    try {
      await startOAuth(selectedProvider, instanceUrl);
    } catch (err: any) {
      setError(err?.message || 'Failed to start browser sign-in');
      setIsWaiting(false);
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* Provider Tiles */}
      <div className="grid grid-cols-3 gap-3.5">
        {/* GitLab Tile */}
        <div
          onClick={() => handleProviderSelect('gitlab')}
          className={`p-4 rounded-sm border transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 ${selectedProvider === 'gitlab'
            ? 'bg-base-2 border-gitlab-orange ring-2 ring-gitlab-orange/20 shadow-md'
            : 'bg-base-2/50 border-border hover:border-border-strong hover:bg-base-2'
            }`}
        >
          <div className="w-10 h-10 rounded-sm bg-gitlab-orange/15 flex items-center justify-center text-gitlab-orange">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="m23.6 9.6-2.1-6.5c-.2-.6-.9-.9-1.5-.6l-4.5 3.3H8.5L4 2.5C3.4 2.2 2.7 2.5 2.5 3.1L.4 9.6c-.2.5 0 1.1.4 1.4L12 19.8l11.2-8.8c.4-.3.6-.9.4-1.4z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-text-primary">GitLab</div>
            <div className="text-[10px] text-text-muted">Cloud & Self-Hosted</div>
          </div>
        </div>

        {/* GitHub Tile */}
        <div
          onClick={() => handleProviderSelect('github')}
          className={`p-4 rounded-sm border transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 ${selectedProvider === 'github'
            ? 'bg-base-2 border-text-primary ring-2 ring-white/10 shadow-md'
            : 'bg-base-2/50 border-border hover:border-border-strong hover:bg-base-2'
            }`}
        >
          <div className="w-10 h-10 rounded-sm bg-base-3 flex items-center justify-center text-text-primary">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-text-primary">GitHub</div>
            <div className="text-[10px] text-text-muted">Cloud & Enterprise</div>
          </div>
        </div>

        {/* More Coming Soon Tile */}
        <div className="p-4 rounded-sm border border-dashed border-border bg-base-2/20 opacity-50 flex flex-col items-center justify-center text-center space-y-2.5 cursor-not-allowed">
          <div className="w-10 h-10 rounded-sm bg-base-3 flex items-center justify-center text-text-muted text-xs font-bold font-mono">
            +
          </div>
          <div>
            <div className="text-xs font-bold text-text-muted">More Providers</div>
            <div className="text-[10px] text-text-faint">Bitbucket, Gitea...</div>
          </div>
        </div>
      </div>

      {/* Configuration & Continue Form */}
      <form onSubmit={handleContinue} className="p-4 bg-base-2/40 border border-border rounded-sm space-y-4">
        {error && (
          <div className="p-2.5 bg-git-removed-bg border border-git-removed/40 rounded-sm text-xs text-git-removed">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
            <span>Instance Server URL</span>
            <span className="text-[10px] text-text-muted font-normal">
              Change for private/self-hosted instances
            </span>
          </label>
          <input
            type="url"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
            placeholder="https://gitlab.com"
            className="w-full bg-base-1 border border-border rounded-sm px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition"
            required
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] text-text-muted flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-commito-coral" />
            <span>Opens securely in your system browser (OAuth 2.0 PKCE)</span>
          </div>

          <button
            type="submit"
            disabled={isWaiting}
            className="px-4 py-2 bg-commito-coral hover:bg-commito-coralHover text-text-on-accent rounded-sm text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
          >
            {isWaiting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for browser...</span>
              </>
            ) : (
              <>
                <span>Continue to Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
