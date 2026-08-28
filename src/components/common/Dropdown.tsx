import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  badge?: string;
}

export interface DropdownProps<T = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Dropdown<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  icon,
  className = '',
  disabled = false,
  size = 'md',
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight?: number;
  }>({ left: 0, top: 0, width: 200, maxHeight: 240 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuEl = menuRef.current;
    const estimatedHeight = Math.min(240, Math.max(40, options.length * 36 + 12));
    const menuHeight = menuEl ? menuEl.offsetHeight : estimatedHeight;
    const menuWidth = Math.max(triggerRect.width, 200);

    const spaceBelow = window.innerHeight - triggerRect.bottom - 8;
    const spaceAbove = triggerRect.top - 8;

    // Open upwards if not enough space below and more space above
    const openUpwards = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    const left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - menuWidth - 8));
    const top = openUpwards
      ? Math.max(8, triggerRect.top - menuHeight - 4)
      : triggerRect.bottom + 4;

    const maxAllowedHeight = openUpwards ? Math.max(100, spaceAbove) : Math.max(100, spaceBelow);

    setMenuCoords({
      left,
      top,
      width: menuWidth,
      maxHeight: Math.min(240, maxAllowedHeight),
    });
  }, [options.length]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(240, Math.max(40, options.length * 36 + 12));
      const menuWidth = Math.max(triggerRect.width, 200);
      const spaceBelow = window.innerHeight - triggerRect.bottom - 8;
      const spaceAbove = triggerRect.top - 8;
      const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

      const left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - menuWidth - 8));
      const top = openUpwards
        ? Math.max(8, triggerRect.top - estimatedHeight - 4)
        : triggerRect.bottom + 4;

      setMenuCoords({
        left,
        top,
        width: menuWidth,
        maxHeight: Math.min(240, openUpwards ? spaceAbove : spaceBelow),
      });
    }
    setIsOpen(!isOpen);
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: 'h-7 px-2.5 text-xs',
    md: 'h-8 px-2.5 text-xs',
  };

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-text-primary transition select-none cursor-pointer focus:outline-none focus:border-commito-coral shadow-2xs ${
          isOpen ? 'border-commito-coral ring-1 ring-commito-coral/30' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${sizeClasses[size]}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {(icon || selectedOption?.icon) && (
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              {icon || selectedOption?.icon}
            </span>
          )}
          <span className="truncate font-sans text-xs text-text-primary/90 font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-commito-coral' : ''
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              left: `${menuCoords.left}px`,
              top: `${menuCoords.top}px`,
              width: `${menuCoords.width}px`,
              maxHeight: menuCoords.maxHeight ? `${menuCoords.maxHeight}px` : undefined,
            }}
            className="fixed z-[10002] bg-base-0 border border-border-strong rounded-sm shadow-2xl p-1 text-xs select-none font-sans text-text-primary/90 animate-in fade-in zoom-in-95 duration-100 overflow-y-auto space-y-0.5 scrollbar-thin ring-1 ring-black/40"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-text-muted italic text-center">
                No options available
              </div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-2.5 py-1.5 rounded-sm flex items-center justify-between gap-2 transition text-left cursor-pointer ${
                      isSelected
                        ? 'bg-commito-coral/15 text-commito-coral font-semibold border border-commito-coral/30'
                        : 'hover:bg-base-1 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 font-sans text-xs">
                      {opt.icon && (
                        <span className="w-4 h-4 flex items-center justify-center shrink-0">
                          {opt.icon}
                        </span>
                      )}
                      <div className="truncate min-w-0">
                        <span className="block truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="block text-[10.5px] text-text-muted font-sans truncate">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="px-1.5 py-0.2 bg-base-1 border border-border rounded-xs text-[9.5px] font-mono text-text-muted">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-commito-coral shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
