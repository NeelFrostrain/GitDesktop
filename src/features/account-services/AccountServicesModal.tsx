import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
} from 'lucide-react';
import { useAccountServicesStore } from './store/accountStore';
import { AccountsTab } from './tabs/AccountsTab';
import { AddAccountTab } from './tabs/AddAccountTab';

/**
 * Clean, modern modal dialog for managing multiple Git provider accounts
 * and configuring 1-click browser OAuth sign-ins.
 */
export const AccountServicesModal: React.FC = () => {
  const { isModalOpen, setIsModalOpen, activeTab, accounts, loadAccounts } =
    useAccountServicesStore();

  useEffect(() => {
    if (isModalOpen) {
      loadAccounts();
    }
  }, [isModalOpen, loadAccounts]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, setIsModalOpen]);

  if (!isModalOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-services-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsModalOpen(false);
        }
      }}
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-150 font-sans"
    >
      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface-elevated border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Clean Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle bg-surface-subtle/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-commito-coral/10 border border-commito-coral/20 flex items-center justify-center text-commito-coral shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2
                id="account-services-modal-title"
                className="text-sm font-semibold text-text leading-none tracking-tight"
              >
                Connected Accounts
              </h2>
              {accounts.length > 0 && (
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface border border-border-subtle text-text-muted">
                  {accounts.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content Body with comfortable 24px padding */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'accounts' && <AccountsTab />}
          {activeTab === 'add' && <AddAccountTab />}
        </div>
      </div>
    </div>,
    document.body
  );
};
