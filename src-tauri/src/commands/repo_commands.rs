use tauri::command;
use tauri_plugin_dialog::DialogExt;
use crate::error::AppError;
use crate::auth::gitlab::{GitLabClient, GitLabProject, PagedResult, MergeRequest};
use crate::auth::keyring;
use crate::git::remote;

fn get_authenticated_client(server_override: Option<String>) -> Result<GitLabClient, AppError> {
    let token = keyring::get_token()?.ok_or_else(|| {
        AppError::Auth("Not authenticated with GitLab. Please log in first.".to_string())
    })?;

    let server_url = match server_override {
        Some(url) if !url.trim().is_empty() => url,
        _ => keyring::get_server_url()?.unwrap_or_else(|| "https://gitlab.com".to_string()),
    };

    GitLabClient::new(server_url, token, None)
}

#[command]
pub async fn select_folder_cmd(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .set_title("Select Local Git Repository")
        .pick_folder(move |folder_path| {
            let _ = tx.send(folder_path);
        });

    let res = rx.await.map_err(|e| AppError::Unknown(e.to_string()))?;
    Ok(res.and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

#[command]
pub async fn fetch_user_repositories(
    server_url: Option<String>,
    page: Option<u32>,
) -> Result<PagedResult<GitLabProject>, AppError> {
    let client = get_authenticated_client(server_url)?;
    let p = page.unwrap_or(1);
    client.fetch_projects(p).await
}

#[command]
pub async fn clone_repository(remote_url: String, local_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        remote::clone_repository(&remote_url, &local_path)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_open_merge_requests(
    project_id: String,
    server_url: Option<String>,
) -> Result<Vec<MergeRequest>, AppError> {
    let client = get_authenticated_client(server_url)?;
    client.get_open_merge_requests(&project_id).await
}

#[command]
pub async fn create_merge_request(
    project_id: String,
    source_branch: String,
    target_branch: String,
    title: String,
    server_url: Option<String>,
) -> Result<MergeRequest, AppError> {
    let client = get_authenticated_client(server_url)?;
    client.create_merge_request(&project_id, &source_branch, &target_branch, &title).await
}

#[command]
pub async fn publish_repository(
    repo_path: String,
    name: String,
    is_private: bool,
    description: Option<String>,
    server_url: Option<String>,
) -> Result<GitLabProject, AppError> {
    let client = get_authenticated_client(server_url.clone())?;
    let project = client.create_project(&name, is_private, description.as_deref()).await?;

    let repo_path_clone = repo_path.clone();
    let raw_remote_url = project.http_url_to_repo.clone();
    let token = keyring::get_token()?.unwrap_or_default();

    let mut authenticated_url = raw_remote_url.clone();
    if !token.is_empty() && raw_remote_url.starts_with("https://") {
        authenticated_url = raw_remote_url.replacen("https://", &format!("https://oauth2:{}@", token), 1);
    }

    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let repo = git2::Repository::open(&repo_path_clone)?;
        
        if repo.find_remote("origin").is_ok() {
            let _ = repo.remote_set_url("origin", &authenticated_url);
        } else {
            let _ = repo.remote("origin", &authenticated_url);
        }

        let output = std::process::Command::new("git")
            .arg("push")
            .arg("-u")
            .arg("origin")
            .arg("HEAD")
            .current_dir(&repo_path_clone)
            .output()?;

        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(AppError::Git(format!("Project created on GitLab, but failed to push initial commits: {}", err_msg)));
        }

        Ok(())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(project)
}
