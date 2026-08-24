use portable_pty::CommandBuilder;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRuntimeInfo {
    pub is_available: bool,
    pub version: Option<String>,
    pub executable_path: Option<String>,
    pub is_portable_mingit: bool,
    pub mingit_installed: bool,
    pub mingit_dir: Option<String>,
}

/// Returns the base directory for git-desktop application data
pub fn get_app_data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            return PathBuf::from(app_data).join("gitlab-desktop");
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("gitlab-desktop");
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(config_home) = std::env::var("XDG_DATA_HOME") {
            return PathBuf::from(config_home).join("gitlab-desktop");
        } else if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("gitlab-desktop");
        }
    }

    PathBuf::from(".gitlab-desktop")
}

/// Returns the path to the portable MinGit directory
pub fn get_mingit_dir() -> PathBuf {
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
        return cmd_path;
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
    match Command::new(&exe).arg("--version").output() {
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

    if let Ok(output) = Command::new(check_cmd).arg("git").output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = stdout.lines().next() {
                let path = PathBuf::from(first_line.trim());
                if path.exists() {
                    // Check version
                    if let Ok(ver_output) = Command::new(&path).arg("--version").output() {
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
    if let Ok(output) = Command::new("git").arg("--version").output() {
        if output.status.success() {
            let ver_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Some((ver_str, PathBuf::from("git")));
        }
    }

    None
}

/// Comprehensive detection of active Git runtime
pub fn detect_git_runtime() -> GitRuntimeInfo {
    let mingit_present = is_mingit_installed();
    let mingit_dir_str = get_mingit_dir().to_string_lossy().to_string();

    // 1. If MinGit is present, retrieve its version
    if mingit_present {
        let exe = get_mingit_executable();
        if let Ok(output) = Command::new(&exe).arg("--version").output() {
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

    // 2. Check System Git
    if let Some((system_ver, system_path)) = find_system_git() {
        return GitRuntimeInfo {
            is_available: true,
            version: Some(system_ver),
            executable_path: Some(system_path.to_string_lossy().to_string()),
            is_portable_mingit: false,
            mingit_installed: mingit_present,
            mingit_dir: if mingit_present {
                Some(mingit_dir_str)
            } else {
                None
            },
        };
    }

    // 3. Not found anywhere
    GitRuntimeInfo {
        is_available: false,
        version: None,
        executable_path: None,
        is_portable_mingit: false,
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
