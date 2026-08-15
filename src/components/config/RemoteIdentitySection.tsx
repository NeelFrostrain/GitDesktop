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
  const selectedItem = accounts.find((a) => a.id === selectedSyncAccount);

  const handleSelect = (accId: string) => {
    onSyncAccountChange(accId);
    onToggleDropdown();
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Remote Identity
        </label>
        {selectedSyncAccount !== 'custom' ? (
          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1">
            <Link className="w-2.5 h-2.5" /> LINKED
          </span>
        ) : (
          <span className="px-1.5 py-0.5 bg-base-3 text-text-muted border border-border rounded text-[9px] font-semibold uppercase tracking-wider">
            Unlinked / Manual
          </span>
        )}
      </div>

      {/* Selector Card Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={onToggleDropdown}
          className="w-full px-2.5 py-1.5 bg-base-0 border border-border hover:border-commito-coral/50 rounded-md text-xs text-text-primary flex items-center justify-between transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            {selectedSyncAccount === 'custom' ? (
              <>
                <Unlink className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="font-semibold text-text-secondary truncate">Manual / Unlinked Identity</span>
              </>
            ) : (
              selectedItem && (
                <>
                  <UserAvatar
                    url={selectedItem.avatar_url}
                    name={selectedItem.name || selectedItem.username}
                    email={selectedItem.email || undefined}
                    provider={selectedItem.provider}
                    className="w-4 h-4"
                    iconClassName="w-2.5 h-2.5"
                  />
                  <span className="font-bold text-text-primary truncate">
                    {selectedItem.provider === 'github' ? 'GitHub' : 'GitLab'}: {selectedItem.name || selectedItem.username}
                  </span>
                  {selectedItem.email && (
                    <span className="text-[10px] text-text-muted font-mono truncate">
                      ({selectedItem.email})
                    </span>
                  )}
                </>
              )
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ml-2 flex-shrink-0 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-base-1 border border-border rounded-md shadow-2xl z-50 py-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleSelect('custom')}
              className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                selectedSyncAccount === 'custom'
                  ? 'bg-commito-coral/20 text-commito-coral font-bold'
                  : 'hover:bg-base-2 text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Unlink className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
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
                    ? 'bg-commito-coral/20 text-commito-coral font-bold'
                    : 'hover:bg-base-2 text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <UserAvatar
                    url={acc.avatar_url}
                    name={acc.name || acc.username}
                    email={acc.email || undefined}
                    provider={acc.provider}
                    className="w-4 h-4"
                    iconClassName="w-2.5 h-2.5"
                  />
                  <div className="truncate">
                    <span className="font-bold">
                      {acc.provider === 'github' ? 'GitHub' : 'GitLab'}: {acc.name || acc.username}
                    </span>
                    {acc.email && (
                      <span className="text-[10px] text-text-muted font-mono ml-1">
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

      <p className="text-[10px] text-text-muted leading-tight">
        Sync your name, email and avatar from your connected account.
      </p>
    </div>
  );
};
