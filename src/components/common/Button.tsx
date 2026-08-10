import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
  size?: 'xs' | 'sm' | 'md';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

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
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition cursor-pointer select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-commito-coral/50 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[11px] rounded',
    sm: 'px-2.5 py-1 text-xs rounded-md',
    md: 'px-3.5 py-1.5 text-xs rounded-md',
  };

  const variantStyles = {
    primary: 'bg-commito-coral hover:bg-commito-coralHover text-white shadow-xs border border-transparent',
    secondary: 'bg-base-2 hover:bg-base-3 text-text-primary border border-border shadow-xs',
    danger: 'bg-base-2 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-border hover:border-red-800/40 shadow-xs',
    ghost: 'bg-transparent hover:bg-base-2 text-text-muted hover:text-text-primary border border-transparent',
    icon: 'p-1 bg-transparent hover:bg-base-2 text-text-muted hover:text-text-primary rounded-md border border-transparent',
  };

  const finalClass = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

  return (
    <button disabled={disabled || isLoading} className={finalClass} {...props}>
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
      ) : leftIcon ? (
        <span className="mr-1.5 flex items-center">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon && (
        <span className="ml-1.5 flex items-center">{rightIcon}</span>
      )}
    </button>
  );
};
