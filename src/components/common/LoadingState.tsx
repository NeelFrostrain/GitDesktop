import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading...',
  className = '',
}) => {
  return (
    <div
      className={`py-8 flex flex-col items-center justify-center text-center space-y-2 select-none ${className}`}
    >
      <Loader2 className="w-5 h-5 text-commito-coral animate-spin" />
      <span className="text-xs font-semibold text-text-muted">{label}</span>
    </div>
  );
};
