import React from 'react';
import { ProviderKind } from '../types';
import { User } from 'lucide-react';

interface ProviderBadgeProps {
  provider: ProviderKind | string;
  className?: string;
}

export const ProviderBadge: React.FC<ProviderBadgeProps> = ({ provider, className = '' }) => {
  const p = (provider || '').toLowerCase();

  if (p === 'gitlab') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-commito-coral/10 border border-commito-coral/30 text-commito-coral text-[10px] font-mono font-bold tracking-wide select-none ${className}`}
      >
        <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="m23.6 9.6-2.1-6.5c-.2-.6-.9-.9-1.5-.6l-4.5 3.3H8.5L4 2.5C3.4 2.2 2.7 2.5 2.5 3.1L.4 9.6c-.2.5 0 1.1.4 1.4L12 19.8l11.2-8.8c.4-.3.6-.9.4-1.4z" />
        </svg>
        <span>GitLab</span>
      </span>
    );
  }

  if (p === 'bitbucket') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-blue-950/40 border border-blue-800/40 text-blue-400 text-[10px] font-mono font-bold tracking-wide select-none ${className}`}
      >
        <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.517.865 1.022.865h15.244a.774.774 0 0 0 .769-.646l3.475-20.03a.77.77 0 0 0-.769-.891H.778zM14.52 14.36H9.414L8.14 7.026h7.79l-1.41 7.334z" />
        </svg>
        <span>Bitbucket</span>
      </span>
    );
  }

  if (p === 'azure' || p === 'azure devops' || p === 'azure_devops') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-sky-950/40 border border-sky-800/40 text-sky-400 text-[10px] font-mono font-bold tracking-wide select-none ${className}`}
      >
        <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 8.877L2.247 5.81l6.434-2.383 6.945 2.658L24 1.576v18.784l-7.986 2.064-7.441-3.238L2.43 21.05 0 17.518V8.877zm8.43 7.828l7.19-2.736V8.196L8.43 5.485v11.22z" />
        </svg>
        <span>Azure DevOps</span>
      </span>
    );
  }

  if (p === 'custom') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-[10px] font-mono font-bold tracking-wide select-none ${className}`}
      >
        <User className="w-2.5 h-2.5 flex-shrink-0" />
        <span>Git Identity</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-purple-950/40 border border-purple-800/40 text-purple-400 text-[10px] font-mono font-bold tracking-wide select-none ${className}`}
    >
      <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
      <span>GitHub</span>
    </span>
  );
};
