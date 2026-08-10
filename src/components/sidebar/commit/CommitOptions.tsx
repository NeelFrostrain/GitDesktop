import React, { RefObject } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { CommitOptions as CommitOptionsType } from '../../../store/useGitStore';
import { Checkbox } from '../../Checkbox';

interface CommitOptionsProps {
  options: CommitOptionsType;
  onOptionsChange: (opts: Partial<CommitOptionsType>) => void;
  isOpen: boolean;
  onToggle: () => void;
  optionsRef: RefObject<HTMLDivElement | null>;
  hasActiveOptions: boolean;
}

export const CommitOptions: React.FC<CommitOptionsProps> = ({
  options,
  onOptionsChange,
  isOpen,
  onToggle,
  optionsRef,
  hasActiveOptions,
}) => {
  return (
    <div className="relative" ref={optionsRef}>
      <button
        type="button"
        onClick={onToggle}
        title="Commit Options (Bypass Hooks, Sign-off, Allow Empty)"
        className={`p-1 rounded-md border text-xs flex items-center justify-center transition cursor-pointer ${hasActiveOptions
          ? 'bg-commito-coral/20 border-commito-coral text-commito-coral shadow-xs'
          : 'bg-base-2/80 border-border hover:bg-base-3 text-text-muted hover:text-text-primary'
          }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {hasActiveOptions && (
          <span className="w-1.5 h-1.5 rounded-full bg-commito-coral animate-pulse ml-0.5" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-1.5 w-60 bg-base-1 border border-border rounded-md shadow-2xl z-50 py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100 font-sans space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-text-muted border-b border-border mb-1">
            Commit Options
          </div>

          <div
            className="px-3 py-1.5 hover:bg-base-2 cursor-pointer transition flex items-center"
            onClick={() => onOptionsChange({ bypassHooks: !options.bypassHooks })}
          >
            <Checkbox
              checked={options.bypassHooks}
              onChange={(val) => onOptionsChange({ bypassHooks: val })}
              label={<span className="font-medium text-xs">Bypass Commit Hooks</span>}
              size="sm"
            />
          </div>

          <div
            className="px-3 py-1.5 hover:bg-base-2 cursor-pointer transition flex items-center"
            onClick={() => onOptionsChange({ signOff: !options.signOff })}
          >
            <Checkbox
              checked={options.signOff}
              onChange={(val) => onOptionsChange({ signOff: val })}
              label={<span className="font-medium text-xs">Add Signed-off-by Trailer</span>}
              size="sm"
            />
          </div>

          <div
            className="px-3 py-1.5 hover:bg-base-2 cursor-pointer transition flex items-center"
            onClick={() => onOptionsChange({ allowEmpty: !options.allowEmpty })}
          >
            <Checkbox
              checked={options.allowEmpty}
              onChange={(val) => onOptionsChange({ allowEmpty: val })}
              label={<span className="font-medium text-xs">Allow Empty Commit</span>}
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  );
};
