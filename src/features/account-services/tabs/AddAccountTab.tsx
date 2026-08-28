import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ProviderPickerCard } from '../components/ProviderPickerCard';
import { useAccountServicesStore } from '../store/accountStore';
import { Button } from '../../../components/common/Button';

export const AddAccountTab: React.FC = () => {
  const { setActiveTab } = useAccountServicesStore();

  return (
    <div className="space-y-3.5 select-none font-sans">
      {/* Sub Header */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Connect an Account
          </h3>
          <p className="text-[11px] text-text-muted">
            Select your Git provider and sign in securely through your default browser.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setActiveTab('accounts')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          Back to Accounts
        </Button>
      </div>

      <ProviderPickerCard />
    </div>
  );
};
