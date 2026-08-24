import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ProviderPickerCard } from '../components/ProviderPickerCard';
import { useAccountServicesStore } from '../store/accountStore';

export const AddAccountTab: React.FC = () => {
  const { setActiveTab } = useAccountServicesStore();

  return (
    <div className="space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase">
            CONNECT AN ACCOUNT
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Select your provider and sign in securely through your default browser.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('accounts')}
          className="px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border text-text-secondary hover:text-text-primary rounded-sm text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Accounts</span>
        </button>
      </div>

      <ProviderPickerCard />
    </div>
  );
};
