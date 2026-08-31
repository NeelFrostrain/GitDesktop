import { create } from 'zustand';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useSettingsStore } from '../settings/store/useSettingsStore';

export interface UpdaterState {
  isChecking: boolean;
  status: 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error';
  availableUpdate: Update | null;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage: string | null;
  lastCheckedTime: string | null;
  showBanner: boolean;

  setShowBanner: (show: boolean) => void;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismissBanner: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  isChecking: false,
  status: 'idle',
  availableUpdate: null,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  errorMessage: null,
  lastCheckedTime: null,
  showBanner: false,

  setShowBanner: (show) => set({ showBanner: show }),
  dismissBanner: () => set({ showBanner: false }),

  checkForUpdates: async (manual = false) => {
    // If not manual, verify if auto-update is enabled in settings
    if (!manual) {
      const autoUpdate = useSettingsStore.getState().getEffectiveValue('app.auto_update');
      if (autoUpdate === false) {
        return;
      }
    }

    set({ isChecking: true, errorMessage: null });
    try {
      const update = await check();
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (update) {
        set({
          availableUpdate: update,
          status: 'available',
          showBanner: true,
          lastCheckedTime: now,
          isChecking: false,
        });
      } else {
        set({
          availableUpdate: null,
          status: 'up-to-date',
          lastCheckedTime: now,
          isChecking: false,
        });
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      const userFriendlyMsg = msg.includes('404')
        ? 'No remote release published yet on GitHub.'
        : msg;
      
      set({
        isChecking: false,
        status: 'error',
        errorMessage: userFriendlyMsg,
      });
    }
  },

  downloadAndInstall: async () => {
    const { availableUpdate } = get();
    if (!availableUpdate) return;

    set({ status: 'downloading', downloadProgress: 0, errorMessage: null });
    try {
      let downloaded = 0;
      let total = 0;

      await availableUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength || 0;
            set({ totalBytes: total });
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
            set({
              downloadedBytes: downloaded,
              downloadProgress: pct,
            });
            break;
          case 'Finished':
            set({ status: 'ready', downloadProgress: 100 });
            break;
        }
      });

      // Automatically restart app to apply update
      await relaunch();
    } catch (err: any) {
      console.error('Failed to download & install update:', err);
      const rawMsg = String(err?.message || err);
      const formattedMsg = rawMsg.includes('404')
        ? 'Installer binary not found on GitHub release yet (404). Please upload the installer to the GitHub Release.'
        : `Update installation failed: ${rawMsg}`;
      set({
        status: 'error',
        errorMessage: formattedMsg,
      });
    }
  },
}));
