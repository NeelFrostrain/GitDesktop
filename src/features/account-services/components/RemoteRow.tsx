import React, { useState } from 'react';
import {
  Globe,
  Check,
  Edit2,
  Trash2,
  Star,
  Loader2,
  Key,
} from 'lucide-react';
import { RemoteInfo } from '../types';
import { useRemoteServicesStore } from '../store/remoteStore';
import { useAccountServicesStore } from '../store/accountStore';

interface RemoteRowProps {
  remote: RemoteInfo;
  repoPath: string;
}

export const RemoteRow: React.FC<RemoteRowProps> = ({ remote, repoPath }) => {
  const { setRemoteUrl, removeRemote, setDefaultRemote } = useRemoteServicesStore();
  const { accounts } = useAccountServicesStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editedUrl, setEditedUrl] = useState(remote.url);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Find matching account credentials for remote host
  const matchingAccount = accounts.find((acc) => {
    try {
      const remoteHost = new URL(remote.url).host.toLowerCase();
      const accHost = new URL(acc.instance_url).host.toLowerCase();
      return remoteHost === accHost;
    } catch {
      return false;
    }
  });

  const handleSaveUrl = async () => {
    if (!editedUrl.trim()) return;
    setIsSaving(true);
    try {
      await setRemoteUrl(repoPath, remote.name, editedUrl.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Remove remote '${remote.name}'?`)) {
      setIsDeleting(true);
      try {
        await removeRemote(repoPath, remote.name);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleSetDefault = async () => {
    await setDefaultRemote(repoPath, remote.name);
  };

  return (
    <div className="p-3.5 rounded-xl bg-base-2/50 border border-border hover:border-border-strong transition flex flex-col gap-2 select-none">
      <div className="flex items-center justify-between gap-3">
        {/* Remote Name & Default Badge */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gitlab-teal flex-shrink-0" />
          <span className="font-bold text-xs text-text-primary font-mono">
            {remote.name}
          </span>
          {remote.is_default && (
            <span className="px-2 py-0.5 rounded-full bg-gitlab-teal/20 border border-gitlab-teal/40 text-gitlab-teal text-[10px] font-bold">
              Default
            </span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {!remote.is_default && (
            <button
              onClick={handleSetDefault}
              className="p-1 rounded-md text-text-muted hover:text-amber-400 hover:bg-base-3 transition cursor-pointer text-xs flex items-center gap-1 font-semibold"
              title="Set as default push/pull remote"
            >
              <Star className="w-3.5 h-3.5" />
              <span>Set Default</span>
            </button>
          )}

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-base-3 transition cursor-pointer"
            title="Edit Remote URL"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
            title="Delete Remote"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* URL Display / Inline Editor */}
      {isEditing ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={editedUrl}
            onChange={(e) => setEditedUrl(e.target.value)}
            className="flex-1 bg-base-1 border border-border rounded-md px-2.5 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-commito-coral"
          />
          <button
            onClick={handleSaveUrl}
            disabled={isSaving}
            className="px-2.5 py-1 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            <span>Save</span>
          </button>
        </div>
      ) : (
        <p className="text-xs text-text-muted font-mono truncate" title={remote.url}>
          {remote.url}
        </p>
      )}

      {/* Matching Credential Note */}
      {matchingAccount && (
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted pt-1 border-t border-border/40">
          <Key className="w-3 h-3 text-[#fc6d26]" />
          <span>Uses {matchingAccount.handle}'s credentials for authentication</span>
        </div>
      )}
    </div>
  );
};
