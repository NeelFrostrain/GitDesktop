import { openUrl } from '@tauri-apps/plugin-opener';

export interface TelemetryPayload {
  clientId: string;
  appVersion: string;
  platform: string;
  timestamp: string;
}

export interface OnboardingRegistrationPayload extends TelemetryPayload {
  username: string;
  email?: string;
}

export const STORAGE_CLIENT_ID_KEY =
  (import.meta.env.VITE_STORAGE_CLIENT_ID_KEY as string) || 'cyronic_client_id';
export const STORAGE_REGISTERED_KEY =
  (import.meta.env.VITE_STORAGE_REGISTERED_KEY as string) || 'cyronic_user_registered';
export const TELEMETRY_ENDPOINT =
  (import.meta.env.VITE_TELEMETRY_ENDPOINT as string) || 'https://api.cyronicstudio.com/v1/telemetry';
export const CYRONIC_WEBSITE_URL =
  (import.meta.env.VITE_CYRONIC_WEBSITE_URL as string) || 'https://cyronicstudio.com';
export const CYRONIC_SUPPORT_EMAIL =
  (import.meta.env.VITE_CYRONIC_SUPPORT_EMAIL as string) || 'support@cyronicstudio.com';
export const CYRONIC_DISCORD_URL =
  (import.meta.env.VITE_CYRONIC_DISCORD_URL as string) || 'https://discord.gg/cyronicstudio';

export class TelemetryService {
  /**
   * Returns a persistent anonymous client UUID for this installation.
   */
  static getClientId(): string {
    try {
      let id = localStorage.getItem(STORAGE_CLIENT_ID_KEY);
      if (!id) {
        id = `cyronic-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        localStorage.setItem(STORAGE_CLIENT_ID_KEY, id);
      }
      return id;
    } catch {
      return `cyronic-temp-${Date.now()}`;
    }
  }

  /**
   * Determines current OS platform safely.
   */
  static getPlatform(): string {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('win')) return 'windows';
      if (ua.includes('mac')) return 'macos';
      if (ua.includes('linux')) return 'linux';
    }
    return 'desktop';
  }

  /**
   * Sends an anonymous active heartbeat ping on application startup.
   * Completely non-blocking and fails gracefully without disrupting offline workflow.
   */
  static async sendAppActivePing(): Promise<void> {
    const payload: TelemetryPayload = {
      clientId: this.getClientId(),
      appVersion: '0.1.0',
      platform: this.getPlatform(),
      timestamp: new Date().toISOString(),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Attempt anonymous ping to CyronicStudio server
      await fetch(`${TELEMETRY_ENDPOINT}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).catch(() => {
        // Silent catch for offline or non-blocking mode
      });

      clearTimeout(timeoutId);
    } catch {
      // Never throw errors during startup
    }
  }

  /**
   * Registers newly onboarded user with username and optional email.
   */
  static async registerOnboarding(username: string, email?: string): Promise<void> {
    const payload: OnboardingRegistrationPayload = {
      clientId: this.getClientId(),
      username: username.trim(),
      email: email?.trim() || undefined,
      appVersion: '0.1.0',
      platform: this.getPlatform(),
      timestamp: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_REGISTERED_KEY, 'true');
    } catch {}

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      await fetch(`${TELEMETRY_ENDPOINT}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).catch(() => {
        // Silent catch
      });

      clearTimeout(timeoutId);
    } catch {
      // Ignored
    }
  }

  /**
   * Opens external links in user's default browser safely.
   */
  static async openExternalLink(url: string): Promise<void> {
    try {
      await openUrl(url);
    } catch (err) {
      console.warn('Failed to open URL via plugin-opener, falling back to window.open:', err);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
