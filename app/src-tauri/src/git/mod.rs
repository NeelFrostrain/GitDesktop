pub mod ai;
pub mod command;
pub mod commit;
pub mod config;
pub mod history;
pub mod remote;
pub mod workspace;

// Backward-compatible module exports for seamless compilation
pub use ai::ai_commit;
pub use command::{silent_command, silent_git_command, SilentCommandExt};
pub use commit::signing;
pub use history::{blame, cherry_pick, history_rewrite, rebase, reflog};
pub use remote::{lfs, submodules, tags};
pub use workspace::{diff, patch, stash, status, worktree};
