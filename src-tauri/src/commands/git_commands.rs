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
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        commit_mod::commit_changes(&repo_path, &summary, description.as_deref())
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
