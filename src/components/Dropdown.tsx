import React, { useState, useEffect, useRef } from 'react';
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
  const [menuCoords, setMenuCoords] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 200 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220));
      const top = rect.bottom + 4 > window.innerHeight - 250 ? rect.top - 240 : rect.bottom + 4;
      setMenuCoords({
        left,
        top,
        width: Math.max(rect.width, 200),
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
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

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-xs',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 bg-base-2/80 hover:bg-base-2 border border-border hover:border-commito-coral/50 rounded-lg text-text-primary transition select-none cursor-pointer focus:outline-none focus:border-commito-coral ${
          isOpen ? 'border-commito-coral ring-1 ring-commito-coral/30' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${sizeClasses[size]}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {icon || selectedOption?.icon}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 flex-shrink-0 ${isOpen ? 'rotate-180 text-commito-coral' : ''}`} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              left: `${menuCoords.left}px`,
              top: `${menuCoords.top}px`,
              minWidth: `${menuCoords.width}px`,
            }}
            className="fixed z-[9999] bg-base-1/95 backdrop-blur-md border border-border rounded-xl shadow-2xl p-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto"
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
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2.5 transition text-left cursor-pointer ${
                      isSelected
                        ? 'bg-commito-activeBg text-commito-activeText font-semibold'
                        : 'hover:bg-base-2 text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {opt.icon}
                      <div className="truncate">
                        <span className="block truncate font-medium">{opt.label}</span>
                        {opt.description && (
                          <span className="block text-[10px] text-text-muted truncate">{opt.description}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {opt.badge && (
                        <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded text-[10px] font-mono text-text-muted">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-commito-coral" />}
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
