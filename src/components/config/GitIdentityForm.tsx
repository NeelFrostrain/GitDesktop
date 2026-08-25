import React from 'react';

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
  return (
    <div className="space-y-3 font-sans select-none">
      <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint block">
        Git Identity
      </label>

      {/* Name Input */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-text-primary block">
          Git User Name <span className="text-commito-coral">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Neel Frostrain"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full h-8 px-2.5 bg-base-0 border border-border hover:border-border-strong focus:border-commito-coral focus:ring-1 focus:ring-commito-coral/30 rounded-sm text-xs text-text-primary placeholder:text-text-faint font-sans focus:outline-none transition shadow-inner"
          required
        />
      </div>

      {/* Email Input */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-text-primary block">
          Git User Email <span className="text-commito-coral">*</span>
        </label>
        <input
          type="email"
          placeholder="e.g. example@email.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className={`w-full h-8 px-2.5 bg-base-0 border rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none font-mono transition shadow-inner ${
            email && !isValidEmail(email)
              ? 'border-git-removed focus:border-danger'
              : 'border-border hover:border-border-strong focus:border-commito-coral focus:ring-1 focus:ring-commito-coral/30'
          }`}
          required
        />
        {email && !isValidEmail(email) && (
          <span className="text-[10.5px] text-git-removed block pt-0.5 font-medium">
            Please enter a valid email address.
          </span>
        )}
      </div>
    </div>
  );
};
