import React, { RefObject } from 'react';
import { ChevronDown, Check, Unlink, Plus } from 'lucide-react';
import { AccountOption } from '../../hooks/useGitUserConfig';
import { UserAvatar } from '../common/UserAvatar';
import { useAccountServicesStore } from '../../features/account-services';

interface RemoteIdentitySectionProps {
  selectedSyncAccount: string;
  onSyncAccountChange: (accId: string) => void;
  accounts: AccountOption[];
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
}

export const RemoteIdentitySection: React.FC<RemoteIdentitySectionProps> = ({
  selectedSyncAccount,
  onSyncAccountChange,
  accounts,
  isDropdownOpen,
  onToggleDropdown,
  dropdownRef,
}) => {
  const { openModalWithTab } = useAccountServicesStore();

  const selectedItem =
    accounts.find(
      (a) =>
        a.id === selectedSyncAccount ||
        a.id === selectedSyncAccount?.replace(/^active:/, '') ||
        `active:${a.id}` === selectedSyncAccount
    ) || (selectedSyncAccount !== 'custom' ? accounts[0] : undefined);

  const isLinked = selectedSyncAccount !== 'custom' && selectedItem !== undefined;

  const handleSelect = (accId: string) => {
    onSyncAccountChange(accId);
    onToggleDropdown();
  };

  const getProviderBadge = (provider: string) => {
    const p = (provider || '').toLowerCase();
    if (p === 'github') {
      return (
        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-purple-400 bg-purple-950/40 border-purple-800/40 shrink-0">
          GitHub
        </span>
      );
    }
    if (p === 'bitbucket') {
      return (
        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-blue-400 bg-blue-950/40 border-blue-800/40 shrink-0">
          Bitbucket
        </span>
      );
    }
    if (p === 'gitlab') {
      return (
        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-commito-coral bg-commito-coral/10 border-commito-coral/30 shrink-0">
          GitLab
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-emerald-400 bg-emerald-950/40 border-emerald-800/40 shrink-0">
        Custom
      </span>
    );
  };

  return (
    <div className="space-y-1.5 font-sans select-none">
      <div className="flex items-center justify-between">
        <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint">
          Connected Identity Source
        </label>
        {isLinked ? (
          <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xs text-[9.5px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LINKED</span>
          </span>
        ) : (
          <span className="px-1.5 py-0.2 bg-base-2 text-text-muted border border-border rounded-xs text-[9.5px] font-mono font-medium uppercase tracking-wider">
            Manual / Unlinked
          </span>
        )}
      </div>

      {/* Account Selector Dropdown Button */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={onToggleDropdown}
          className="w-full h-9 px-3 bg-base-1 border border-border hover:border-border-strong rounded-sm text-xs text-text-primary flex items-center justify-between transition cursor-pointer shadow-2xs focus:outline-none focus:border-commito-coral/60"
        >
          <div className="flex items-center gap-2.5 truncate min-w-0">
            {selectedItem ? (
              <>
                <UserAvatar
                  url={selectedItem.avatar_url}
                  name={selectedItem.name || selectedItem.username}
                  email={selectedItem.email || undefined}
                  provider={selectedItem.provider}
                  className="w-5 h-5 rounded-xs ring-1 ring-border/60"
                  iconClassName="w-3 h-3"
                />
                <span className="font-bold text-text-primary truncate">
                  {selectedItem.name || selectedItem.username}
                </span>
                {selectedItem.email && (
                  <span className="text-[11px] text-text-muted font-mono truncate hidden sm:inline">
                    ({selectedItem.email})
                  </span>
                )}
                {getProviderBadge(selectedItem.provider)}
              </>
            ) : (
              <>
                <Unlink className="w-4 h-4 text-text-muted shrink-0" />
                <span className="font-semibold text-text-secondary truncate">
                  Manual / Unlinked Git Identity
                </span>
              </>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ml-2 shrink-0 ${
              isDropdownOpen ? 'rotate-180 text-commito-coral' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-base-1 border border-border-strong rounded-sm shadow-2xl z-50 py-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
            {accounts.map((acc) => {
              const isSelected = selectedSyncAccount === acc.id || selectedItem?.id === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelect(acc.id)}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? 'bg-commito-coral/15 text-commito-coral font-bold'
                      : 'hover:bg-base-2 text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                    <UserAvatar
                      url={acc.avatar_url}
                      name={acc.name || acc.username}
                      email={acc.email || undefined}
                      provider={acc.provider}
                      className="w-5 h-5 rounded-xs ring-1 ring-border/60 shrink-0"
                      iconClassName="w-3 h-3"
                    />
                    <div className="truncate min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold truncate">{acc.name || acc.username}</span>
                        {getProviderBadge(acc.provider)}
                      </div>
                      {acc.email && (
                        <div className="text-[10.5px] text-text-muted font-mono truncate">
                          {acc.email}
                        </div>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-commito-coral shrink-0" />}
                </button>
              );
            })}

            <div className="border-t border-border/70 my-1" />

            <button
              type="button"
              onClick={() => handleSelect('custom')}
              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                selectedSyncAccount === 'custom'
                  ? 'bg-commito-coral/15 text-commito-coral font-bold'
                  : 'hover:bg-base-2 text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Unlink className="w-4 h-4 text-text-muted shrink-0" />
                <div>
                  <span className="font-semibold text-text-primary">Manual / Unlinked Identity</span>
                  <div className="text-[10.5px] text-text-muted">
                    Set a custom Git name and email without cloud sync
                  </div>
                </div>
              </div>
              {selectedSyncAccount === 'custom' && <Check className="w-4 h-4 text-commito-coral shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleDropdown();
                openModalWithTab('add');
              }}
              className="w-full px-3 py-1.5 text-left text-[11px] text-commito-coral hover:bg-commito-coral/10 transition flex items-center gap-2 cursor-pointer font-semibold border-t border-border/50 pt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Another Account...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
