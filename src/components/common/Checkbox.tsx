import React from 'react';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked = false,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
  className = '',
  size = 'md',
  id,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || !onChange) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const sizeClasses = {
    sm: 'w-3.5 h-3.5 rounded-sm',
    md: 'w-4 h-4 rounded-sm',
    lg: 'w-5 h-5 rounded-sm',
  };

  const iconSizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
  };

  const isSelected = checked || indeterminate;

  return (
    <label
      id={id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      className={`inline-flex items-center gap-2 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer group'
      } ${className}`}
    >
      <div
        className={`flex items-center justify-center border transition-all duration-150 flex-shrink-0 ${sizeClasses[size]} ${
          isSelected
            ? 'bg-commito-coral border-commito-coral text-white shadow-xs shadow-commito-coral/25'
            : 'bg-base-1/90 border-border/70 group-hover:border-commito-coral/60 group-hover:bg-base-2 text-transparent'
        }`}
      >
        {indeterminate ? (
          <Minus className={`${iconSizeClasses[size]} stroke-[3] animate-in zoom-in-75 duration-100`} />
        ) : checked ? (
          <Check className={`${iconSizeClasses[size]} stroke-[3] animate-in zoom-in-75 duration-100`} />
        ) : null}
      </div>

      {label && (
        <span className="text-xs text-text group-hover:text-text transition-colors font-sans">
          {label}
        </span>
      )}
    </label>
  );
};
