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
    <div className="space-y-3">
      <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
        Git Identity
      </label>

      {/* Name Input */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-primary block">
          Git User Name <span className="text-commito-coral">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Neel Frostrain"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-base-0 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
          required
        />
      </div>

      {/* Email Input */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-primary block">
          Git User Email <span className="text-commito-coral">*</span>
        </label>
        <input
          type="email"
          placeholder="e.g. example@email.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className={`w-full px-2.5 py-1.5 bg-base-0 border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none font-sans ${
            email && !isValidEmail(email)
              ? 'border-git-removed focus:border-danger'
              : 'border-border focus:border-commito-coral/50'
          }`}
          required
        />
        {email && !isValidEmail(email) && (
          <span className="text-[10px] text-git-removed block pt-0.5 font-medium">
            Please enter a valid email address.
          </span>
        )}
      </div>
    </div>
  );
};
