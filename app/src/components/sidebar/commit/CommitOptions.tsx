import React, { RefObject, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal } from 'lucide-react';
import { CommitOptions as CommitOptionsType } from '../../../store/useGitStore';
import { Checkbox } from '../../common/Checkbox';

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
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen || !optionsRef.current) return;

    const updatePosition = () => {
      if (!optionsRef.current) return;
      const rect = optionsRef.current.getBoundingClientRect();
      const menuWidth = 240;
      const menuHeight = 145;

      // Horizontal positioning: keep strictly within viewport padding
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - menuWidth - 12);
      }
      if (left < 12) {
        left = 12;
      }

      // Vertical positioning: default open above button, fallback below if near top
      let top = rect.top - menuHeight - 6;
      if (top < 12) {
        top = rect.bottom + 6;
      }

      setMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${menuWidth}px`,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, optionsRef]);

  return (
    <div className="relative inline-block" ref={optionsRef}>
      <button
        type="button"
        onClick={onToggle}
        title="Commit Options (Bypass Hooks, Sign-off, Allow Empty)"
        className={`p-1 rounded-sm border text-xs flex items-center justify-center transition cursor-pointer ${
          hasActiveOptions
            ? 'bg-commito-coral/20 border-commito-coral text-commito-coral shadow-xs'
            : 'bg-base-2/80 border-border hover:bg-base-3 text-text-muted hover:text-text-primary'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {hasActiveOptions && (
          <span className="w-1.5 h-1.5 rounded-full bg-commito-coral animate-pulse ml-0.5" />
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            style={menuStyle}
            className="bg-base-1 border border-border rounded-sm shadow-2xl py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100 font-sans space-y-0.5"
          >
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
          </div>,
          document.body
        )}
    </div>
  );
};
