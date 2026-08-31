import React, { useState, useRef, useEffect } from 'react';
import { UserPlus, Search, X } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { UserAvatar } from '../../common/UserAvatar';

interface CoAuthorButtonProps {
  onAddCoAuthor: (trailer: string) => void;
}

interface CoAuthorSuggestion {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  provider?: string;
  isBot?: boolean;
}

export const CoAuthorButton: React.FC<CoAuthorButtonProps> = ({ onAddCoAuthor }) => {
  const { user, accounts } = useGitStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build suggestions from saved accounts (excluding active author to prevent self-coauthoring)
  const currentAuthorEmail = (user?.email || '').toLowerCase().trim();
  const currentAuthorName = (user?.username || user?.name || '').toLowerCase().trim();

  const allSuggestions: CoAuthorSuggestion[] = [];
  const seenEmails = new Set<string>();
  if (currentAuthorEmail) seenEmails.add(currentAuthorEmail);

  accounts.forEach((acc) => {
    const handle = (acc.username || acc.name || '').trim();
    const email = (acc.email || `${handle.toLowerCase()}@users.noreply.github.com`).trim();
    const emailLower = email.toLowerCase();

    if (emailLower && !seenEmails.has(emailLower) && handle.toLowerCase() !== currentAuthorName) {
      seenEmails.add(emailLower);
      allSuggestions.push({
        id: `acc:${acc.id || email}`,
        name: acc.name || acc.username,
        username: acc.username || acc.name,
        email: email,
        avatar_url: acc.avatar_url,
        provider: acc.provider,
      });
    }
  });

  const cleanQuery = query.trim().replace(/^@/, '').toLowerCase();
  const filteredSuggestions = cleanQuery
    ? allSuggestions.filter(
        (s) =>
          s.username.toLowerCase().includes(cleanQuery) ||
          s.name.toLowerCase().includes(cleanQuery) ||
          s.email.toLowerCase().includes(cleanQuery)
      )
    : allSuggestions;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectSuggestion = (sugg: CoAuthorSuggestion) => {
    const trailer = `Co-authored-by: ${sugg.name} <${sugg.email}>`;
    onAddCoAuthor(trailer);
    setQuery('');
    setIsOpen(false);
  };

  const handleAddCustom = () => {
    const raw = query.trim().replace(/^@/, '');
    if (!raw) return;

    let trailer = '';
    if (raw.includes('<') && raw.includes('>')) {
      trailer = `Co-authored-by: ${raw}`;
    } else if (raw.includes('@')) {
      const handle = raw.split('@')[0];
      trailer = `Co-authored-by: ${handle} <${raw}>`;
    } else {
      trailer = `Co-authored-by: ${raw} <${raw}@users.noreply.github.com>`;
    }

    onAddCoAuthor(trailer);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredSuggestions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, filteredSuggestions.length - 1) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSuggestions.length > 0 && filteredSuggestions[selectedIndex]) {
        selectSuggestion(filteredSuggestions[selectedIndex]);
      } else {
        handleAddCustom();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Add Co-Author (Co-authored-by: Name <email>)"
        className={`p-1 rounded-sm transition cursor-pointer text-xs flex items-center justify-center ${
          isOpen
            ? 'bg-commito-coral/15 text-commito-coral'
            : 'text-text-muted hover:text-text-primary hover:bg-base-2'
        }`}
      >
        <UserPlus className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-0 mb-2 w-72 bg-base-1 border border-border-strong rounded-sm shadow-2xl p-2.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100 font-sans space-y-2 z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between text-text-muted pb-1 border-b border-border/60">
            <span className="font-semibold text-[11px] text-text-primary">Add Co-Author</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-0.5 rounded text-text-faint hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-text-faint absolute left-2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Name, @username, or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-7 pr-2.5 py-1.5 bg-base-0 border border-border focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none font-sans"
            />
          </div>

          {/* Suggestions List */}
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => selectSuggestion(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-2 py-1.5 rounded-sm cursor-pointer flex items-center gap-2 transition ${
                      isSelected
                        ? 'bg-base-2 text-text-primary font-medium'
                        : 'hover:bg-base-2/60 text-text-primary'
                    }`}
                  >
                    <UserAvatar
                      url={item.avatar_url}
                      name={item.name || item.username}
                      provider={item.provider}
                      className="w-5 h-5 flex-shrink-0"
                      iconClassName="w-3 h-3"
                    />

                    <div className="truncate flex-1 min-w-0 flex flex-col">
                      <span className="font-medium text-xs text-text-primary truncate">
                        {item.name || item.username}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono truncate">
                        {item.email}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : query.trim() ? (
              <div
                onClick={handleAddCustom}
                className="px-2 py-1.5 text-xs text-text-primary hover:bg-base-2 rounded-sm cursor-pointer flex items-center gap-1.5 group"
              >
                <UserPlus className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                <span className="truncate">
                  Add{' '}
                  <span className="font-semibold text-commito-coral">
                    &ldquo;{query.trim()}&rdquo;
                  </span>{' '}
                  as co-author
                </span>
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-text-faint">
                Type a name or email to add as co-author
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
