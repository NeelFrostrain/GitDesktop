import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useRemoteServicesStore } from '../store/remoteStore';

interface AddRemoteFormProps {
  repoPath: string;
}

export const AddRemoteForm: React.FC<AddRemoteFormProps> = ({ repoPath }) => {
  const { addRemote } = useRemoteServicesStore();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlChange = (val: string) => {
    setUrl(val);
    if (!name && val) {
      if (val.includes('upstream')) setName('upstream');
      else if (val.includes('github.com')) setName('github');
      else if (val.includes('gitlab.com')) setName('gitlab');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setError(null);
    setIsAdding(true);
    try {
      await addRemote(repoPath, name.trim(), url.trim());
      setName('');
      setUrl('');
    } catch (err: any) {
      setError(err?.message || 'Failed to add remote');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-base-2/30 border border-dashed border-border rounded-md space-y-3 select-none">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-commito-coral" />
          <span>Add New Remote</span>
        </h4>

        {/* Quick Name Suggestions */}
        <div className="flex items-center gap-1">
          {['upstream', 'origin', 'fork'].map((suggested) => (
            <button
              key={suggested}
              type="button"
              onClick={() => setName(suggested)}
              className="px-1.5 py-0.5 rounded bg-base-3 hover:bg-base-2 text-[10px] font-mono text-text-muted hover:text-text-primary transition"
            >
              +{suggested}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-2 bg-git-removed-bg border border-git-removed/40 rounded-md text-xs text-git-removed">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. upstream)"
            className="w-full bg-base-1 border border-border rounded-md px-3 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral"
            required
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Remote Git URL (HTTPS or SSH)"
            className="flex-1 bg-base-1 border border-border rounded-md px-3 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral"
            required
          />
          <button
            type="submit"
            disabled={isAdding}
            className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
          >
            {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Add Remote</span>
          </button>
        </div>
      </div>
    </form>
  );
};
