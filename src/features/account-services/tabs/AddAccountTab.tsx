import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ProviderPickerCard } from '../components/ProviderPickerCard';
import { useAccountServicesStore } from '../store/accountStore';

export const AddAccountTab: React.FC = () => {
  const { setActiveTab } = useAccountServicesStore();

  return (
    <div className="space-y-3.5 select-none font-sans">
      {/* Sub Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Connect an Account
          </h3>
          <p className="text-[11px] text-text-muted">
            Select your provider and sign in securely through your default browser.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className="px-2.5 py-1 bg-base-1 hover:bg-base-2 border border-border text-text-secondary hover:text-text-primary rounded-sm text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Accounts</span>
        </button>
      </div>

      <ProviderPickerCard />
    </div>
  );
};
