import React, { RefObject } from 'react';
import { ChevronDown, Check, Unlink, Link } from 'lucide-react';
import { AccountOption } from '../../hooks/useGitUserConfig';
import { UserAvatar } from '../common/UserAvatar';

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

  const getProviderName = (prov: string) => {
    const p = (prov || '').toLowerCase();
    if (p === 'github') return 'GitHub';
    if (p === 'gitlab') return 'GitLab';
    if (p === 'bitbucket') return 'Bitbucket';
    if (p === 'custom') return 'Git Identity';
    return prov;
  };

  return (
    <div className="space-y-1.5 font-sans select-none">
      <div className="flex items-center justify-between">
        <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint">
          Remote Identity
        </label>
        {isLinked ? (
          <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xs text-[9.5px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
            <Link className="w-2.5 h-2.5" />
            <span>LINKED</span>
          </span>
        ) : (
          <span className="px-1.5 py-0.2 bg-base-2 text-text-muted border border-border rounded-xs text-[9.5px] font-mono font-medium uppercase tracking-wider">
            Unlinked / Manual
          </span>
        )}
      </div>

      {/* Selector Card Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={onToggleDropdown}
          className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong rounded-sm text-xs text-text-primary flex items-center justify-between transition cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            {selectedItem ? (
              <>
                <UserAvatar
                  url={selectedItem.avatar_url}
                  name={selectedItem.name || selectedItem.username}
                  email={selectedItem.email || undefined}
                  provider={selectedItem.provider}
                  className="w-4 h-4 rounded-xs"
                  iconClassName="w-2.5 h-2.5"
                />
                <span className="font-bold text-text-primary truncate">
                  {getProviderName(selectedItem.provider)}: {selectedItem.name || selectedItem.username}
                </span>
                {selectedItem.email && (
                  <span className="text-[11px] text-text-muted font-mono truncate">
                    ({selectedItem.email})
                  </span>
                )}
              </>
            ) : (
              <>
                <Unlink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="font-semibold text-text-secondary truncate">Manual / Unlinked Identity</span>
              </>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ml-2 shrink-0 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-base-1 border border-border-strong rounded-sm shadow-2xl z-50 py-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleSelect('custom')}
              className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                selectedSyncAccount === 'custom'
                  ? 'bg-commito-coral/15 text-commito-coral font-bold'
                  : 'hover:bg-base-2 text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Unlink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>Manual / Unlinked Identity</span>
              </div>
              {selectedSyncAccount === 'custom' && <Check className="w-3.5 h-3.5 text-commito-coral" />}
            </button>

            {accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleSelect(acc.id)}
                className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                  selectedSyncAccount === acc.id
                    ? 'bg-commito-coral/15 text-commito-coral font-bold'
                    : 'hover:bg-base-2 text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <UserAvatar
                    url={acc.avatar_url}
                    name={acc.name || acc.username}
                    email={acc.email || undefined}
                    provider={acc.provider}
                    className="w-4 h-4 rounded-xs"
                    iconClassName="w-2.5 h-2.5"
                  />
                  <div className="truncate">
                    <span className="font-bold">
                      {getProviderName(acc.provider)}: {acc.name || acc.username}
                    </span>
                    {acc.email && (
                      <span className="text-[11px] text-text-muted font-mono ml-1">
                        ({acc.email})
                      </span>
                    )}
                  </div>
                </div>
                {selectedSyncAccount === acc.id && <Check className="w-3.5 h-3.5 text-commito-coral" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10.5px] text-text-muted leading-tight">
        Sync your name, email and avatar from your connected account.
      </p>
    </div>
  );
};
