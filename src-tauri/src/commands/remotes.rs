use crate::error::AppError;
use crate::git::remote::{self, RemoteInfo};
use tauri::command;

#[command]
pub async fn remotes_list(repo_path: String) -> Result<Vec<RemoteInfo>, AppError> {
    tokio::task::spawn_blocking(move || remote::list_remotes(&repo_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn remotes_add(repo_path: String, name: String, url: String) -> Result<(), AppError> {
    let rp = repo_path.clone();
    let rname = name.clone();
    let rurl = url.clone();
    tokio::task::spawn_blocking(move || remote::add_remote(&rp, &rname, &rurl))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_success!(
        crate::core::logging::LogCategory::Remote,
        format!("Added remote '{}' ({})", name, url);
        repo_id: Some(repo_path),
        meta: serde_json::json!({ "remote": name, "url": url })
    );

    Ok(())
}

#[command]
pub async fn remotes_remove(repo_path: String, name: String) -> Result<(), AppError> {
    let rp = repo_path.clone();
    let rname = name.clone();
    tokio::task::spawn_blocking(move || remote::remove_remote(&rp, &rname))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Remote,
        format!("Removed remote '{}'", name);
        repo_id: Some(repo_path),
        meta: serde_json::json!({ "remote": name })
    );

    Ok(())
}

#[command]
pub async fn remotes_set_url(repo_path: String, name: String, url: String) -> Result<(), AppError> {
    let rp = repo_path.clone();
    let rname = name.clone();
    let rurl = url.clone();
    tokio::task::spawn_blocking(move || remote::set_remote_url(&rp, &rname, &rurl, false))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Remote,
        format!("Updated URL for remote '{}' to {}", name, url);
        repo_id: Some(repo_path),
        meta: serde_json::json!({ "remote": name, "url": url })
    );

    Ok(())
}

#[command]
pub async fn remotes_set_default(repo_path: String, name: String) -> Result<(), AppError> {
    let rp = repo_path.clone();
    let rname = name.clone();
    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let repo = git2::Repository::open(&rp).map_err(|e| AppError::Git(e.to_string()))?;
        let mut config = repo.config().map_err(|e| AppError::Git(e.to_string()))?;
        config
            .set_str("clone.defaultRemoteName", &rname)
            .map_err(|e| AppError::Git(e.to_string()))?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Remote,
        format!("Set default remote to '{}'", name);
        repo_id: Some(repo_path),
        meta: serde_json::json!({ "remote": name })
    );

    Ok(())
}
