use tauri::command;
use crate::error::AppError;
use crate::git::remote::{self, RemoteInfo};

#[command]
pub async fn remotes_list(repo_path: String) -> Result<Vec<RemoteInfo>, AppError> {
    tokio::task::spawn_blocking(move || remote::list_remotes(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn remotes_add(
    repo_path: String,
    name: String,
    url: String,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || remote::add_remote(&repo_path, &name, &url))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn remotes_remove(repo_path: String, name: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || remote::remove_remote(&repo_path, &name))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn remotes_set_url(
    repo_path: String,
    name: String,
    url: String,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || remote::set_remote_url(&repo_path, &name, &url, false))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn remotes_set_default(
    repo_path: String,
    name: String,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)
            .map_err(|e| AppError::Git(e.to_string()))?;
        let mut config = repo.config()
            .map_err(|e| AppError::Git(e.to_string()))?;
        config.set_str("clone.defaultRemoteName", &name)
            .map_err(|e| AppError::Git(e.to_string()))?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}
