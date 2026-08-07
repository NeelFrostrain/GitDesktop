use tauri::command;
use tauri_plugin_dialog::DialogExt;
use crate::error::AppError;
use crate::auth::gitlab::{GitLabClient, GitLabProject, PagedResult, MergeRequest};
use crate::auth::github::{GitHubClient, UnifiedRepo};
use crate::auth::keyring;
use crate::git::remote;

fn get_gitlab_client(server_override: Option<String>) -> Result<GitLabClient, AppError> {
    let token = keyring::get_token()?.ok_or_else(|| {
        AppError::Auth("Not authenticated. Please log in first.".to_string())
    })?;

    let server_url = match server_override {
        Some(url) if !url.trim().is_empty() => url,
        _ => keyring::get_server_url()?.unwrap_or_else(|| "https://gitlab.com".to_string()),
    };

    GitLabClient::new(server_url, token, None)
}

fn get_github_client() -> Result<GitHubClient, AppError> {
    let token = keyring::get_token()?.ok_or_else(|| {
        AppError::Auth("Not authenticated with GitHub. Please log in first.".to_string())
    })?;
    GitHubClient::new(&token)
}

/// Helper: convert GitLabProject to UnifiedRepo
fn gitlab_project_to_unified(p: GitLabProject) -> UnifiedRepo {
    UnifiedRepo {
        id: p.id,
        name: p.name,
        path_with_namespace: p.path_with_namespace,
        http_url_to_repo: p.http_url_to_repo,
        ssh_url_to_repo: p.ssh_url_to_repo,
        web_url: p.web_url,
        default_branch: p.default_branch,
        star_count: p.star_count,
        visibility: p.visibility,
        provider: "gitlab".to_string(),
    }
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

/// Fetch repositories — routes to GitHub or GitLab based on the active account provider.
/// Returns a unified list so the frontend uses a single code path.
#[command]
pub async fn fetch_user_repositories(
    server_url: Option<String>,
    page: Option<u32>,
    provider: Option<String>,
) -> Result<PagedResult<UnifiedRepo>, AppError> {
    let p = page.unwrap_or(1);

    // Determine provider from argument or active account
    let resolved_provider = provider.unwrap_or_else(|| {
        keyring::get_active_account()
            .map(|a| a.provider)
            .unwrap_or_else(|| "gitlab".to_string())
    });

    if resolved_provider == "github" {
        let client = get_github_client()?;
        let repos = client.fetch_repos(p).await?;
        let total = if repos.len() < 20 { p } else { p + 1 }; // GitHub doesn't return total pages
        return Ok(PagedResult {
            items: repos,
            page: p,
            total_pages: total,
        });
    }

    // GitLab path
    let client = get_gitlab_client(server_url)?;
    let paged = client.fetch_projects(p).await?;
    Ok(PagedResult {
        items: paged.items.into_iter().map(gitlab_project_to_unified).collect(),
        page: paged.page,
        total_pages: paged.total_pages,
    })
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
    let client = get_gitlab_client(server_url)?;
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
    let client = get_gitlab_client(server_url)?;
    client.create_merge_request(&project_id, &source_branch, &target_branch, &title).await
}

/// Publish a local repo to GitLab or GitHub depending on active account provider.
#[command]
pub async fn publish_repository(
    repo_path: String,
    name: String,
    is_private: bool,
    description: Option<String>,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<UnifiedRepo, AppError> {
    let resolved_provider = provider.unwrap_or_else(|| {
        keyring::get_active_account()
            .map(|a| a.provider)
            .unwrap_or_else(|| "gitlab".to_string())
    });

    let (unified_repo, token) = if resolved_provider == "github" {
        let tok = keyring::get_token()?.unwrap_or_default();
        let client = GitHubClient::new(&tok)?;
        let repo = client.create_repo(&name, is_private, description.as_deref()).await?;
        (repo, tok)
    } else {
        let client = get_gitlab_client(server_url.clone())?;
        let project = client.create_project(&name, is_private, description.as_deref()).await?;
        let tok = keyring::get_token()?.unwrap_or_default();
        (gitlab_project_to_unified(project), tok)
    };

    let raw_remote_url = unified_repo.http_url_to_repo.clone();
    let repo_path_clone = repo_path.clone();

    let mut authenticated_url = raw_remote_url.clone();
    if !token.is_empty() && raw_remote_url.starts_with("https://") {
        if resolved_provider == "github" {
            // GitHub uses token-based auth in URL: https://<token>@github.com/...
            authenticated_url = raw_remote_url.replacen("https://", &format!("https://{}@", token), 1);
        } else {
            authenticated_url = raw_remote_url.replacen("https://", &format!("https://oauth2:{}@", token), 1);
        }
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
            return Err(AppError::Git(format!(
                "Repository created, but failed to push initial commits: {}",
                err_msg
            )));
        }

        Ok(())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(unified_repo)
}

#[command]
pub fn log_action_cmd(
    level: String,
    category: String,
    message: String,
    details: Option<String>,
) {
    let timestamp = chrono::Local::now().format("%H:%M:%S").to_string();
    let details_str = match details {
        Some(d) if !d.trim().is_empty() => format!(" | Details: {}", d.trim()),
        _ => "".to_string(),
    };
    println!(
        "[{}] [{}] [{}] {}{}",
        timestamp,
        level.to_uppercase(),
        category,
        message,
        details_str
    );
}
