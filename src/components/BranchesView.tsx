import React, { useState } from 'react';
import { GitBranch, Search } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';

export const BranchesView: React.FC = () => {
  const { status } = useGitStore();
  const [filter, setFilter] = useState('');

  const sampleBranches = [
    { name: status?.current_branch || 'main', is_current: true },
    { name: 'feature/auth-redesign', is_current: false },
    { name: 'fix/remote-git-credentials', is_current: false },
    { name: 'release/v0.1.5', is_current: false },
  ];

  const filtered = sampleBranches.filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-6 select-none space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-text-primary">Branches</h2>
          <p className="text-xs text-text-muted">Manage local and tracking branches</p>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter branches..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-base-2 border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-commito-coral/50"
          />
        </div>
      </div>

      <div className="space-y-1.5 font-sans">
        {filtered.map((b) => (
          <div
            key={b.name}
            className={`p-3 rounded-xl border flex items-center justify-between transition ${
              b.is_current
                ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText shadow-sm'
                : 'bg-base-2/60 border-border hover:bg-base-2 text-text-primary'
            }`}
          >
            <div className="flex items-center gap-3">
              <GitBranch className={`w-4 h-4 ${b.is_current ? 'text-commito-coral' : 'text-text-muted'}`} />
              <span className="font-mono text-xs font-bold">{b.name}</span>
              {b.is_current && (
                <span className="px-2 py-0.5 bg-commito-coral/20 text-commito-coral border border-commito-coral/40 rounded text-[9px] font-mono font-bold uppercase">
                  Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!b.is_current && (
                <button className="px-2.5 py-1 bg-base-3 hover:bg-base-0 border border-border rounded-lg text-xs font-semibold text-text-secondary transition">
                  Checkout
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
