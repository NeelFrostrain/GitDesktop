import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Key,
  Check,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useSigningStore } from '../../store/signingStore';
import { useGitStore } from '../../store/useGitStore';
import { SigningConfig } from '../../types/git';
import { getErrorMessage } from '../../shared/utils/errorUtils';

/**
 * Modal dialogue for configuring repository and global Git cryptographic commit signing (GPG / SSH).
 */
export const SigningSettings: React.FC = () => {
  const { activeRepoPath } = useGitStore();
  const {
    gpgKeys,
    sshKeys,
    config,
    isLoading,
    isSigningSettingsOpen,
    setIsSigningSettingsOpen,
    loadKeys,
    loadConfig,
    saveConfig,
  } = useSigningStore();

  const [enabled, setEnabled] = useState(false);
  const [method, setMethod] = useState<'gpg' | 'ssh'>('gpg');
  const [keyId, setKeyId] = useState('');
  const [scope, setScope] = useState<'repo' | 'global'>('repo');
  const [localError, setLocalError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isSigningSettingsOpen) {
      loadKeys();
      if (activeRepoPath) {
        loadConfig(activeRepoPath);
      }
    }
  }, [isSigningSettingsOpen, activeRepoPath, loadKeys, loadConfig]);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setMethod(config.method as 'gpg' | 'ssh');
      setKeyId(config.key_id);
      setScope(config.scope as 'repo' | 'global');
    }
  }, [config]);

  if (!isSigningSettingsOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath) return;
    setLocalError(null);
    setSavedSuccess(false);

    const signingConfig: SigningConfig = {
      enabled,
      method,
      key_id: keyId.trim(),
      scope,
    };

    try {
      await saveConfig(activeRepoPath, signingConfig);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error: unknown) {
      setLocalError(getErrorMessage(error));
    }
  };

  const currentKeys = method === 'gpg' ? gpgKeys : sshKeys;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-base-1 border border-border rounded-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-text-primary leading-none truncate">
                Commit Signing & Verification
              </h3>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                {method === 'gpg' ? 'GPG' : 'SSH'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSigningSettingsOpen(false)}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5">
          {localError && (
            <div className="p-3 bg-git-removed-bg border border-git-removed/40 rounded-sm flex items-start gap-2.5 text-xs text-git-removed">
              <AlertCircle className="w-4 h-4 text-git-removed flex-shrink-0 mt-0.5" />
              <div className="flex-1">{localError}</div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 bg-git-added-bg border border-git-added/40 rounded-sm flex items-center gap-2 text-xs text-git-added">
              <Check className="w-4 h-4 text-git-added flex-shrink-0" />
              <span>Signing configuration saved successfully.</span>
            </div>
          )}

          {/* Toggle Enable Commit Signing */}
          <div className="p-3.5 bg-base-2 border border-border rounded-sm flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-text-primary block">
                Sign Commits Automatically
              </span>
              <p className="text-[11px] text-text-muted">
                Cryptographically sign all new commits created in this repository.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-base-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-commito-coral" />
            </label>
          </div>

          {enabled && (
            <>
              {/* Method Selector: GPG vs SSH */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-primary uppercase tracking-wider text-[11px] text-text-muted">
                  Signing Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => {
                      setMethod('gpg');
                      setKeyId('');
                    }}
                    className={`p-3 rounded-sm border cursor-pointer transition ${
                      method === 'gpg'
                        ? 'bg-base-2 border-border-strong shadow-xs'
                        : 'bg-base-2/50 border-border hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-text-primary mb-1">
                      <Shield className="w-3.5 h-3.5 text-commito-coral" />
                      <span>GPG (OpenPGP)</span>
                    </div>
                    <p className="text-[10px] text-text-muted">Classic PGP secret keys</p>
                  </div>

                  <div
                    onClick={() => {
                      setMethod('ssh');
                      setKeyId('');
                    }}
                    className={`p-3 rounded-sm border cursor-pointer transition ${
                      method === 'ssh'
                        ? 'bg-base-2 border-border-strong shadow-xs'
                        : 'bg-base-2/50 border-border hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-text-primary mb-1">
                      <Key className="w-3.5 h-3.5 text-gitlab-teal" />
                      <span>SSH Key</span>
                    </div>
                    <p className="text-[10px] text-text-muted">Modern SSH signing via agent</p>
                  </div>
                </div>
              </div>

              {/* Key Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary flex items-center justify-between">
                  <span>Signing Key</span>
                  <span className="text-[10px] text-text-muted">
                    {currentKeys.length} key{currentKeys.length !== 1 ? 's' : ''} detected
                  </span>
                </label>

                {method === 'gpg' ? (
                  gpgKeys.length > 0 ? (
                    <select
                      value={keyId}
                      onChange={(e) => setKeyId(e.target.value)}
                      className="w-full bg-base-2 border border-border hover:border-border-strong rounded-sm px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-border-strong"
                    >
                      <option value="">Select a GPG key...</option>
                      {gpgKeys.map((k) => (
                        <option key={k.key_id} value={k.key_id}>
                          {k.key_id} - {k.user_id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-base-2 border border-border rounded-sm text-xs text-text-muted space-y-1">
                      <div className="flex items-center gap-1 text-git-modified font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>No GPG secret keys found</span>
                      </div>
                      <p className="text-[11px] text-text-muted">
                        Generate one using <code className="text-commito-coral">gpg --generate-key</code> in your terminal.
                      </p>
                    </div>
                  )
                ) : sshKeys.length > 0 ? (
                  <select
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    className="w-full bg-base-2 border border-border hover:border-border-strong rounded-sm px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-border-strong"
                  >
                    <option value="">Select an SSH key...</option>
                    {sshKeys.map((k) => (
                      <option key={k.path} value={k.path}>
                        {k.key_type} - {k.comment || k.path}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-base-2 border border-border rounded-sm text-xs text-text-muted space-y-1">
                    <div className="flex items-center gap-1 text-git-modified font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>No SSH keys found</span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Generate one using <code className="text-commito-coral">ssh-keygen -t ed25519</code> in your terminal.
                    </p>
                  </div>
                )}
              </div>

              {/* Scope Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">Configuration Scope</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-text-primary">
                    <input
                      type="radio"
                      name="scope"
                      value="repo"
                      checked={scope === 'repo'}
                      onChange={() => setScope('repo')}
                      className="text-commito-coral focus:ring-commito-coral"
                    />
                    <span>This Repository only (.git/config)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-text-primary">
                    <input
                      type="radio"
                      name="scope"
                      value="global"
                      checked={scope === 'global'}
                      onChange={() => setScope('global')}
                      className="text-commito-coral focus:ring-commito-coral"
                    />
                    <span>All Repositories (Global ~/.gitconfig)</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </form>

        {/* Pinned Bottom Footer Buttons */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-base-1 border-t border-border shrink-0 select-none">
          <button
            type="button"
            onClick={() => setIsSigningSettingsOpen(false)}
            disabled={isLoading}
            className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="signing-settings-form"
            disabled={isLoading}
            className="h-7.5 px-4 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs bg-commito-coral hover:bg-commito-coralLight text-white active:scale-98 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>{isLoading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
