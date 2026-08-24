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

/// Creates a new `git` Command configured with `CREATE_NO_WINDOW` on Windows
pub fn silent_git_command() -> Command {
    silent_command("git")
}
