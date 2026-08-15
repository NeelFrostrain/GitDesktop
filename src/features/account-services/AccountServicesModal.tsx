import React, { useEffect } from 'react';
import {
  X,
  Users,
  Globe,
  FolderLock,
} from 'lucide-react';
import { useAccountServicesStore } from './store/accountStore';
import { AccountsTab } from './tabs/AccountsTab';
import { AddAccountTab } from './tabs/AddAccountTab';
import { RemoteRepositoriesTab } from './tabs/RemoteRepositoriesTab';

export const AccountServicesModal: React.FC = () => {
  const { isModalOpen, setIsModalOpen, activeTab, setActiveTab, accounts, loadAccounts } = useAccountServicesStore();

  useEffect(() => {
    if (isModalOpen) {
      loadAccounts();
    }
  }, [isModalOpen, loadAccounts]);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-fadeIn">
      {/* Modal Container matching reference screenshot */}
      <div className="bg-[#18181c] border border-[#fc6d26]/40 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Top Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-base-1/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fc6d26]/15 border border-[#fc6d26]/30 text-[#fc6d26] flex items-center justify-center flex-shrink-0 shadow-inner">
              <FolderLock className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-text-primary tracking-tight">
              Account Services & Repositories
            </h2>
          </div>

          <button
            onClick={() => setIsModalOpen(false)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Bar matching reference */}
        <div className="px-5 border-b border-border flex items-center gap-6 bg-base-1/20">
          {/* Tab 1: Accounts (N) */}
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-3 text-xs font-bold flex items-center gap-2 transition cursor-pointer relative ${
              activeTab === 'accounts'
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Accounts ({accounts.length})</span>
            {activeTab === 'accounts' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fc6d26] rounded-full" />
            )}
          </button>

          {/* Tab 2: + Add Account (with green plus accent) */}
          <button
            onClick={() => setActiveTab('add')}
            className={`py-3 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer relative ${
              activeTab === 'add'
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span className="text-emerald-400 font-bold text-sm leading-none">+</span>
            <span>Add Account</span>
            {activeTab === 'add' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fc6d26] rounded-full" />
            )}
          </button>

          {/* Tab 3: Remote Repositories */}
          <button
            onClick={() => setActiveTab('remotes')}
            className={`py-3 text-xs font-bold flex items-center gap-2 transition cursor-pointer relative ${
              activeTab === 'remotes'
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Remote Repositories</span>
            {activeTab === 'remotes' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fc6d26] rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'accounts' && <AccountsTab />}
          {activeTab === 'add' && <AddAccountTab />}
          {activeTab === 'remotes' && <RemoteRepositoriesTab />}
        </div>
      </div>
    </div>
  );
};
