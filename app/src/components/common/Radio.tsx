import React from 'react';

export type RadioVariant = 'coral' | 'emerald' | 'blue';
export type RadioSize = 'sm' | 'md' | 'lg';

export interface RadioProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  name?: string;
  value?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  size?: RadioSize;
  variant?: RadioVariant;
  id?: string;
}

export const Radio: React.FC<RadioProps> = ({
  checked = false,
  onChange,
  name,
  value,
  label,
  description,
  disabled = false,
  className = '',
  size = 'md',
  variant = 'coral',
  id,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    if (!checked) {
      onChange(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || !onChange) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!checked) {
        onChange(true);
      }
    }
  };

  const outerSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const dotSizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const variantStyles = {
    coral: {
      checkedBorder: 'border-commito-coral',
      checkedBg: 'bg-commito-coral/10',
      dotBg: 'bg-commito-coral shadow-2xs',
      hoverBorder: 'group-hover:border-commito-coral/70',
    },
    emerald: {
      checkedBorder: 'border-emerald-500',
      checkedBg: 'bg-emerald-500/10',
      dotBg: 'bg-emerald-500 shadow-2xs',
      hoverBorder: 'group-hover:border-emerald-500/70',
    },
    blue: {
      checkedBorder: 'border-sky-500',
      checkedBg: 'bg-sky-500/10',
      dotBg: 'bg-sky-500 shadow-2xs',
      hoverBorder: 'group-hover:border-sky-500/70',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <label
      id={id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      className={`inline-flex items-start gap-2.5 select-none font-sans ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer group'
      } ${className}`}
    >
      {/* Custom Circular Radio Target */}
      <div
        className={`relative flex items-center justify-center rounded-full border transition-all duration-150 shrink-0 mt-0.5 ${
          outerSizeClasses[size]
        } ${
          checked
            ? `${currentVariant.checkedBorder} ${currentVariant.checkedBg} shadow-2xs`
            : `bg-base-0 border-border hover:border-border-strong ${currentVariant.hoverBorder}`
        }`}
      >
        {/* Hidden native input for form accessibility */}
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChange && !disabled && onChange(true)}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
        />

        {/* Custom Inner Indicator Dot */}
        {checked && (
          <span
            className={`rounded-full ${dotSizeClasses[size]} ${currentVariant.dotBg} animate-in zoom-in-50 duration-100`}
          />
        )}
      </div>

      {(label || description) && (
        <div className="space-y-0.5 min-w-0 flex-1">
          {label && (
            <div className="text-xs font-semibold text-text-primary group-hover:text-text-primary transition-colors leading-tight">
              {label}
            </div>
          )}
          {description && (
            <div className="text-[11px] text-text-muted leading-relaxed">{description}</div>
          )}
        </div>
      )}
    </label>
  );
};
