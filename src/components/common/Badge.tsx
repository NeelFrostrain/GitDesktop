import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'accent';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  icon,
  className = '',
}) => {
  const variantStyles = {
    success: 'bg-git-added-bg text-git-added border-git-added/30',
    error: 'bg-git-removed-bg text-git-removed border-git-removed/30',
    warning: 'bg-git-modified-bg text-git-modified border-git-modified/30',
    info: 'bg-info/15 text-info border-info/30',
    neutral: 'bg-base-3 text-text-muted border-border',
    accent: 'bg-accent/20 text-accent border-accent/40',
  };

  return (
    <span
      className={`px-1.5 py-0.5 border rounded text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 leading-none ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
