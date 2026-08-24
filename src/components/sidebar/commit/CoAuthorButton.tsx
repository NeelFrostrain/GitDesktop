import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Bot } from 'lucide-react';
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

const PRESET_BOTS: CoAuthorSuggestion[] = [
  {
    id: 'copilot',
    name: 'Copilot',
    username: 'copilot',
    email: 'copilot@github.com',
    provider: 'github',
    isBot: true,
  },
  {
    id: 'dependabot',
    name: 'dependabot[bot]',
    username: 'dependabot',
    email: 'dependabot[bot]@users.noreply.github.com',
    provider: 'github',
    isBot: true,
  },
];

export const CoAuthorButton: React.FC<CoAuthorButtonProps> = ({ onAddCoAuthor }) => {
  const { user, accounts } = useGitStore();
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Build deduplicated suggestions list across bots, active user, and saved accounts
  const allSuggestions: CoAuthorSuggestion[] = [];
  const seenKeys = new Set<string>();

  PRESET_BOTS.forEach((bot) => {
    seenKeys.add(bot.username.toLowerCase());
    if (bot.email) seenKeys.add(bot.email.toLowerCase());
    allSuggestions.push(bot);
  });

  if (user) {
    const handle = (user.username || user.name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const primaryKey = email || handle;

    if (primaryKey && !seenKeys.has(primaryKey) && !seenKeys.has(handle)) {
      if (handle) seenKeys.add(handle);
      if (email) seenKeys.add(email);
      allSuggestions.push({
        id: `user:${user.id || primaryKey}`,
        name: user.name || user.username,
        username: user.username || user.name,
        email: user.email || `${handle}@users.noreply.github.com`,
        avatar_url: user.avatar_url,
        provider: user.provider,
      });
    }
  }

  accounts.forEach((acc) => {
    const handle = (acc.username || acc.name || '').toLowerCase();
    const email = (acc.email || '').toLowerCase();
    const primaryKey = email || handle;

    if (primaryKey && !seenKeys.has(primaryKey) && !seenKeys.has(handle)) {
      if (handle) seenKeys.add(handle);
      if (email) seenKeys.add(email);
      allSuggestions.push({
        id: `acc:${acc.id || primaryKey}`,
        name: acc.name || acc.username,
        username: acc.username || acc.name,
        email: acc.email || `${handle}@users.noreply.github.com`,
        avatar_url: acc.avatar_url,
        provider: acc.provider,
      });
    }
  });

  const query = username.trim().replace(/^@/, '').toLowerCase();
  const filteredSuggestions = query
    ? allSuggestions.filter(
        (s) =>
          s.username.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query)
      )
    : allSuggestions;

  useEffect(() => {
    setSelectedIndex(0);
  }, [username]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const updatePos = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 260;

      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - menuWidth - 12);
      }
      if (left < 12) {
        left = 12;
      }

      // Anchor bottom edge 6px directly above top edge of button
      const bottom = Math.max(12, window.innerHeight - rect.top + 6);

      setMenuStyle({
        position: 'fixed',
        bottom: `${bottom}px`,
        left: `${left}px`,
        width: `${menuWidth}px`,
        zIndex: 9999,
      });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, [isOpen]);

  const selectSuggestion = (sugg: CoAuthorSuggestion) => {
    const trailer = `Co-authored-by: ${sugg.name} <${sugg.email}>`;
    onAddCoAuthor(trailer);
    setUsername('');
    setIsOpen(false);
  };

  const handleAddCustom = () => {
    const raw = username.trim().replace(/^@/, '');
    if (!raw) return;

    let trailer = '';
    if (raw.includes('@')) {
      const handle = raw.split('@')[0];
      trailer = `Co-authored-by: ${handle} <${raw}>`;
    } else {
      trailer = `Co-authored-by: ${raw} <${raw}@users.noreply.github.com>`;
    }

    onAddCoAuthor(trailer);
    setUsername('');
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
    <div className="relative inline-block" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Add Co-Author (Co-authored-by)"
        className="p-1 rounded-sm bg-base-2/80 border border-border hover:bg-base-3 text-text-muted hover:text-text-primary transition cursor-pointer text-xs flex items-center justify-center"
      >
        <UserPlus className="w-3.5 h-3.5" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="bg-base-1 border border-border rounded-sm shadow-2xl p-2 text-xs select-none animate-in fade-in zoom-in-95 duration-100 font-sans space-y-1.5"
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted px-1.5 pt-0.5 pb-1 border-b border-border flex items-center justify-between">
              <span>Co-Authors</span>
              <span className="font-mono text-[9px] text-text-faint">@username</span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleAddCustom(); }}>
              <input
                type="text"
                placeholder="Co-Authors @username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-2.5 py-1.5 bg-base-0 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
              />
            </form>

            <div className="max-h-40 overflow-y-auto space-y-0.5">
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
                          ? 'bg-commito-coral/20 text-commito-coral font-bold'
                          : 'hover:bg-base-2 text-text-primary'
                      }`}
                    >
                      {item.isBot ? (
                        <div className="w-5 h-5 rounded-full bg-commito-coral/20 text-commito-coral border border-commito-coral/40 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3 h-3 text-commito-coral" />
                        </div>
                      ) : (
                        <UserAvatar
                          url={item.avatar_url}
                          name={item.name || item.username}
                          provider={item.provider}
                          className="w-5 h-5"
                          iconClassName="w-3 h-3"
                        />
                      )}

                      <div className="truncate flex-1 min-w-0">
                        <div className="truncate flex items-center gap-1.5">
                          <span className="font-bold text-xs">{item.name || item.username}</span>
                          <span className="text-[10px] text-text-muted font-mono truncate">
                            {item.email}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  onClick={handleAddCustom}
                  className="px-2.5 py-1.5 text-xs text-text-muted italic hover:bg-base-2 rounded cursor-pointer truncate"
                >
                  Add "{username}" as custom co-author
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
