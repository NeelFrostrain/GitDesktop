import React from 'react';
import { Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isSearch?: boolean;
  error?: string;
  label?: string;
  requiredAsterisk?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ isSearch = false, error, label, requiredAsterisk = false, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1 w-full">
        {label && (
          <label className="text-xs font-bold text-text-primary block">
            {label} {requiredAsterisk && <span className="text-commito-coral">*</span>}
          </label>
        )}
        <div className="relative w-full">
          {isSearch && (
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2 pointer-events-none" />
          )}
          <input
            ref={ref}
            className={`input-field ${isSearch ? 'input-search' : ''} ${
              error ? '!border-git-removed focus:!border-danger' : ''
            } ${className}`}
            {...props}
          />
        </div>
        {error && (
          <span className="text-[10px] text-git-removed block pt-0.5 font-medium">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
