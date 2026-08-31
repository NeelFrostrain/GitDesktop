use crate::git::command::silent_command;
use portable_pty::CommandBuilder;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRuntimeInfo {
    pub is_available: bool,
    pub version: Option<String>,
    pub executable_path: Option<String>,
    pub is_portable_mingit: bool,
    pub mingit_installed: bool,
    pub mingit_dir: Option<String>,
}

/// Returns the base directory for application data: `{APPDATA}/CyronicStudio/GitDesktop`
pub fn get_app_data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            let appdata_path = PathBuf::from(&app_data);
            let primary = appdata_path.join("CyronicStudio").join("GitDesktop");
            let legacy_cyronics = appdata_path.join("CyronicStudio").join("GitDesktop");
            let legacy_git_desktop = appdata_path.join("git-desktop");
            let legacy_gitlab_desktop = appdata_path.join("gitlab-desktop");

            // If legacy exists and primary doesn't yet, auto-migrate
            if !primary.exists() {
                if legacy_cyronics.exists() {
                    let _ = std::fs::create_dir_all(appdata_path.join("CyronicStudio"));
                    let _ = std::fs::rename(&legacy_cyronics, &primary);
                } else if legacy_git_desktop.exists() {
                    let _ = std::fs::create_dir_all(appdata_path.join("CyronicStudio"));
                    let _ = std::fs::rename(&legacy_git_desktop, &primary);
                } else if legacy_gitlab_desktop.exists() {
                    let _ = std::fs::create_dir_all(appdata_path.join("CyronicStudio"));
                    let _ = std::fs::rename(&legacy_gitlab_desktop, &primary);
                }
            }
            let _ = std::fs::create_dir_all(&primary);
            return primary;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let primary = PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("CyronicStudio")
                .join("GitDesktop");
            let _ = std::fs::create_dir_all(&primary);
            return primary;
        }
    }

    #[cfg(target_os = "linux")]
    {
        let primary = if let Ok(config_home) = std::env::var("XDG_DATA_HOME") {
            PathBuf::from(config_home)
                .join("CyronicStudio")
                .join("GitDesktop")
        } else if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("CyronicStudio")
                .join("GitDesktop")
        } else {
            PathBuf::from(".CyronicStudio").join("GitDesktop")
        };
        let _ = std::fs::create_dir_all(&primary);
        return primary;
    }

    #[allow(unreachable_code)]
    {
        let primary =
            if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
                PathBuf::from(home)
                    .join(".CyronicStudio")
                    .join("GitDesktop")
            } else {
                PathBuf::from(".CyronicStudio").join("GitDesktop")
            };
        let _ = std::fs::create_dir_all(&primary);
        primary
    }
}

/// Returns the path to the portable MinGit directory (checking dev bundle/resources first, then AppData)
pub fn get_mingit_dir() -> PathBuf {
    // 1. Check local project or bundled resources directory
    let local_dev = PathBuf::from("bin").join("mingit");
    if local_dev.exists() {
        return local_dev;
    }
    let tauri_dev = PathBuf::from("src-tauri").join("bin").join("mingit");
    if tauri_dev.exists() {
        return tauri_dev;
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let exe_bundled = parent.join("bin").join("mingit");
            if exe_bundled.exists() {
                return exe_bundled;
            }
            let res_bundled = parent.join("resources").join("bin").join("mingit");
            if res_bundled.exists() {
                return res_bundled;
            }
            if let Some(grandparent) = parent.parent() {
                let gp_res = grandparent.join("resources").join("bin").join("mingit");
                if gp_res.exists() {
                    return gp_res;
                }
            }
        }
    }

    // 2. Persistent AppData directory
    get_app_data_dir().join("bin").join("mingit")
}

/// Returns the path to the portable MinGit git.exe
pub fn get_mingit_executable() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let cmd_path = get_mingit_dir().join("cmd").join("git.exe");
        if cmd_path.exists() {
            return cmd_path;
        }
        let mingw_path = get_mingit_dir().join("mingw64").join("bin").join("git.exe");
        if mingw_path.exists() {
            return mingw_path;
        }
        cmd_path
    }

    #[cfg(not(target_os = "windows"))]
    {
        get_mingit_dir().join("bin").join("git")
    }
}

/// Returns list of MinGit binary directories that need to be prepended to PATH
pub fn get_mingit_bin_dirs() -> Vec<PathBuf> {
    let base = get_mingit_dir();
    let mut dirs = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let cmd_dir = base.join("cmd");
        if cmd_dir.exists() {
            dirs.push(cmd_dir);
        }
        let mingw_bin = base.join("mingw64").join("bin");
        if mingw_bin.exists() {
            dirs.push(mingw_bin);
        }
        let usr_bin = base.join("usr").join("bin");
        if usr_bin.exists() {
            dirs.push(usr_bin);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let bin_dir = base.join("bin");
        if bin_dir.exists() {
            dirs.push(bin_dir);
        }
    }

    dirs
}

