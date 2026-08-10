use tauri::command;
use crate::error::AppError;
use crate::git::status::{get_repo_status as status_fn, RepoStatus, BranchInfo};
use crate::git::diff::{get_file_diff as diff_fn, DiffResult};
use crate::git::history::{
    get_commit_history as history_fn, get_commit_details as details_fn, CommitInfo, CommitDetails,
};
use crate::git::commit as commit_mod;
use crate::git::remote as remote_mod;

use crate::auth::keyring;

#[command]
pub async fn get_repo_status(repo_path: String) -> Result<RepoStatus, AppError> {
    let path = repo_path.clone();
    tokio::task::spawn_blocking(move || {
        let _ = keyring::sync_git_config_for_repo(&path);
        status_fn(&path)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_file_diff(
    repo_path: String,
    file_path: String,
    staged: bool,
) -> Result<DiffResult, AppError> {
    tokio::task::spawn_blocking(move || diff_fn(&repo_path, &file_path, staged))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_commit_file_diff(
    repo_path: String,
    sha: String,
    file_path: String,
) -> Result<DiffResult, AppError> {
    tokio::task::spawn_blocking(move || crate::git::diff::get_commit_file_diff(&repo_path, &sha, &file_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn stage_files(repo_path: String, files: Vec<String>) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || commit_mod::stage_files(&repo_path, files))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn unstage_files(repo_path: String, files: Vec<String>) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || commit_mod::unstage_files(&repo_path, files))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn commit_changes(
    repo_path: String,
    summary: String,
    description: Option<String>,
    no_verify: Option<bool>,
    sign_off: Option<bool>,
    allow_empty: Option<bool>,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        commit_mod::commit_changes(&repo_path, &summary, description.as_deref(), no_verify, sign_off, allow_empty)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}


#[command]
pub async fn push_to_remote(repo_path: String, branch: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || remote_mod::push_to_remote(&repo_path, &branch))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn pull_from_remote(
    repo_path: String,
    branch: String,
) -> Result<remote_mod::PullResult, AppError> {
    tokio::task::spawn_blocking(move || remote_mod::pull_from_remote(&repo_path, &branch))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn fetch_remote(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || remote_mod::fetch_remote(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_commit_history(
    repo_path: String,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<CommitInfo>, AppError> {
    let lim = limit.unwrap_or(50);
    let off = offset.unwrap_or(0);
    tokio::task::spawn_blocking(move || history_fn(&repo_path, lim, off))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_commit_details(
    repo_path: String,
    sha: String,
) -> Result<CommitDetails, AppError> {
    tokio::task::spawn_blocking(move || details_fn(&repo_path, &sha))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>, AppError> {
    tokio::task::spawn_blocking(move || commit_mod::list_branches(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn checkout_branch(repo_path: String, branch: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || commit_mod::checkout_branch(&repo_path, &branch))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn create_branch(repo_path: String, branch: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || commit_mod::create_branch(&repo_path, &branch))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn rename_branch(repo_path: String, old_name: String, new_name: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || commit_mod::rename_branch(&repo_path, &old_name, &new_name))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn delete_branch(repo_path: String, branch: String, force: Option<bool>) -> Result<(), AppError> {
    let f = force.unwrap_or(false);
    tokio::task::spawn_blocking(move || commit_mod::delete_branch(&repo_path, &branch, f))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn push_branch(repo_path: String, branch: String, set_upstream: Option<bool>) -> Result<(), AppError> {
    let su = set_upstream.unwrap_or(true);
    tokio::task::spawn_blocking(move || commit_mod::push_branch(&repo_path, &branch, su))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}


#[command]
pub async fn check_lfs_installed() -> Result<bool, AppError> {
    Ok(crate::git::lfs::check_lfs_installed())
}

#[command]
pub async fn list_lfs_files(repo_path: String) -> Result<Vec<crate::git::lfs::LfsFile>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::lfs::list_lfs_files(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn track_lfs_pattern(repo_path: String, pattern: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::lfs::track_lfs_pattern(&repo_path, &pattern))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn untrack_lfs_pattern(repo_path: String, pattern: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::lfs::untrack_lfs_pattern(&repo_path, &pattern))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn list_lfs_locks(repo_path: String) -> Result<Vec<crate::git::lfs::LfsLock>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::lfs::list_lfs_locks(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn lock_lfs_file(repo_path: String, path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::lfs::lock_lfs_file(&repo_path, &path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn unlock_lfs_file(repo_path: String, path: String, force: Option<bool>) -> Result<(), AppError> {
    let f = force.unwrap_or(false);
    tokio::task::spawn_blocking(move || crate::git::lfs::unlock_lfs_file(&repo_path, &path, f))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn list_worktrees(repo_path: String) -> Result<Vec<crate::git::worktree::WorktreeInfo>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::worktree::list_worktrees(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn create_worktree(repo_path: String, path: String, branch: Option<String>) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::worktree::add_worktree(&repo_path, &path, branch.as_deref()))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn remove_worktree(repo_path: String, path: String, force: Option<bool>) -> Result<(), AppError> {
    let f = force.unwrap_or(false);
    tokio::task::spawn_blocking(move || crate::git::worktree::remove_worktree(&repo_path, &path, f))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

// Interactive Rebase
#[command]
pub async fn get_rebase_commits_cmd(repo_path: String, target_branch: String) -> Result<Vec<crate::git::rebase::RebaseCommitPlanItem>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::rebase::get_rebase_commits(&repo_path, &target_branch))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn execute_rebase_cmd(repo_path: String, target: String, plan: Vec<crate::git::rebase::RebaseCommitPlanItem>) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::rebase::execute_rebase(&repo_path, &target, plan))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn rebase_continue_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::rebase::rebase_continue(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn rebase_abort_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::rebase::rebase_abort(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn rebase_skip_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::rebase::rebase_skip(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn rewrite_history_cmd(
    repo_path: String,
    operation: crate::git::history_rewrite::HistoryOperationPayload,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        crate::git::history_rewrite::execute_history_operation(&repo_path, operation)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}


// Cherry Pick
#[command]
pub async fn cherry_pick_commits_cmd(repo_path: String, shas: Vec<String>, no_commit: Option<bool>) -> Result<(), AppError> {
    let nc = no_commit.unwrap_or(false);
    tokio::task::spawn_blocking(move || crate::git::cherry_pick::cherry_pick_commits(&repo_path, shas, nc))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn cherry_pick_continue_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::cherry_pick::cherry_pick_continue(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn cherry_pick_abort_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::cherry_pick::cherry_pick_abort(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

// Stash
#[command]
pub async fn list_stashes_cmd(repo_path: String) -> Result<Vec<crate::git::stash::StashEntry>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::stash::list_stashes(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn create_stash_cmd(repo_path: String, message: Option<String>, include_untracked: Option<bool>) -> Result<(), AppError> {
    let iu = include_untracked.unwrap_or(true);
    tokio::task::spawn_blocking(move || crate::git::stash::create_stash(&repo_path, message.as_deref(), iu))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn apply_stash_cmd(repo_path: String, index: usize) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::stash::apply_stash(&repo_path, index))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn pop_stash_cmd(repo_path: String, index: usize) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::stash::pop_stash(&repo_path, index))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn drop_stash_cmd(repo_path: String, index: usize) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::stash::drop_stash(&repo_path, index))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_stash_diff_cmd(repo_path: String, index: usize) -> Result<String, AppError> {
    tokio::task::spawn_blocking(move || crate::git::stash::get_stash_diff(&repo_path, index))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

// Tags
#[command]
pub async fn list_tags_cmd(repo_path: String) -> Result<Vec<crate::git::tags::TagInfo>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::tags::list_tags(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn create_tag_cmd(repo_path: String, name: String, message: Option<String>, target_sha: Option<String>) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::tags::create_tag(&repo_path, &name, message.as_deref(), target_sha.as_deref()))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn delete_tag_cmd(repo_path: String, name: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::tags::delete_tag(&repo_path, &name))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn push_tags_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::tags::push_tags(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

// Blame
#[command]
pub async fn get_file_blame_cmd(repo_path: String, file_path: String) -> Result<Vec<crate::git::blame::BlameLine>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::blame::get_file_blame(&repo_path, &file_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

// Reflog
#[command]
pub async fn list_reflog_cmd(repo_path: String, limit: Option<usize>) -> Result<Vec<crate::git::reflog::ReflogEntry>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::reflog::list_reflog(&repo_path, limit))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn restore_reflog_target_cmd(repo_path: String, sha: String, force: Option<bool>) -> Result<(), AppError> {
    let f = force.unwrap_or(false);
    tokio::task::spawn_blocking(move || crate::git::reflog::restore_reflog_target(&repo_path, &sha, f))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn revert_commit_cmd(repo_path: String, sha: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::reflog::revert_commit(&repo_path, &sha))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

// Patch
#[command]
pub async fn export_patch_cmd(repo_path: String, target_path: String, range: Option<String>) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::patch::export_patch(&repo_path, &target_path, range.as_deref()))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn apply_patch_cmd(repo_path: String, patch_file_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::patch::apply_patch(&repo_path, &patch_file_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

// Config & .gitignore
#[command]
pub async fn get_repo_git_config_cmd(repo_path: String) -> Result<Vec<crate::git::config::GitConfigItem>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::config::get_repo_git_config(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn set_repo_git_config_cmd(repo_path: String, key: String, value: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::config::set_repo_git_config(&repo_path, &key, &value))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn read_gitignore_cmd(repo_path: String) -> Result<String, AppError> {
    tokio::task::spawn_blocking(move || crate::git::config::read_gitignore(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn write_gitignore_cmd(repo_path: String, content: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::config::write_gitignore(&repo_path, &content))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

// Submodules
#[command]
pub async fn list_submodules_cmd(repo_path: String) -> Result<Vec<crate::git::submodules::SubmoduleInfo>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::submodules::list_submodules(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn init_submodules_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::submodules::init_submodules(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn update_submodules_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::submodules::update_submodules(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn sync_submodules_cmd(repo_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::submodules::sync_submodules(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn discard_file_changes_cmd(repo_path: String, file_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || commit_mod::discard_file_changes(&repo_path, &file_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn ignore_file_pattern_cmd(repo_path: String, pattern: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let content = crate::git::config::read_gitignore(&repo_path).unwrap_or_default();
        let new_content = if content.ends_with('\n') || content.is_empty() {
            format!("{}{}\n", content, pattern)
        } else {
            format!("{}\n{}\n", content, pattern)
        };
        crate::git::config::write_gitignore(&repo_path, &new_content)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn open_file_default_cmd(file_path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .arg("/c")
            .arg("start")
            .arg("")
            .arg(&file_path)
            .spawn()
            .map_err(|e| AppError::Unknown(e.to_string()))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| AppError::Unknown(e.to_string()))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| AppError::Unknown(e.to_string()))?;
    }
    Ok(())
}

#[command]
pub async fn get_git_user_identity_cmd(
    repo_path: String,
) -> Result<crate::git::config::GitUserIdentity, AppError> {
    tokio::task::spawn_blocking(move || crate::git::config::get_git_user_identity(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}




