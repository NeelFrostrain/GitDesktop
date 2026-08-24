import React, { useState, useMemo } from 'react';
import { Key, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';

export const AiApiKeyManager: React.FC = () => {
  const { getEffectiveValue, setSettingValue } = useSettingsStore();
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const rawActiveKey = getEffectiveValue('ai.active_api_key') || '';
  const activeKey = String(rawActiveKey).trim();

  const rawKeys = getEffectiveValue('ai.groq_api_keys');

  const keysList = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(rawKeys)) {
      list = rawKeys.map((k) => String(k).trim()).filter(Boolean);
    } else if (typeof rawKeys === 'string' && rawKeys.trim()) {
      try {
        const parsed = JSON.parse(rawKeys);
        if (Array.isArray(parsed)) {
          list = parsed.map((k) => String(k).trim()).filter(Boolean);
        } else {
          list = [rawKeys.trim()];
        }
      } catch {
        list = [rawKeys.trim()];
      }
    }

    // Merge activeKey if not already in list
    if (activeKey && !list.includes(activeKey)) {
      list.unshift(activeKey);
    }

    return Array.from(new Set(list));
  }, [rawKeys, activeKey]);

  const effectiveActiveKey = activeKey && keysList.includes(activeKey)
    ? activeKey
    : (keysList[0] || '');

  // Auto-sync active key if it was missing or out of sync
  React.useEffect(() => {
    if (keysList.length > 0 && activeKey !== effectiveActiveKey) {
      setSettingValue('ai.active_api_key', effectiveActiveKey);
    }
  }, [keysList, activeKey, effectiveActiveKey, setSettingValue]);

  const saveKeys = async (newList: string[], newActive?: string) => {
    await setSettingValue('ai.groq_api_keys', newList);
    const active = newActive !== undefined && newActive !== '' ? newActive : newList[0] || '';
    await setSettingValue('ai.active_api_key', active);
  };

  const handleAddKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const key = newKeyInput.trim();
    if (!key) return;

    if (!keysList.includes(key)) {
      const updated = [...keysList, key];
      const newActive = effectiveActiveKey || key;
      await saveKeys(updated, newActive);
    }

    setNewKeyInput('');
    setIsAdding(false);
  };

  const handleRemoveKey = async (keyToRemove: string) => {
    const updated = keysList.filter((k) => k !== keyToRemove);
    const newActive = effectiveActiveKey === keyToRemove ? updated[0] || '' : effectiveActiveKey;
    await saveKeys(updated, newActive);
  };

  const handleSetActive = async (key: string) => {
    await setSettingValue('ai.active_api_key', key);
  };

  const maskKey = (key: string) => {
    if (key.length <= 10) return '••••••••••';
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  };

  return (
    <div className="w-full space-y-2.5 font-sans">
      {/* Keys List */}
      <div className="space-y-1.5">
        {keysList.length === 0 ? (
          <div className="p-3 bg-base-2/60 border border-dashed border-border rounded-sm text-xs text-text-muted text-center">
            No Groq API keys configured yet. Add one below to enable Commit-AI.
          </div>
        ) : (
          keysList.map((key, index) => {
            const isActive = key === effectiveActiveKey;
            return (
              <div
                key={index}
                className={`px-3 py-2 rounded-sm border flex items-center justify-between gap-3 text-xs transition ${
                  isActive
                    ? 'bg-base-2 border-commito-coral/50 shadow-2xs'
                    : 'bg-base-2/50 border-border hover:border-border-strong'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Key className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                  <span className="font-mono text-xs text-text-primary tracking-wide">
                    {maskKey(key)}
                  </span>
                  {isActive && (
                    <span className="px-1.5 py-0.2 bg-commito-coral/20 text-commito-coral text-[9px] font-semibold rounded uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      <span>Primary</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleSetActive(key)}
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-base-3 transition cursor-pointer"
                      title="Set as primary active key"
                    >
                      Make Primary
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveKey(key)}
                    className="p-1 text-text-muted hover:text-git-deleted hover:bg-base-3 rounded transition cursor-pointer"
                    title="Remove API key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add New Key Form / Button */}
      {isAdding ? (
        <form onSubmit={handleAddKey} className="p-2.5 bg-base-2 border border-border-strong rounded-sm space-y-2 animate-in fade-in duration-100">
          <div className="text-[11px] font-semibold text-text-primary">
            Add New Groq API Key
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="gsk_..."
              value={newKeyInput}
              onChange={(e) => setNewKeyInput(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-base-0 border border-border focus:border-border-strong rounded-sm text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newKeyInput.trim()}
              className="px-3 py-1.5 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 text-white rounded-sm text-xs font-semibold shadow-xs cursor-pointer active:scale-95 transition"
            >
              Add Key
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewKeyInput('');
              }}
              className="px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-base-3 rounded-sm cursor-pointer transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="px-3 py-1.5 bg-base-2 hover:bg-base-3 text-text-primary border border-border hover:border-border-strong rounded-sm text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-98"
        >
          <Plus className="w-3.5 h-3.5 text-commito-coral" />
          <span>Add Groq API Key</span>
        </button>
      )}
    </div>
  );
};
