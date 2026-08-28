import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ProviderPickerCard } from '../components/ProviderPickerCard';
import { useAccountServicesStore } from '../store/accountStore';

export const AddAccountTab: React.FC = () => {
  const { setActiveTab } = useAccountServicesStore();

  return (
    <div className="space-y-4 select-none font-sans">
      {/* Sub Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-[13px] font-semibold text-text tracking-normal">
            Connect an Account
          </h3>
          <p className="text-xs text-text-muted">
            Select your Git provider and sign in securely through your default browser.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface hover:bg-surface-hover border border-border-subtle hover:border-border text-text-subtle hover:text-text text-xs font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Accounts</span>
        </button>
      </div>

      <ProviderPickerCard />
    </div>
  );
};
