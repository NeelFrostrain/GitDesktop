import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface GitRuntimeInfo {
  is_available: boolean;
  version?: string | null;
  executable_path?: string | null;
  is_portable_mingit: boolean;
  mingit_installed: boolean;
  mingit_dir?: string | null;
}

export interface MinGitProgress {
  status: 'starting' | 'downloading' | 'extracting' | 'completed' | 'error';
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
  message: string;
}

export function useGitRuntime() {
  const [runtimeInfo, setRuntimeInfo] = useState<GitRuntimeInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [progress, setProgress] = useState<MinGitProgress | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState<boolean>(false);

  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const info = await invoke<GitRuntimeInfo>('git_runtime_get_status');
      setRuntimeInfo(info);
      // Don't auto-show the modal — MinGit downloads silently in the background.
      // The modal is only opened manually (e.g., from Settings or Header button).
      return info;
    } catch (err) {
      console.error('Failed to detect Git runtime:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installMinGit = useCallback(async () => {
    try {
      setIsInstalling(true);
      const info = await invoke<GitRuntimeInfo>('git_runtime_install_mingit');
      setRuntimeInfo(info);
      setShowInstallPrompt(false);
      return info;
    } catch (err) {
      console.error('Failed to install MinGit:', err);
      throw err;
    } finally {
      setIsInstalling(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    let unlisten: (() => void) | undefined;
    listen<MinGitProgress>('mingit:download:progress', (event) => {
      setProgress(event.payload);
      if (event.payload.status === 'completed') {
        setIsInstalling(false);
        checkStatus();
      } else if (event.payload.status === 'error') {
        setIsInstalling(false);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [checkStatus]);

  return {
    runtimeInfo,
    isLoading,
    isInstalling,
    progress,
    showInstallPrompt,
    setShowInstallPrompt,
    checkStatus,
    installMinGit,
  };
}
