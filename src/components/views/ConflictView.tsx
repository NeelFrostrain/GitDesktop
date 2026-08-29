import React from 'react';
import { AlertTriangle, FileDiff } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';

export const ConflictView: React.FC = () => {
  const { status, setSelectedFile, setActiveTab } = useGitStore();

  if (!status || !status.has_conflicts) return null;

  const conflictFiles = status.files.filter((f) => f.status === 'Conflicted');

  return (
    <div className="p-4 bg-orange-950/40 border-b border-orange-800/60 flex items-center justify-between z-20">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-900/60 border border-orange-700/80 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-orange-200">
            Merge Conflicts Detected ({conflictFiles.length} file
            {conflictFiles.length > 1 ? 's' : ''})
          </h4>
          <p className="text-[11px] text-orange-300/80">
            Resolve conflicts in your editor or select a file below to inspect line changes.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {conflictFiles.slice(0, 3).map((f) => (
          <button
            key={f.path}
            onClick={() => {
              setSelectedFile(f.path);
              setActiveTab('changes');
            }}
            className="px-2.5 py-1 bg-orange-900/40 border border-orange-700/50 hover:bg-orange-800/50 rounded text-xs font-mono text-orange-200 flex items-center gap-1.5"
          >
            <FileDiff className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px]">{f.path}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
