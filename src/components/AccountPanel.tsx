import React, { useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Clock,
  RefreshCw,
  LogOut,
  Plus,
  CheckCircle,
  ExternalLink,
  Globe,
  Key,
} from 'lucide-react';
import { useAccountStore } from '../store/accountStore';
import { UserAvatar } from './UserAvatar';

export const AccountPanel: React.FC = () => {
  const {
    accounts,
    activeAccount,
    tokenInfo,
    isLoading,
    isAccountPanelOpen,
    setIsAccountPanelOpen,
    setIsSignInModalOpen,
    fetchAccounts,
    switchAccount,
    signOut,
    refreshToken,
  } = useAccountStore();

  useEffect(() => {
    if (isAccountPanelOpen) {
      fetchAccounts();
    }
  }, [isAccountPanelOpen, fetchAccounts]);

  if (!isAccountPanelOpen) return null;

  const formatExpiry = (expiresAt?: number | null) => {
    if (!expiresAt) return 'Never expires (PAT)';
    const now = Math.floor(Date.now() / 1000);
    const diff = expiresAt - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600);
    const days = Math.floor(hours / 24);
    if (days > 0) return `Expires in ${days} day${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `Expires in ${hours} hour${hours !== 1 ? 's' : ''}`;
    const mins = Math.floor(diff / 60);
    return `Expires in ${mins} min${mins !== 1 ? 's' : ''}`;
  };

  const getCleanHost = (url: string) => {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        onClick={() => setIsAccountPanelOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-Over Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-80 sm:w-96 bg-base-1 border-l border-border shadow-2xl flex flex-col h-full">
          {/* Panel Header */}
          <div className="h-12 bg-base-0 border-b border-border px-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-commito-coral" />
              <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Account Information
              </h2>
            </div>
            <button
              onClick={() => setIsAccountPanelOpen(false)}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {activeAccount ? (
              <>
                {/* Active Account Card */}
                <div className="p-4 bg-base-2 border border-border rounded-lg space-y-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      url={activeAccount.avatar_url}
                      name={activeAccount.name || activeAccount.username}
                      provider={activeAccount.provider}
                      className="w-12 h-12"
                      iconClassName="w-6 h-6"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-text-primary truncate">
                          {activeAccount.name || activeAccount.username}
                        </h3>
                        <span className="px-1.5 py-0.2 bg-commito-coral/20 text-commito-coral border border-commito-coral/30 rounded text-[9px] font-mono font-bold uppercase">
                          {activeAccount.provider}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted font-mono truncate">
                        @{activeAccount.username}
                      </p>
                      {activeAccount.email && (
                        <p className="text-[11px] text-text-faint truncate">
                          {activeAccount.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Instance URL */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-text-muted flex items-center gap-1">
                      <Globe className="w-3 h-3 text-gitlab-teal" />
                      Instance
                    </span>
                    <span className="font-mono text-text-secondary font-medium text-[11px]">
                      {getCleanHost(activeAccount.server_url)}
                    </span>
                  </div>
                </div>

                {/* Token Details & Scopes Section */}
                <div className="p-4 bg-base-2 border border-border rounded-lg space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Token & Scopes</span>
                    </div>
                    {activeAccount.refresh_token && (
                      <button
                        onClick={() => refreshToken(activeAccount.id)}
                        disabled={isLoading}
                        className="p-1 text-text-muted hover:text-text-primary hover:bg-base-3 rounded text-[11px] flex items-center gap-1 transition cursor-pointer"
                        title="Silent refresh token"
                      >
                        <RefreshCw className={`w-3 h-3 text-commito-coral ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    )}
                  </div>

                  {/* Token Status Badge */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Status
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded font-medium">
                      {formatExpiry(activeAccount.expires_at)}
                    </span>
                  </div>

                  {/* Granted Scopes Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-text-muted font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3 text-gitlab-blue" />
                      Granted Scopes
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(tokenInfo?.scope || activeAccount.scopes || ['api', 'read_user']).map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-0.5 bg-base-3 border border-border rounded text-[10px] font-mono text-text-secondary font-semibold"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                    <button
                      onClick={() => signOut(activeAccount.id)}
                      disabled={isLoading}
                      className="px-2.5 py-1 bg-red-950/40 border border-red-800/60 hover:bg-red-900/60 text-red-300 rounded text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Revoke & Sign Out</span>
                    </button>
                  </div>
                </div>

                {/* Multi-Account Switcher */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                      Saved Accounts ({accounts.length})
                    </h4>
                    <button
                      onClick={() => setIsSignInModalOpen(true)}
                      className="text-xs text-commito-coral hover:underline font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Account</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {accounts.map((acc) => {
                      const isActive = acc.id === activeAccount.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => !isActive && switchAccount(acc.id)}
                          className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                            isActive
                              ? 'bg-base-2 border-commito-coral/50 shadow-xs'
                              : 'bg-base-2/50 border-border hover:border-border-strong hover:bg-base-2'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              url={acc.avatar_url}
                              name={acc.name || acc.username}
                              provider={acc.provider}
                              className="w-7 h-7"
                              iconClassName="w-3.5 h-3.5"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-text-primary truncate flex items-center gap-1">
                                <span>{acc.name || acc.username}</span>
                                <span className="text-[9px] text-text-faint font-mono uppercase">
                                  ({acc.provider})
                                </span>
                              </div>
                              <div className="text-[10px] text-text-muted font-mono truncate">
                                {getCleanHost(acc.server_url)}
                              </div>
                            </div>
                          </div>

                          {isActive ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                switchAccount(acc.id);
                              }}
                              className="px-2 py-0.5 bg-base-3 hover:bg-base-1 border border-border rounded text-[11px] font-medium text-text-secondary transition"
                            >
                              Switch
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* Empty State: Not signed in */
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-base-2 border border-border flex items-center justify-center text-text-muted shadow-inner">
                  <User className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-text-primary">Not Signed In</h3>
                  <p className="text-xs text-text-muted max-w-xs">
                    Sign in to GitLab (gitlab.com or self-hosted) to sync repositories, create merge requests, and manage pipelines.
                  </p>
                </div>
                <button
                  onClick={() => setIsSignInModalOpen(true)}
                  className="px-4 py-2 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Sign in with GitLab</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
