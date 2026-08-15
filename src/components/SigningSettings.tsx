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
import { useSigningStore } from '../store/signingStore';
import { useGitStore } from '../store/useGitStore';
import { SigningConfig } from '../types/git';

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
    } catch (err: any) {
      setLocalError(err?.message || String(err));
    }
  };

  const currentKeys = method === 'gpg' ? gpgKeys : sshKeys;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-base-1 border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-base-0 border-b border-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Commit Signing & Verification
            </h2>
          </div>
          <button
            onClick={() => setIsSigningSettingsOpen(false)}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5">
          {localError && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{localError}</div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Signing configuration saved successfully.</span>
            </div>
          )}

          {/* Toggle Enable Commit Signing */}
          <div className="p-3.5 bg-base-2 border border-border rounded-lg flex items-center justify-between">
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
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      method === 'gpg'
                        ? 'bg-base-2 border-commito-coral/50 shadow-xs'
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
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      method === 'ssh'
                        ? 'bg-base-2 border-commito-coral/50 shadow-xs'
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
                      className="w-full bg-base-2 border border-border rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-commito-coral"
                    >
                      <option value="">Select a GPG key...</option>
                      {gpgKeys.map((k) => (
                        <option key={k.key_id} value={k.key_id}>
                          {k.key_id} - {k.user_id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-base-2 border border-border rounded-lg text-xs text-text-muted space-y-1">
                      <div className="flex items-center gap-1 text-amber-400 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>No GPG secret keys found</span>
                      </div>
                      <p className="text-[11px] text-text-muted">
                        Generate one using <code className="text-commito-coral">gpg --generate-key</code> in your terminal.
                      </p>
                    </div>
                  )
                ) : (
                  sshKeys.length > 0 ? (
                    <select
                      value={keyId}
                      onChange={(e) => setKeyId(e.target.value)}
                      className="w-full bg-base-2 border border-border rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-commito-coral"
                    >
                      <option value="">Select an SSH key...</option>
                      {sshKeys.map((k) => (
                        <option key={k.path} value={k.path}>
                          {k.key_type} - {k.comment || k.path}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-base-2 border border-border rounded-lg text-xs text-text-muted space-y-1">
                      <div className="flex items-center gap-1 text-amber-400 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>No SSH keys found</span>
                      </div>
                      <p className="text-[11px] text-text-muted">
                        Generate one using <code className="text-commito-coral">ssh-keygen -t ed25519</code> in your terminal.
                      </p>
                    </div>
                  )
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

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsSigningSettingsOpen(false)}
              className="px-3.5 py-1.5 bg-base-3 hover:bg-base-1 border border-border rounded-lg text-xs text-text-secondary font-medium transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coralHover disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