/// Checks if MinGit is installed and runnable
pub fn is_mingit_installed() -> bool {
    let exe = get_mingit_executable();
    if !exe.exists() {
        return false;
    }

    // Try executing git.exe --version
    match silent_command(&exe).arg("--version").output() {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

/// Checks system PATH for git
pub fn find_system_git() -> Option<(String, PathBuf)> {
    #[cfg(target_os = "windows")]
    let check_cmd = "where.exe";
    #[cfg(not(target_os = "windows"))]
    let check_cmd = "which";

    if let Ok(output) = silent_command(check_cmd).arg("git").output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = stdout.lines().next() {
                let path = PathBuf::from(first_line.trim());
                if path.exists() {
                    // Check version
                    if let Ok(ver_output) = silent_command(&path).arg("--version").output() {
                        if ver_output.status.success() {
                            let ver_str = String::from_utf8_lossy(&ver_output.stdout)
                                .trim()
                                .to_string();
                            return Some((ver_str, path));
                        }
                    }
                }
            }
        }
    }

    // Fallback direct check
    if let Ok(output) = silent_command("git").arg("--version").output() {
        if output.status.success() {
            let ver_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Some((ver_str, PathBuf::from("git")));
        }
    }

    None
}

/// Detection of active Git runtime — strictly uses Portable MinGit runtime
pub fn detect_git_runtime() -> GitRuntimeInfo {
    let mingit_present = is_mingit_installed();
    let mingit_dir_str = get_mingit_dir().to_string_lossy().to_string();

    // 1. If Portable MinGit is present, retrieve its version
    if mingit_present {
        let exe = get_mingit_executable();
        if let Ok(output) = silent_command(&exe).arg("--version").output() {
            if output.status.success() {
                let ver = String::from_utf8_lossy(&output.stdout).trim().to_string();
                return GitRuntimeInfo {
                    is_available: true,
                    version: Some(ver),
                    executable_path: Some(exe.to_string_lossy().to_string()),
                    is_portable_mingit: true,
                    mingit_installed: true,
                    mingit_dir: Some(mingit_dir_str),
                };
            }
        }
    }

    // 2. MinGit not yet installed
    GitRuntimeInfo {
        is_available: false,
        version: None,
        executable_path: None,
        is_portable_mingit: true,
        mingit_installed: false,
        mingit_dir: None,
    }
}

/// Injects MinGit directories into the PATH environment variable for PTY CommandBuilder
pub fn inject_git_path(cmd: &mut CommandBuilder) {
    let bin_dirs = get_mingit_bin_dirs();
    if bin_dirs.is_empty() {
        return;
    }

    #[cfg(target_os = "windows")]
    let separator = ";";
    #[cfg(not(target_os = "windows"))]
    let separator = ":";

    let existing_path = std::env::var("PATH").unwrap_or_default();
    let bin_paths_str = bin_dirs
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(separator);

    let updated_path = if existing_path.is_empty() {
        bin_paths_str
    } else {
        format!("{}{}{}", bin_paths_str, separator, existing_path)
    };

    cmd.env("PATH", updated_path);
}

// Global thread-safe cache for resolved executable path and PATH string
static RESOLVED_RUNTIME_CACHE: std::sync::RwLock<Option<(PathBuf, Option<String>)>> =
    std::sync::RwLock::new(None);

/// Clears cached git binary and PATH configuration (called after MinGit installation)
pub fn invalidate_git_runtime_cache() {
    if let Ok(mut lock) = RESOLVED_RUNTIME_CACHE.write() {
        *lock = None;
    }
}

/// Returns cached (executable_path, optional_path_env) to avoid repetitive disk existence checks
pub fn get_cached_git_command_config() -> (PathBuf, Option<String>) {
    if let Ok(lock) = RESOLVED_RUNTIME_CACHE.read() {
        if let Some(ref cached) = *lock {
            return cached.clone();
        }
    }

    let mingit_exe = get_mingit_executable();
    let exe_to_run = if mingit_exe.exists() {
        mingit_exe
    } else {
        PathBuf::from("git")
    };

    let bin_dirs = get_mingit_bin_dirs();
    let path_env = if !bin_dirs.is_empty() {
        let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
        let existing_path = std::env::var("PATH").unwrap_or_default();
        let bin_paths_str = bin_dirs
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(separator);

        let updated_path = if existing_path.is_empty() {
            bin_paths_str
        } else {
            format!("{}{}{}", bin_paths_str, separator, existing_path)
        };
        Some(updated_path)
    } else {
        None
    };

    let result = (exe_to_run, path_env);
    if let Ok(mut lock) = RESOLVED_RUNTIME_CACHE.write() {
        *lock = Some(result.clone());
    }
    result
}

