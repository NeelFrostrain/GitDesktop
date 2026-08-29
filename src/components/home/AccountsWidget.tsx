import React from "react";
import { Plus, ChevronRight, Users } from "lucide-react";
import { useAccounts, ProviderAccount, useAccountServicesStore } from "../../features/account-services";
import { UserAvatar } from "../common/UserAvatar";
import { Button } from "../common/Button";

export const AccountsWidget: React.FC = () => {
  const { accounts } = useAccounts();
  const { openModalWithTab } = useAccountServicesStore();

  const getStatusDot = (account: ProviderAccount) => {
    if (account.token_status === "needs_reauth") {
      return (
        <span
          className="w-2 h-2 rounded-full bg-rose-500 ring-1 ring-base-1 animate-pulse flex-shrink-0 shadow-xs"
          title="Session expired - please reconnect account"
        />
      );
    }
    if (account.token_status === "expired") {
      return (
        <span
          className="w-2 h-2 rounded-full bg-rose-500 ring-1 ring-base-1 flex-shrink-0"
          title="Token expired"
        />
      );
    }
    if (account.token_status === "expiring_soon") {
      return (
        <span
          className="w-2 h-2 rounded-full bg-amber-400 ring-1 ring-base-1 flex-shrink-0"
          title="Expiring soon"
        />
      );
    }
    return (
      <span
        className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-base-1 flex-shrink-0 shadow-2xs"
        title="Account Active & Valid"
      />
    );
  };

  const getCleanHost = (url: string) =>
    url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="flex flex-col p-3.5 bg-base-1/50 border border-border rounded-sm select-none font-sans relative shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-commito-coral" />
          <span className="text-xs font-semibold text-text-primary tracking-tight">
            Connected Accounts
          </span>
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-xs bg-base-2 text-text-muted border border-border">
            {accounts.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => openModalWithTab("accounts")}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary px-1.5 py-0.5 rounded-xs hover:bg-base-2 transition cursor-pointer font-medium"
          title="Configure Git Identity & Accounts"
        >
          <Plus className="w-3 h-3" />
          <span>Configure</span>
        </button>
      </div>

      {/* Accounts List */}
      {accounts.length > 0 ? (
        <div className="space-y-1.5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => openModalWithTab("accounts")}
              className="flex items-center gap-2.5 p-2 rounded-sm bg-base-1 border border-border hover:border-border-strong hover:bg-base-2 transition cursor-pointer group shadow-2xs"
            >
              <div className="relative flex-shrink-0">
                <UserAvatar
                  url={acc.avatar_url}
                  name={acc.display_name}
                  handle={acc.handle}
                  email={acc.commit_email}
                  provider={acc.provider}
                  className="w-7.5 h-7.5 rounded-sm ring-1 ring-border shadow-xs"
                  iconClassName="w-3.5 h-3.5"
                />
                <div className="absolute -bottom-0.5 -right-0.5">
                  {getStatusDot(acc)}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-text-primary truncate">
                    {acc.display_name}
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border flex-shrink-0 ${
                      acc.provider === "github"
                        ? "text-purple-400 bg-purple-950/40 border-purple-800/40"
                        : acc.provider === "bitbucket"
                        ? "text-blue-400 bg-blue-950/40 border-blue-800/40"
                        : acc.provider === "custom"
                        ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/40"
                        : "text-commito-coral bg-commito-coral/10 border-commito-coral/30"
                    }`}
                  >
                    {acc.provider}
                  </span>
                </div>
                <p className="text-[10.5px] text-text-muted font-mono truncate mt-0.5">
                  {acc.handle.startsWith("@") ? acc.handle : `@${acc.handle}`} · {getCleanHost(acc.instance_url)}
                </p>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-5 rounded-sm text-center bg-base-1/40 border border-dashed border-border">
          <p className="text-xs text-text-muted">No accounts connected yet</p>
          <Button
            type="button"
            variant="coral"
            size="sm"
            onClick={() => openModalWithTab("add")}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Connect Account
          </Button>
        </div>
      )}
    </div>
  );
};
