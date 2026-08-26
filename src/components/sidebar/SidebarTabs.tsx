import React from 'react';
import { useGitStore } from '../../store/useGitStore';
import { Tabs, TabItem } from '../common/Tabs';

export const SidebarTabs: React.FC = () => {
  const { activeTab, setActiveTab, status } = useGitStore();
  const fileCount = status?.files?.length || 0;

  const tabItems: TabItem<'changes' | 'history'>[] = [
    {
      id: 'changes',
      label: 'Changes',
      badge: fileCount,
      badgeVariant: 'coral',
    },
    {
      id: 'history',
      label: 'History',
    },
  ];

  return (
    <div className="px-2.5 py-1.5 border-b border-border bg-base-0 select-none">
      <Tabs<'changes' | 'history'>
        tabs={tabItems}
        activeTab={activeTab}
        onChange={setActiveTab}
        fullWidth
        size="sm"
        ariaLabel="Sidebar views"
      />
    </div>
  );
};
