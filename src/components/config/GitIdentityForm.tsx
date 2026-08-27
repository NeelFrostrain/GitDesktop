import React from 'react';
import { User, Mail } from 'lucide-react';

interface GitIdentityFormProps {
  name: string;
  onNameChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  isValidEmail: (val: string) => boolean;
}

export const GitIdentityForm: React.FC<GitIdentityFormProps> = ({
  name,
  onNameChange,
  email,
  onEmailChange,
  isValidEmail,
}) => {
  const isEmailValid = !email || isValidEmail(email);

  return (
    <div className="space-y-3 font-sans select-none animate-in fade-in duration-100">
      {/* Name Input */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-secondary flex items-center gap-1.5">
          <User className="w-3 h-3 text-text-muted" />
          <span>Git Author Name</span>
          <span className="text-commito-coral">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Neel Frostrain"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full h-8.5 px-3 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral focus:ring-1 focus:ring-commito-coral/30 rounded-sm text-xs text-text-primary placeholder:text-text-faint font-sans focus:outline-none transition shadow-2xs"
          required
        />
      </div>

      {/* Email Input */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-secondary flex items-center gap-1.5">
          <Mail className="w-3 h-3 text-text-muted" />
          <span>Git Author Email</span>
          <span className="text-commito-coral">*</span>
        </label>
        <input
          type="email"
          placeholder="e.g. neelofficial0812@gmail.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className={`w-full h-8.5 px-3 bg-base-1 border rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none font-mono transition shadow-2xs ${
            !isEmailValid
              ? 'border-git-removed focus:border-danger ring-1 ring-git-removed/20'
              : 'border-border hover:border-border-strong focus:border-commito-coral focus:ring-1 focus:ring-commito-coral/30'
          }`}
          required
        />
        {!isEmailValid && (
          <span className="text-[10px] text-git-removed block pt-0.5 font-medium">
            Please enter a valid email address.
          </span>
        )}
      </div>
    </div>
  );
};
