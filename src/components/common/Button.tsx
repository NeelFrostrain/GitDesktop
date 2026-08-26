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
    'transition-all duration-100 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ' +
    'active:scale-[0.98] active:translate-y-[0.5px] disabled:opacity-50 disabled:cursor-not-allowed ' +
    'disabled:active:scale-100 disabled:active:translate-y-0 disabled:pointer-events-none';

  const sizeStyles: Record<ButtonSize, string> = {
    xs: 'h-6 px-2.5 text-[11px] rounded-[5px] gap-1 shadow-2xs',
    sm: 'h-7 px-3 text-xs rounded-sm gap-1.5 shadow-xs',
    md: 'h-8 px-3.5 text-xs rounded-md gap-1.5 shadow-sm',
    lg: 'h-9 px-4 text-sm rounded-md gap-2 shadow-md',
    'icon-xs': 'w-6 h-6 p-0 text-[11px] rounded-[5px] shadow-2xs',
    'icon-sm': 'w-7 h-7 p-0 text-xs rounded-sm shadow-xs',
    'icon-md': 'w-8 h-8 p-0 text-xs rounded-md shadow-sm',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    // Red / Danger
    danger:
      'bg-gradient-to-b from-[#ff3b4e] via-[#e61930] to-[#c7091f] hover:from-[#ff596a] hover:via-[#ff3b4e] hover:to-[#e61930] active:from-[#c7091f] active:to-[#a30013] text-white border border-[#b30015] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    red:
      'bg-gradient-to-b from-[#ff3b4e] via-[#e61930] to-[#c7091f] hover:from-[#ff596a] hover:via-[#ff3b4e] hover:to-[#e61930] active:from-[#c7091f] active:to-[#a30013] text-white border border-[#b30015] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',

    // Coral / Primary (e.g. Save, Publish, Create)
    primary:
      'bg-gradient-to-b from-[#ff5733] via-[#ff3b14] to-[#e62a04] hover:from-[#ff6e4d] hover:via-[#ff5733] hover:to-[#ff3b14] active:from-[#e62a04] active:to-[#bf2000] text-white border border-[#cc2500] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    coral:
      'bg-gradient-to-b from-[#ff5733] via-[#ff3b14] to-[#e62a04] hover:from-[#ff6e4d] hover:via-[#ff5733] hover:to-[#ff3b14] active:from-[#e62a04] active:to-[#bf2000] text-white border border-[#cc2500] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',

    // Success / Emerald / Green (e.g. Merge, Confirm, Commit)
    success:
      'bg-gradient-to-b from-[#05df72] via-[#00bc5d] to-[#009949] hover:from-[#2bf38d] hover:via-[#05df72] hover:to-[#00bc5d] active:from-[#009949] active:to-[#007a3a] text-white border border-[#008f43] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    emerald:
      'bg-gradient-to-b from-[#05df72] via-[#00bc5d] to-[#009949] hover:from-[#2bf38d] hover:via-[#05df72] hover:to-[#00bc5d] active:from-[#009949] active:to-[#007a3a] text-white border border-[#008f43] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    green:
      'bg-gradient-to-b from-[#05df72] via-[#00bc5d] to-[#009949] hover:from-[#2bf38d] hover:via-[#05df72] hover:to-[#00bc5d] active:from-[#009949] active:to-[#007a3a] text-white border border-[#008f43] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',

    // Blue / Info (e.g. Sync, Pull, Details, Open)
    info:
      'bg-gradient-to-b from-[#0091ff] via-[#0077ff] to-[#005be0] hover:from-[#38a9ff] hover:via-[#0091ff] hover:to-[#0077ff] active:from-[#005be0] active:to-[#0047b3] text-white border border-[#0052cc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    blue:
      'bg-gradient-to-b from-[#0091ff] via-[#0077ff] to-[#005be0] hover:from-[#38a9ff] hover:via-[#0091ff] hover:to-[#0077ff] active:from-[#005be0] active:to-[#0047b3] text-white border border-[#0052cc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',

    // Warning / Amber / Orange (e.g. Stash, Force, Revert)
    warning:
      'bg-gradient-to-b from-[#ffb300] via-[#f59e0b] to-[#d97706] hover:from-[#ffc433] hover:via-[#ffb300] hover:to-[#f59e0b] active:from-[#d97706] active:to-[#b45309] text-white border border-[#b45309] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    amber:
      'bg-gradient-to-b from-[#ffb300] via-[#f59e0b] to-[#d97706] hover:from-[#ffc433] hover:via-[#ffb300] hover:to-[#f59e0b] active:from-[#d97706] active:to-[#b45309] text-white border border-[#b45309] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    orange:
      'bg-gradient-to-b from-[#ff7a00] via-[#f25e00] to-[#cc4900] hover:from-[#ff912e] hover:via-[#ff7a00] hover:to-[#f25e00] active:from-[#cc4900] active:to-[#a33700] text-white border border-[#b83d00] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',

    // Purple / Violet (e.g. AI Generate, Tag, Magic)
    purple:
      'bg-gradient-to-b from-[#b347ff] via-[#9e1aff] to-[#8000e6] hover:from-[#c46eff] hover:via-[#b347ff] hover:to-[#9e1aff] active:from-[#8000e6] active:to-[#6600b8] text-white border border-[#7300cc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    violet:
      'bg-gradient-to-b from-[#9966ff] via-[#8545ff] to-[#6e22ff] hover:from-[#b088ff] hover:via-[#9966ff] hover:to-[#8545ff] active:from-[#6e22ff] active:to-[#550fe6] text-white border border-[#6019eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',

    // Teal / Cyan (e.g. Terminal, Scripts, Tools)
    teal:
      'bg-gradient-to-b from-[#00d6b4] via-[#00bfa0] to-[#009e84] hover:from-[#2be8c9] hover:via-[#00d6b4] hover:to-[#00bfa0] active:from-[#009e84] active:to-[#007d68] text-white border border-[#008f77] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',
    cyan:
      'bg-gradient-to-b from-[#00d2f0] via-[#00b8d9] to-[#0096b3] hover:from-[#38e1fa] hover:via-[#00d2f0] hover:to-[#00b8d9] active:from-[#0096b3] active:to-[#00778f] text-white border border-[#008ba6] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_1px_3px_rgba(0,0,0,0.35)]',

    // Secondary / Dark Obsidian (e.g. Cancel, Done, Back, Keep Editing)
    secondary:
      'bg-gradient-to-b from-[#222025] via-[#1a191d] to-[#131215] hover:from-[#29272e] hover:via-[#201e24] hover:to-[#17161a] active:from-[#151417] active:to-[#0f0e11] text-zinc-200 hover:text-white border border-[#2d2b32] hover:border-[#3d3a44] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.3)]',
    dark:
      'bg-gradient-to-b from-[#222025] via-[#1a191d] to-[#131215] hover:from-[#29272e] hover:via-[#201e24] hover:to-[#17161a] active:from-[#151417] active:to-[#0f0e11] text-zinc-200 hover:text-white border border-[#2d2b32] hover:border-[#3d3a44] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.3)]',

    // Ghost / Glass
    ghost:
      'bg-transparent hover:bg-white/8 active:bg-white/12 text-text-secondary hover:text-text-primary border border-transparent hover:border-white/10 shadow-none',

    // Outline
    outline:
      'bg-transparent hover:bg-base-2 text-text-primary border border-border hover:border-border-strong shadow-2xs',

    // Soft Badges / Tones
    'soft-danger':
      'bg-gradient-to-b from-red-500/20 to-red-600/10 hover:from-red-500/30 hover:to-red-600/20 text-red-400 border border-red-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]',
    'soft-coral':
      'bg-gradient-to-b from-commito-coral/20 to-commito-coral/10 hover:from-commito-coral/30 hover:to-commito-coral/20 text-commito-coral border border-commito-coral/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]',
    'soft-success':
      'bg-gradient-to-b from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30 hover:to-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]',
    'soft-blue':
      'bg-gradient-to-b from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]',
  };

  const finalClass = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

  return (
    <button disabled={disabled || isLoading} className={finalClass} {...props}>
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : leftIcon ? (
        <span className="flex items-center shrink-0">{leftIcon}</span>
      ) : null}
      {children && <span className="truncate">{children}</span>}
      {!isLoading && rightIcon && (
        <span className="flex items-center shrink-0">{rightIcon}</span>
      )}
    </button>
  );
};
