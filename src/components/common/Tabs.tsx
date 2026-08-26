import React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode | number;
  badgeVariant?: 'coral' | 'emerald' | 'purple' | 'amber' | 'neutral';
  title?: string;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'segmented' | 'coral' | 'pill';
  fullWidth?: boolean;
  iconOnly?: boolean;
  ariaLabel?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  size = 'sm',
  variant = 'segmented',
  fullWidth = false,
  iconOnly = false,
  ariaLabel,
}: TabsProps<T>) {
  const isFullHeight = className.includes('h-full');

  const sizeClasses = {
    xs: iconOnly ? 'w-6 h-5.5 px-0' : `${isFullHeight ? 'h-full' : 'h-5.5'} px-2 text-[10.5px]`,
    sm: iconOnly ? 'w-6.5 h-6.5 px-0' : `${isFullHeight ? 'h-full' : 'h-6.5'} px-2.5 text-[11px]`,
    md: iconOnly ? 'w-7.5 h-7.5 px-0' : `${isFullHeight ? 'h-full' : 'h-7.5'} px-3 text-xs`,
  };

  const getBadgeClasses = (item: TabItem<T>, isActive: boolean) => {
    const v = item.badgeVariant || (item.id === 'changes' || item.id === 'branches' ? 'coral' : 'emerald');
    if (v === 'coral') {
      return isActive
        ? 'bg-commito-coral text-white border border-commito-coral'
        : 'bg-commito-coral/15 text-commito-coral border border-commito-coral/30';
    }
    if (v === 'emerald') {
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    }
    if (v === 'purple') {
      return 'bg-purple-500/15 text-purple-300 border border-purple-500/30';
    }
    if (v === 'amber') {
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    }
    return isActive
      ? 'bg-base-3 text-text-primary border border-border'
      : 'bg-base-0 text-text-muted border border-border/60';
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center bg-base-0 border border-border rounded-sm p-0.5 gap-0.5 select-none shadow-2xs ${
        fullWidth ? 'w-full flex' : ''
      } ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        let activeClasses = '';
        if (variant === 'coral') {
          activeClasses = isActive
            ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/40 shadow-xs font-semibold'
            : 'text-text-muted hover:text-text-primary hover:bg-base-2/50 border border-transparent font-medium';
        } else if (variant === 'pill') {
          activeClasses = isActive
            ? 'bg-commito-coral text-white shadow-xs border border-commito-coral font-semibold'
            : 'text-text-muted hover:text-text-primary hover:bg-base-2/50 border border-transparent font-medium';
        } else {
          // Default segmented
          activeClasses = isActive
            ? 'bg-base-2 text-text-primary shadow-xs border border-border-strong/70 font-semibold'
            : 'text-text-muted hover:text-text-primary hover:bg-base-2/50 border border-transparent font-medium';
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            title={tab.title || (typeof tab.label === 'string' ? tab.label : undefined)}
            className={`${sizeClasses[size]} ${
              fullWidth ? 'flex-1 justify-center' : ''
            } rounded-xs flex items-center justify-center gap-1.5 transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${activeClasses}`}
          >
            {tab.icon && (
              <span
                className={`shrink-0 flex items-center justify-center transition-colors ${
                  isActive && variant !== 'segmented' ? 'text-current' : ''
                }`}
              >
                {tab.icon}
              </span>
            )}

            {!iconOnly && tab.label && (
              <span className="truncate flex items-center justify-center leading-none">
                {tab.label}
              </span>
            )}

            {!iconOnly && tab.badge !== undefined && tab.badge !== null && (
              <span
                className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-xs text-[9.5px] font-mono font-bold leading-none text-center select-none box-border ${getBadgeClasses(
                  tab,
                  isActive
                )}`}
              >
                <span className="flex items-center justify-center leading-none text-center">
                  {tab.badge}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
