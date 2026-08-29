use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Windows process creation flag that prevents spawning a visible console window (0x08000000)
#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Extension trait for `std::process::Command` to suppress console window creation on Windows
pub trait SilentCommandExt {
    fn silent(&mut self) -> &mut Self;
}

impl SilentCommandExt for Command {
    fn silent(&mut self) -> &mut Self {
        #[cfg(windows)]
        self.creation_flags(CREATE_NO_WINDOW);
        self
    }
}

/// Creates a new `std::process::Command` configured with `CREATE_NO_WINDOW` on Windows
pub fn silent_command<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    cmd.silent();
    cmd
}

/// Creates a new `git` Command configured with `CREATE_NO_WINDOW` on Windows and non-interactive flags.
/// Uses the portable MinGit executable and injects MinGit binary directories into the subprocess PATH.
pub fn silent_git_command() -> Command {
    let mingit_exe = crate::domain::git_runtime::get_mingit_executable();
    let exe_to_run = if mingit_exe.exists() {
        mingit_exe
    } else {
        std::path::PathBuf::from("git")
    };

    let mut cmd = silent_command(&exe_to_run);

    // If MinGit is present, prepend its binary directories to the subprocess PATH
    let bin_dirs = crate::domain::git_runtime::get_mingit_bin_dirs();
    if !bin_dirs.is_empty() {
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
        cmd.env("PATH", updated_path);
    }

    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GCM_INTERACTIVE", "never");
    cmd.env("GIT_ASKPASS", "echo");
    cmd
}
