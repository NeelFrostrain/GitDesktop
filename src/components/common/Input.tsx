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
            className={`w-full bg-base-0 border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none font-sans transition ${
              isSearch ? 'pl-8 pr-3 py-1.5' : 'px-2.5 py-1.5'
            } ${
              error
                ? 'border-git-removed focus:border-danger'
                : 'border-border focus:border-commito-coral/50'
            } ${className}`}
            {...props}
          />
        </div>
        {error && (
          <span className="text-[10px] text-git-removed block pt-0.5 font-medium">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
