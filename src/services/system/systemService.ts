import { invoke } from '@tauri-apps/api/core';

/**
 * Typed client service for system, window, and desktop shell interactions.
 */
export class SystemService {
  /**
   * Minimizes the main application window.
   */
  static async minimizeWindow(): Promise<void> {
    return invoke('minimize_window');
  }

  /**
   * Toggles maximization of the main application window and returns new maximized state.
   */
  static async toggleMaximizeWindow(): Promise<boolean> {
    return invoke<boolean>('toggle_maximize_window');
  }

  /**
   * Closes the main application window.
   */
  static async closeWindow(): Promise<void> {
    return invoke('close_window');
  }

  /**
   * Opens the system folder picker dialog.
   */
  static async selectFolder(): Promise<string | null> {
    return invoke<string | null>('select_folder_cmd');
  }

  /**
   * Opens the specified path in an external terminal.
   */
  static async openInTerminal(repoPath: string): Promise<void> {
    return invoke('open_in_terminal_cmd', { repoPath });
  }

  /**
   * Opens the specified path in VS Code.
   */
  static async openInVSCode(repoPath: string): Promise<void> {
    return invoke('open_in_vscode_cmd', { repoPath });
  }

  /**
   * Reveals the file or directory in the system file manager (Explorer/Finder).
   */
  static async showInExplorer(repoPath: string): Promise<void> {
    return invoke('show_in_explorer_cmd', { repoPath });
  }

  /**
   * Opens a file in the system default application.
   */
  static async openFileDefault(filePath: string): Promise<void> {
    return invoke('open_file_default_cmd', { filePath });
  }
}
