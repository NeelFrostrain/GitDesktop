import React, { useState } from 'react';
import { Search, Plus, CheckSquare, User, GitPullRequest } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';

export const TopBar: React.FC = () => {
  const { user, setIsRepoModalOpen, setCurrentNavView } = useGitStore();
  const [searchQuery, setSearchQuery] = useState('');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-12 bg-base-1 border-b border-border px-5 flex items-center justify-between select-none z-30">
      {/* Left: Search input */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="relative w-full max-w-md">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or go to..."
            className="w-full pl-8 pr-8 py-1 bg-base-1 border border-border-strong rounded-md text-[13px] text-text-primary placeholder-text-muted focus:outline-none focus:border-gitlab-orange transition"
          />
          <kbd className="absolute right-2.5 top-1.5 px-1.5 py-0.2 bg-base-2 border border-border rounded text-[11px] font-mono text-text-faint">
            /
          </kbd>
        </div>
      </div>

      {/* Right: Quick actions & User Avatar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsRepoModalOpen(true)}
          className="p-1.5 rounded-md hover:bg-base-2 text-text-secondary hover:text-text-primary transition"
          title="Create or Clone Repository"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCurrentNavView('merge-requests')}
          className="p-1.5 rounded-md hover:bg-base-2 text-text-secondary hover:text-text-primary transition flex items-center gap-1"
          title="Merge Requests"
        >
          <GitPullRequest className="w-4 h-4" />
          <span className="text-[11px] font-mono text-text-muted">0</span>
        </button>

        <button
          onClick={() => setCurrentNavView('todos')}
          className="p-1.5 rounded-md hover:bg-base-2 text-text-secondary hover:text-text-primary transition flex items-center gap-1"
          title="To-Do List"
        >
          <CheckSquare className="w-4 h-4" />
          <span className="text-[11px] font-mono text-text-muted">0</span>
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* User Initials Avatar */}
        <button
          onClick={() => setIsRepoModalOpen(true)}
          className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-border transition"
          title={user ? `${user.name} (@${user.username})` : 'Sign in to GitLab'}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" className="w-7 h-7 rounded-full border border-border" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gitlab-purple text-gitlab-purpleLight text-[11px] font-medium flex items-center justify-center border border-gitlab-purple/40">
              {user ? getInitials(user.name) : <User className="w-3.5 h-3.5" />}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
