import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  Plus,
} from 'lucide-react';
import { useAccountServicesStore } from './store/accountStore';
import { AccountsTab } from './tabs/AccountsTab';
import { AddAccountTab } from './tabs/AddAccountTab';
import { Tabs } from '../../components/common/Tabs';

/**
 * Clean, modern modal dialog for managing multiple Git provider accounts
 * and configuring 1-click browser OAuth sign-ins.
 */
export const AccountServicesModal: React.FC = () => {
  const { isModalOpen, setIsModalOpen, activeTab, setActiveTab, accounts, loadAccounts } =
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
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-100 font-sans"
    >
      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-100"
      >
        {/* Header with Integrated Segmented Tabs */}
        <div className="px-4 py-2.5 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2
                id="account-services-modal-title"
                className="text-xs font-bold text-text-primary leading-none"
              >
                Connected Accounts
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Tabs<'accounts' | 'add'>
              tabs={[
                {
                  id: 'accounts',
                  label: 'Accounts',
                  icon: <Users className="w-3 h-3" />,
                  badge: accounts.length,
                  badgeVariant: 'neutral',
                },
                {
                  id: 'add',
                  label: 'Add Account',
                  icon: <Plus className="w-3 h-3 text-git-added" />,
                },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
              size="sm"
            />

            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0 ml-1"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'accounts' && <AccountsTab />}
          {activeTab === 'add' && <AddAccountTab />}
        </div>
      </div>
    </div>,
    document.body
  );
};
