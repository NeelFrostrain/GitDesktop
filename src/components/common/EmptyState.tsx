import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`py-12 px-4 flex flex-col items-center justify-center text-center space-y-2 select-none ${className}`}>
      {icon && <div className="text-text-faint opacity-50 mb-1">{icon}</div>}
      <h3 className="text-xs font-bold text-text-primary">{title}</h3>
      {description && <p className="text-[11px] text-text-muted max-w-xs">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
