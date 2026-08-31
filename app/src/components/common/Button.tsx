import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'danger'
  | 'red'
  | 'primary'
  | 'coral'
  | 'success'
  | 'emerald'
  | 'green'
  | 'info'
  | 'blue'
  | 'warning'
  | 'amber'
  | 'orange'
  | 'purple'
  | 'violet'
  | 'teal'
  | 'cyan'
  | 'secondary'
  | 'dark'
  | 'ghost'
  | 'outline'
  | 'soft-danger'
  | 'soft-coral'
  | 'soft-success'
  | 'soft-blue';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon-xs' | 'icon-sm' | 'icon-md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * 3D Tactile Glossy Button with specular top highlight, smooth gradient depth,
 * crisp typography, and interactive press states across multiple rich color variants.
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'sm',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold select-none cursor-pointer ' +
    'transition-colors duration-100 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-commito-coral/40 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

  const sizeStyles: Record<ButtonSize, string> = {
    xs: 'h-6 px-2.5 text-[11px] rounded-[5px] gap-1 shadow-2xs',
    sm: 'h-7 px-3 text-xs rounded-sm gap-1.5 shadow-xs',
    md: 'h-8 px-3.5 text-xs rounded-sm gap-1.5 shadow-sm',
    lg: 'h-9 px-4 text-sm rounded-sm gap-2 shadow-md',
    'icon-xs': 'w-6 h-6 p-0 text-[11px] rounded-[5px] shadow-2xs',
    'icon-sm': 'w-7 h-7 p-0 text-xs rounded-sm shadow-xs',
    'icon-md': 'w-8 h-8 p-0 text-xs rounded-sm shadow-sm',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    // Red / Danger
    danger:
      'bg-danger hover:bg-red-600 active:bg-red-700 text-white border border-danger/90 shadow-2xs',
    red: 'bg-danger hover:bg-red-600 active:bg-red-700 text-white border border-danger/90 shadow-2xs',

    // Coral / Primary (e.g. Save, Publish, Create)
    primary:
      'bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white border border-commito-coral/90 shadow-2xs',
    coral:
      'bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white border border-commito-coral/90 shadow-2xs',

    // Success / Emerald / Green (e.g. Merge, Confirm, Commit)
    success:
      'bg-success hover:bg-emerald-600 active:bg-emerald-700 text-white border border-success/90 shadow-2xs',
    emerald:
      'bg-success hover:bg-emerald-600 active:bg-emerald-700 text-white border border-success/90 shadow-2xs',
    green:
      'bg-success hover:bg-emerald-600 active:bg-emerald-700 text-white border border-success/90 shadow-2xs',

    // Blue / Info (e.g. Sync, Pull, Details, Open)
    info: 'bg-info hover:bg-blue-600 active:bg-blue-700 text-white border border-info/90 shadow-2xs',
    blue: 'bg-info hover:bg-blue-600 active:bg-blue-700 text-white border border-info/90 shadow-2xs',

    // Warning / Amber / Orange (e.g. Stash, Force, Revert)
    warning:
      'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white border border-amber-600/90 shadow-2xs',
    amber:
      'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white border border-amber-600/90 shadow-2xs',
    orange:
      'bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white border border-orange-600/90 shadow-2xs',

    // Purple / Violet (e.g. AI Generate, Tag, Magic)
    purple:
      'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white border border-purple-600/90 shadow-2xs',
    violet:
      'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white border border-violet-600/90 shadow-2xs',

    // Teal / Cyan (e.g. Terminal, Scripts, Tools)
    teal: 'bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white border border-teal-600/90 shadow-2xs',
    cyan: 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white border border-cyan-600/90 shadow-2xs',

    // Secondary / Dark (e.g. Cancel, Done, Back, Keep Editing) - Syncs with theme background & borders
    secondary:
      'bg-base-2 hover:bg-base-3 active:bg-base-1 text-text-primary border border-border hover:border-border-strong shadow-2xs',
    dark: 'bg-base-2 hover:bg-base-3 active:bg-base-1 text-text-primary border border-border hover:border-border-strong shadow-2xs',

    // Ghost / Glass
    ghost:
      'bg-transparent hover:bg-base-2 active:bg-base-3 text-text-secondary hover:text-text-primary border border-transparent hover:border-border/50 shadow-none',

    // Outline
    outline:
      'bg-transparent hover:bg-base-2 active:bg-base-3 text-text-primary border border-border hover:border-border-strong shadow-2xs',

    // Soft Badges / Tones
    'soft-danger': 'bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 shadow-2xs',
    'soft-coral':
      'bg-commito-coral/15 hover:bg-commito-coral/25 text-commito-coral border border-commito-coral/30 shadow-2xs',
    'soft-success':
      'bg-success/15 hover:bg-success/25 text-success border border-success/30 shadow-2xs',
    'soft-blue': 'bg-info/15 hover:bg-info/25 text-info border border-info/30 shadow-2xs',
  };

  const finalClass = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

  return (
    <button disabled={disabled || isLoading} className={finalClass} {...props}>
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : leftIcon ? (
        <span className="inline-flex items-center justify-center shrink-0 self-center leading-none">
          {leftIcon}
        </span>
      ) : null}
      {children && (
        <span className="inline-flex items-center justify-center leading-none truncate self-center">
          {children}
        </span>
      )}
      {!isLoading && rightIcon && (
        <span className="inline-flex items-center justify-center shrink-0 self-center leading-none">
          {rightIcon}
        </span>
      )}
    </button>
  );
};
