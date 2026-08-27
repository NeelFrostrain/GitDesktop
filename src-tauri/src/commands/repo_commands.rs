use crate::auth::github::{GitHubClient, PullRequestComment, UnifiedRepo};
use crate::auth::gitlab::{GitLabClient, GitLabProject, MergeRequest, PagedResult};
use crate::auth::keyring;
use crate::error::AppError;
use crate::git::remote;
use tauri::command;
use tauri_plugin_dialog::DialogExt;

fn get_git_credential_token(host: &str) -> Option<String> {
    let input = format!("protocol=https\nhost={}\n\n", host);
    let mut child = crate::git::command::silent_git_command()
        .arg("credential")
        .arg("fill")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;

    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let _ = stdin.write_all(input.as_bytes());
    }

    let output = child.wait_with_output().ok()?;
    if output.status.success() {
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        for line in stdout_str.lines() {
            if let Some(password) = line.strip_prefix("password=") {
                let clean = password.trim();
                if !clean.is_empty() {
                    return Some(clean.to_string());
                }
            }
        }
    }
    None
}

fn get_gitlab_client(server_override: Option<String>) -> Result<GitLabClient, AppError> {
    get_gitlab_client_for_account(None, server_override)
}

fn get_gitlab_client_for_account(
    account_id: Option<&str>,
    server_override: Option<String>,
) -> Result<GitLabClient, AppError> {
    let provider_accounts = crate::domain::accounts::token_store::list_accounts();
    let gitlab_acc = if let Some(id) = account_id {
        provider_accounts.iter().find(|a| a.id == id).cloned()
    } else {
        provider_accounts
            .iter()
            .find(|a| a.provider == crate::domain::accounts::provider::ProviderKind::Gitlab && a.is_active)
            .or_else(|| {
                provider_accounts
                    .iter()
                    .find(|a| a.provider == crate::domain::accounts::provider::ProviderKind::Gitlab)
            })
            .cloned()
    };

    let mut gitlab_token = None;
    let mut instance_url = None;

    if let Some(ref acc) = gitlab_acc {
        if let Ok(Some(tok)) = crate::domain::accounts::token_store::get_token(&acc.id) {
            if !tok.trim().is_empty() {
                gitlab_token = Some(tok);
                instance_url = Some(acc.instance_url.clone());
            }
        }
    }

    if gitlab_token.is_none() {
        let accounts = keyring::list_accounts();
        if let Some(a) = accounts
            .iter()
            .find(|a| a.provider == "gitlab" && a.is_active)
            .or_else(|| accounts.iter().find(|a| a.provider == "gitlab"))
        {
            if !a.token.trim().is_empty() {
                gitlab_token = Some(a.token.clone());
                instance_url = Some(a.server_url.clone());
            }
        }
    }

    let server_url = match server_override {
        Some(url) if !url.trim().is_empty() => url,
        _ => instance_url
            .or_else(|| keyring::get_server_url().ok().flatten())
            .unwrap_or_else(|| "https://gitlab.com".to_string()),
    };

    if gitlab_token.is_none() {
        let host = server_url
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_end_matches('/');
        gitlab_token = get_git_credential_token(host);
    }

    let token = gitlab_token
        .or_else(|| keyring::get_token().ok().flatten())
        .unwrap_or_default();

    if token.trim().is_empty() {
        return Err(AppError::Auth(
            "No authenticated session found for GitLab. Please sign in or provide a token.".to_string(),
        ));
    }

    GitLabClient::new(server_url, token, None)
}

fn get_github_client() -> Result<GitHubClient, AppError> {
    get_github_client_for_account(None)
}

fn get_github_client_for_account(account_id: Option<&str>) -> Result<GitHubClient, AppError> {
    let provider_accounts = crate::domain::accounts::token_store::list_accounts();
    let gh_acc = if let Some(id) = account_id {
        provider_accounts.iter().find(|a| a.id == id).cloned()
    } else {
        provider_accounts
            .iter()
            .find(|a| a.provider == crate::domain::accounts::provider::ProviderKind::Github && a.is_active)
            .or_else(|| {
                provider_accounts
                    .iter()
                    .find(|a| a.provider == crate::domain::accounts::provider::ProviderKind::Github)
            })
            .cloned()
    };

    let mut github_token = None;

    if let Some(ref acc) = gh_acc {
        if let Ok(Some(tok)) = crate::domain::accounts::token_store::get_token(&acc.id) {
            if !tok.trim().is_empty() {
                github_token = Some(tok);
            }
        }
    }

    // 2. Fallback to legacy keyring store
    if github_token.is_none() {
        let accounts = keyring::list_accounts();
        if let Some(a) = accounts
            .iter()
            .find(|a| a.provider == "github" && a.is_active)
            .or_else(|| accounts.iter().find(|a| a.provider == "github"))
        {
            if !a.token.trim().is_empty() {
                github_token = Some(a.token.clone());
            }
        }
    }

    // 3. Fallback to active account if GitHub
    if github_token.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" && !a.token.trim().is_empty() {
                github_token = Some(a.token);
            }
        }
    }

    // 4. Fallback to system Git Credential Manager (GCM)
    if github_token.is_none() {
        github_token = get_git_credential_token("github.com");
    }

    // 5. Fallback to environment variables
    if github_token.is_none() {
        if let Ok(env_t) = std::env::var("GITHUB_TOKEN").or_else(|_| std::env::var("GH_TOKEN")) {
            if !env_t.trim().is_empty() {
                github_token = Some(env_t.trim().to_string());
            }
        }
    }

    let token = github_token
        .or_else(|| keyring::get_token().ok().flatten());

    GitHubClient::new(token.as_deref())
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
    Ok(res
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().to_string()))
}

/// Fetch repositories — routes to GitHub or GitLab based on the active account provider.
/// Returns a unified list so the frontend uses a single code path.
#[command]
pub async fn fetch_user_repositories(
    account_id: Option<String>,
    server_url: Option<String>,
    page: Option<u32>,
    provider: Option<String>,
    search: Option<String>,
) -> Result<PagedResult<UnifiedRepo>, AppError> {
    let p = page.unwrap_or(1);

    // 1. If account_id is provided, find that account in token_store
    let provider_accounts = crate::domain::accounts::token_store::list_accounts();
    let target_acc = if let Some(ref aid) = account_id {
        provider_accounts.iter().find(|a| &a.id == aid).cloned()
    } else {
        provider_accounts.iter().find(|a| a.is_active).cloned()
    };

    // Determine resolved provider from target account or fallback argument
    let resolved_provider = if let Some(ref acc) = target_acc {
        match acc.provider {
            crate::domain::accounts::provider::ProviderKind::Github => "github".to_string(),
            crate::domain::accounts::provider::ProviderKind::Bitbucket => "bitbucket".to_string(),
            crate::domain::accounts::provider::ProviderKind::Gitlab => "gitlab".to_string(),
        }
    } else if let Some(prov) = provider {
        prov.to_lowercase()
    } else {
        keyring::get_active_account()
            .map(|a| a.provider.to_lowercase())
            .unwrap_or_else(|| "github".to_string())
    };

    let target_acc_id = target_acc.as_ref().map(|a| a.id.as_str());

    if resolved_provider == "github" {
        let client = get_github_client_for_account(target_acc_id)?;
        let mut repos = client.fetch_repos(p).await?;
        if let Some(ref q) = search {
            let query = q.trim().to_lowercase();
            if !query.is_empty() {
                repos.retain(|r| {
                    r.name.to_lowercase().contains(&query)
                        || r.path_with_namespace.to_lowercase().contains(&query)
                });
            }
        }
        let total = if repos.len() < 20 { p } else { p + 1 }; // GitHub doesn't return total pages
        return Ok(PagedResult {
            items: repos,
            page: p,
            total_pages: total,
        });
    }

    // GitLab path
    let client = get_gitlab_client_for_account(target_acc_id, server_url)?;
    let paged = client.fetch_projects(p).await?;
    let mut items: Vec<UnifiedRepo> = paged
        .items
        .into_iter()
        .map(gitlab_project_to_unified)
        .collect();

    if let Some(ref q) = search {
        let query = q.trim().to_lowercase();
        if !query.is_empty() {
            items.retain(|r| {
                r.name.to_lowercase().contains(&query)
                    || r.path_with_namespace.to_lowercase().contains(&query)
            });
        }
    }

    Ok(PagedResult {
        items,
        page: paged.page,
        total_pages: paged.total_pages,
    })
}

#[command]
pub async fn clone_repository(remote_url: String, local_path: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || remote::clone_repository(&remote_url, &local_path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_open_merge_requests(
    project_id: String,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<Vec<MergeRequest>, AppError> {
    let mut clean_project_id = project_id.trim().to_string();
    let mut is_github = provider.as_deref() == Some("github");

    if clean_project_id.starts_with("github.com/") {
        clean_project_id = clean_project_id.replacen("github.com/", "", 1);
        is_github = true;
    }
    if server_url
        .as_deref()
        .map(|u| u.contains("github"))
        .unwrap_or(false)
    {
        is_github = true;
    }

    if !is_github && provider.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" {
                is_github = true;
            }
        }
    }

    if is_github {
        let client = get_github_client()?;
        client.get_open_pull_requests(&clean_project_id).await
    } else {
        let client = get_gitlab_client(server_url)?;
        client.get_open_merge_requests(&clean_project_id).await
    }
}

#[command]
pub async fn create_merge_request(
    project_id: String,
    source_branch: String,
    target_branch: String,
    title: String,
    description: Option<String>,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<MergeRequest, AppError> {
    let mut clean_project_id = project_id.trim().to_string();
    let mut is_github = provider.as_deref() == Some("github");

    if clean_project_id.starts_with("github.com/") {
        clean_project_id = clean_project_id.replacen("github.com/", "", 1);
        is_github = true;
    }
    if server_url
        .as_deref()
        .map(|u| u.contains("github"))
        .unwrap_or(false)
    {
        is_github = true;
    }

    if !is_github && provider.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" {
                is_github = true;
            }
        }
    }

    if is_github {
        let client = get_github_client()?;
        client
            .create_pull_request(
                &clean_project_id,
                &source_branch,
                &target_branch,
                &title,
                description.as_deref(),
            )
            .await
    } else {
        let client = get_gitlab_client(server_url)?;
        client
            .create_merge_request(&clean_project_id, &source_branch, &target_branch, &title)
            .await
    }
}

#[command]
pub async fn update_merge_request(
    project_id: String,
    mr_id: u64,
    title: Option<String>,
    description: Option<String>,
    target_branch: Option<String>,
    state: Option<String>,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<MergeRequest, AppError> {
    let mut clean_project_id = project_id.trim().to_string();
    let mut is_github = provider.as_deref() == Some("github");

    if clean_project_id.starts_with("github.com/") {
        clean_project_id = clean_project_id.replacen("github.com/", "", 1);
        is_github = true;
    }
    if server_url
        .as_deref()
        .map(|u| u.contains("github"))
        .unwrap_or(false)
    {
        is_github = true;
    }

    if !is_github && provider.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" {
                is_github = true;
            }
        }
    }

    if is_github {
        let client = get_github_client()?;
        client
            .update_pull_request(
                &clean_project_id,
                mr_id,
                title.as_deref(),
                description.as_deref(),
                target_branch.as_deref(),
                state.as_deref(),
            )
            .await
    } else {
        let client = get_gitlab_client(server_url)?;
        client
            .update_merge_request(
                &clean_project_id,
                mr_id,
                title.as_deref(),
                description.as_deref(),
                target_branch.as_deref(),
                state.as_deref(),
            )
            .await
    }
}

#[command]
pub async fn get_branch_comparison(
    repo_path: String,
    base_branch: String,
    head_branch: String,
) -> Result<crate::git::history::BranchComparison, AppError> {
    tokio::task::spawn_blocking(move || {
        crate::git::history::get_branch_comparison(&repo_path, &base_branch, &head_branch)
    })
    .await
    .map_err(|e| AppError::Git(e.to_string()))?
}

#[command]
pub async fn get_pull_request_comments(
    project_id: String,
    mr_id: u64,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<Vec<crate::auth::github::PullRequestComment>, AppError> {
    let mut clean_project_id = project_id.trim().to_string();
    let mut is_github = provider.as_deref() == Some("github");

    if clean_project_id.starts_with("github.com/") {
        clean_project_id = clean_project_id.replacen("github.com/", "", 1);
        is_github = true;
    }
    if server_url
        .as_deref()
        .map(|u| u.contains("github"))
        .unwrap_or(false)
    {
        is_github = true;
    }
    if !is_github && provider.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" {
                is_github = true;
            }
        }
    }

    if is_github {
        let client = get_github_client()?;
        client.get_pull_request_comments(&clean_project_id, mr_id).await
    } else {
        let client = get_gitlab_client(server_url)?;
        client.get_merge_request_comments(&clean_project_id, mr_id).await
    }
}

#[command]
pub async fn add_pull_request_comment(
    project_id: String,
    mr_id: u64,
    body: String,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<crate::auth::github::PullRequestComment, AppError> {
    let mut clean_project_id = project_id.trim().to_string();
    let mut is_github = provider.as_deref() == Some("github");

    if clean_project_id.starts_with("github.com/") {
        clean_project_id = clean_project_id.replacen("github.com/", "", 1);
        is_github = true;
    }
    if server_url
        .as_deref()
        .map(|u| u.contains("github"))
        .unwrap_or(false)
    {
        is_github = true;
    }
    if !is_github && provider.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" {
                is_github = true;
            }
        }
    }

    if is_github {
        let client = get_github_client()?;
        client.add_pull_request_comment(&clean_project_id, mr_id, &body).await
    } else {
        let client = get_gitlab_client(server_url)?;
        client.add_merge_request_comment(&clean_project_id, mr_id, &body).await
    }
}

#[command]
pub async fn edit_pull_request_comment(
    project_id: String,
    mr_id: u64,
    comment_id: u64,
    body: String,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<PullRequestComment, AppError> {
    let mut clean_project_id = project_id.trim().to_string();
    let mut is_github = provider.as_deref() == Some("github");

    if clean_project_id.starts_with("github.com/") {
        clean_project_id = clean_project_id.replacen("github.com/", "", 1);
        is_github = true;
    }
    if server_url
        .as_deref()
        .map(|u| u.contains("github"))
        .unwrap_or(false)
    {
        is_github = true;
    }
    if !is_github && provider.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" {
                is_github = true;
            }
        }
    }

    if is_github {
        let client = get_github_client()?;
        client.edit_pull_request_comment(&clean_project_id, comment_id, &body).await
    } else {
        let client = get_gitlab_client(server_url)?;
        client.edit_merge_request_comment(&clean_project_id, mr_id, comment_id, &body).await
    }
}

#[command]
pub async fn delete_pull_request_comment(
    project_id: String,
    mr_id: u64,
    comment_id: u64,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<bool, AppError> {
    let mut clean_project_id = project_id.trim().to_string();
    let mut is_github = provider.as_deref() == Some("github");

    if clean_project_id.starts_with("github.com/") {
        clean_project_id = clean_project_id.replacen("github.com/", "", 1);
        is_github = true;
    }
    if server_url
        .as_deref()
        .map(|u| u.contains("github"))
        .unwrap_or(false)
    {
        is_github = true;
    }
    if !is_github && provider.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" {
                is_github = true;
            }
        }
    }

    if is_github {
        let client = get_github_client()?;
        client.delete_pull_request_comment(&clean_project_id, comment_id).await
    } else {
        let client = get_gitlab_client(server_url)?;
        client.delete_merge_request_comment(&clean_project_id, mr_id, comment_id).await
    }
}

#[command]
pub async fn merge_pull_request(
    project_id: String,
    mr_id: u64,
    merge_method: Option<String>,
    commit_title: Option<String>,
    commit_message: Option<String>,
    squash: Option<bool>,
    should_remove_source_branch: Option<bool>,
    server_url: Option<String>,
    provider: Option<String>,
) -> Result<bool, AppError> {
    let mut clean_project_id = project_id.trim().to_string();
    let mut is_github = provider.as_deref() == Some("github");

    if clean_project_id.starts_with("github.com/") {
        clean_project_id = clean_project_id.replacen("github.com/", "", 1);
        is_github = true;
    }
    if server_url
        .as_deref()
        .map(|u| u.contains("github"))
        .unwrap_or(false)
    {
        is_github = true;
    }
    if !is_github && provider.is_none() {
        if let Some(a) = keyring::get_active_account() {
            if a.provider == "github" {
                is_github = true;
            }
        }
    }

    if is_github {
        let client = get_github_client()?;
        client.merge_pull_request(
            &clean_project_id,
            mr_id,
            merge_method.as_deref(),
            commit_title.as_deref(),
            commit_message.as_deref(),
        ).await
    } else {
        let client = get_gitlab_client(server_url)?;
        client.merge_merge_request(
            &clean_project_id,
            mr_id,
            squash,
            should_remove_source_branch,
            commit_message.as_deref(),
        ).await
    }
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
        let client = GitHubClient::new(Some(&tok))?;
        let repo = client
            .create_repo(&name, is_private, description.as_deref())
            .await?;
        (repo, tok)
    } else {
        let client = get_gitlab_client(server_url.clone())?;
        let project = client
            .create_project(&name, is_private, description.as_deref())
            .await?;
        let tok = keyring::get_token()?.unwrap_or_default();
        (gitlab_project_to_unified(project), tok)
    };

    let raw_remote_url = unified_repo.http_url_to_repo.clone();
    let repo_path_clone = repo_path.clone();

    let mut authenticated_url = raw_remote_url.clone();
    if !token.is_empty() && raw_remote_url.starts_with("https://") {
        if resolved_provider == "github" {
            // GitHub uses token-based auth in URL: https://<token>@github.com/...
            authenticated_url =
                raw_remote_url.replacen("https://", &format!("https://{}@", token), 1);
        } else {
            authenticated_url =
                raw_remote_url.replacen("https://", &format!("https://oauth2:{}@", token), 1);
        }
    }

    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let repo = git2::Repository::open(&repo_path_clone)?;

        if repo.find_remote("origin").is_ok() {
            let _ = repo.remote_set_url("origin", &authenticated_url);
        } else {
            let _ = repo.remote("origin", &authenticated_url);
        }

        let output = crate::git::command::silent_git_command()
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
pub fn log_action_cmd(level: String, category: String, message: String, details: Option<String>) {
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

#[command]
pub async fn open_in_terminal_cmd(repo_path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .arg("/c")
            .arg("start")
            .arg("cmd.exe")
            .current_dir(&repo_path)
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-a")
            .arg("Terminal")
            .arg(&repo_path)
            .spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("x-terminal-emulator")
            .current_dir(&repo_path)
            .spawn()?;
    }
    Ok(())
}

#[command]
pub async fn open_in_vscode_cmd(repo_path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        crate::git::command::silent_command("cmd")
            .arg("/c")
            .arg("code")
            .arg(&repo_path)
            .spawn()?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("code").arg(&repo_path).spawn()?;
    }
    Ok(())
}

#[command]
pub async fn show_in_explorer_cmd(repo_path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&repo_path)
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&repo_path).spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&repo_path)
            .spawn()?;
    }
    Ok(())
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateRepoOptions {
    pub name: String,
    pub parent_path: String,
    pub description: Option<String>,
    pub init_readme: bool,
    pub gitignore_template: Option<String>,
    pub license_template: Option<String>,
}

#[command]
pub async fn create_repository_cmd(opts: CreateRepoOptions) -> Result<String, AppError> {
    tokio::task::spawn_blocking(move || {
        let repo_dir = std::path::Path::new(&opts.parent_path).join(&opts.name);
        std::fs::create_dir_all(&repo_dir)?;

        let repo = git2::Repository::init(&repo_dir)
            .map_err(|e| AppError::Git(format!("Failed to initialize repository: {}", e)))?;

        let mut created_files = false;

        // 1. README
        if opts.init_readme {
            let readme_path = repo_dir.join("README.md");
            let mut content = format!("# {}\n", opts.name);
            if let Some(ref desc) = opts.description {
                if !desc.trim().is_empty() {
                    content.push_str(&format!("\n{}\n", desc.trim()));
                }
            }
            std::fs::write(&readme_path, content)?;
            created_files = true;
        }

        // 2. Gitignore
        if let Some(ref gi) = opts.gitignore_template {
            if gi != "None" && !gi.trim().is_empty() {
                let gi_path = repo_dir.join(".gitignore");
                let gi_content = match gi.as_str() {
                    "Node" => "node_modules/\ndist/\n.env\n.DS_Store\n",
                    "Rust" => "/target\nCargo.lock\n**/*.rs.bk\n",
                    "Python" => "__pycache__/\n*.py[cod]\n*$py.class\nvenv/\n.env\n",
                    "C++" => "*.o\n*.obj\n*.exe\n*.out\nbuild/\n.vs/\n",
                    "Go" => "*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\nvendor/\n",
                    "Unity" => "[L|l]ibrary/\n[T|t]emp/\n[O|o]bj/\n[B|b]uild/\n[B|b]uilds/\n",
                    "UnrealEngine" => "Binaries/\nDerivedDataCache/\nIntermediate/\nSaved/\n*.rsym\n*.obj\n",
                    _ => "",
                };
                if !gi_content.is_empty() {
                    std::fs::write(&gi_path, gi_content)?;
                    created_files = true;
                }
            }
        }

        // 3. License
        if let Some(ref lic) = opts.license_template {
            if lic != "None" && !lic.trim().is_empty() {
                let lic_path = repo_dir.join("LICENSE");
                let year = chrono::Utc::now().format("%Y").to_string();
                let lic_content = match lic.as_str() {
                    "MIT" => format!(
                        "MIT License\n\nCopyright (c) {year}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n"
                    ),
                    "Apache-2.0" => format!(
                        "                                 Apache License\n                           Version 2.0, January 2004\n                        http://www.apache.org/licenses/\n\n   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION\n\n   Copyright {year}\n\n   Licensed under the Apache License, Version 2.0 (the \"License\");\n   you may not use this file except in compliance with the License.\n   You may obtain a copy of the License at\n\n       http://www.apache.org/licenses/LICENSE-2.0\n\n   Unless required by applicable law or agreed to in writing, software\n   distributed under the License is distributed on an \"AS IS\" BASIS,\n   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n   See the License for the specific language governing permissions and\n   limitations under the License.\n"
                    ),
                    "GPL-3.0" => format!(
                        "                    GNU GENERAL PUBLIC LICENSE\n                       Version 3, 29 June 2007\n\n Copyright (C) {year}\n\n Everyone is permitted to copy and distribute verbatim copies\n of this license document, but changing it is not allowed.\n\n                            Preamble\n\n  The GNU General Public License is a free, copyleft license for\nsoftware and other kinds of works.\n\n  This program is free software: you can redistribute it and/or modify\n  it under the terms of the GNU General Public License as published by\n  the Free Software Foundation, either version 3 of the License, or\n  (at your option) any later version.\n\n  This program is distributed in the hope that it will be useful,\n  but WITHOUT ANY WARRANTY; without even the implied warranty of\n  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n  GNU General Public License for more details.\n\n  You should have received a copy of the GNU General Public License\n  along with this program.  If not, see <https://www.gnu.org/licenses/>.\n"
                    ),
                    "GPL-2.0" => format!(
                        "                    GNU GENERAL PUBLIC LICENSE\n                       Version 2, June 1991\n\n Copyright (C) {year}\n\n Everyone is permitted to copy and distribute verbatim copies\n of this license document, but changing it is not allowed.\n\n  This program is free software; you can redistribute it and/or modify\n  it under the terms of the GNU General Public License as published by\n  the Free Software Foundation; either version 2 of the License, or\n  (at your option) any later version.\n\n  This program is distributed in the hope that it will be useful,\n  but WITHOUT ANY WARRANTY; without even the implied warranty of\n  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n  GNU General Public License for more details.\n"
                    ),
                    "AGPL-3.0" => format!(
                        "                    GNU AFFERO GENERAL PUBLIC LICENSE\n                       Version 3, 19 November 2007\n\n Copyright (C) {year}\n\n Everyone is permitted to copy and distribute verbatim copies\n of this license document, but changing it is not allowed.\n\n  This program is free software: you can redistribute it and/or modify\n  it under the terms of the GNU Affero General Public License as published by\n  the Free Software Foundation, either version 3 of the License, or\n  (at your option) any later version.\n"
                    ),
                    "LGPL-3.0" => format!(
                        "                   GNU LESSER GENERAL PUBLIC LICENSE\n                       Version 3, 29 June 2007\n\n Copyright (C) {year}\n\n Everyone is permitted to copy and distribute verbatim copies\n of this license document, but changing it is not allowed.\n\n  This program is free software: you can redistribute it and/or modify\n  it under the terms of the GNU Lesser General Public License as published by\n  the Free Software Foundation, either version 3 of the License, or\n  (at your option) any later version.\n"
                    ),
                    "BSD-2-Clause" => format!(
                        "BSD 2-Clause License\n\nCopyright (c) {year}\n\nRedistribution and use in source and binary forms, with or without\nmodification, are permitted provided that the following conditions are met:\n\n1. Redistributions of source code must retain the above copyright notice, this\n   list of conditions and the following disclaimer.\n\n2. Redistributions in binary form must reproduce the above copyright notice,\n   this list of conditions and the following disclaimer in the documentation\n   and/or other materials provided with the distribution.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS \"AS IS\"\nAND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE\nIMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE\nDISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE\nFOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL\nDAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR\nSERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER\nCAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,\nOR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\nOF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n"
                    ),
                    "BSD-3-Clause" => format!(
                        "BSD 3-Clause License\n\nCopyright (c) {year}\n\nRedistribution and use in source and binary forms, with or without\nmodification, are permitted provided that the following conditions are met:\n\n1. Redistributions of source code must retain the above copyright notice, this\n   list of conditions and the following disclaimer.\n\n2. Redistributions in binary form must reproduce the above copyright notice,\n   this list of conditions and the following disclaimer in the documentation\n   and/or other materials provided with the distribution.\n\n3. Neither the name of the copyright holder nor the names of its\n   contributors may be used to endorse or promote products derived from\n   this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS \"AS IS\"\nAND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE\nIMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE\nDISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE\nFOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL\nDAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR\nSERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER\nCAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,\nOR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\nOF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n"
                    ),
                    "0BSD" => format!(
                        "BSD Zero Clause License\n\nCopyright (C) {year}\n\nPermission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH\nREGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY\nAND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,\nINDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM\nLOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR\nOTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR\nPERFORMANCE OF THIS SOFTWARE.\n"
                    ),
                    "ISC" => format!(
                        "ISC License\n\nCopyright (c) {year}\n\nPermission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted, provided that the above\ncopyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\" AND THE AUTHOR DISCLAIMS ALL WARRANTIES\nWITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF\nMERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR\nANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES\nWHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN\nACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF\nOR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n"
                    ),
                    "MPL-2.0" => format!(
                        "Mozilla Public License Version 2.0\n==================================\n\nCopyright (c) {year}\n\nThis Source Code Form is subject to the terms of the Mozilla Public\nLicense, v. 2.0. If a copy of the MPL was not distributed with this\nfile, You can obtain one at https://mozilla.org/MPL/2.0/.\n"
                    ),
                    "Unlicense" => format!(
                        "This is free and unencumbered software released into the public domain.\n\nAnyone is free to copy, modify, publish, use, compile, sell, or\ndistribute this software, either in source code form or as a compiled\nbinary, for any purpose, commercial or non-commercial, and by any\nmeans.\n\nIn jurisdictions that recognize copyright laws, the author or authors\nof this software dedicate any and all copyright interest in the\nsoftware to the public domain. We make this dedication for the benefit\nof the public at large and to the detriment of our heirs and\nsuccessors. We intend this dedication to be an overt act of\nrelinquishment in perpetuity of all present and future rights to this\nsoftware under copyright law.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\nIN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR\nOTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,\nARISING FROM, OUT OF OR IN CONNECTION WITH THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE.\n\nFor more information, please refer to <https://unlicense.org>\n"
                    ),
                    "CC0-1.0" => format!(
                        "Creative Commons Legal Code\n\nCC0 1.0 Universal (CC0 1.0) Public Domain Dedication\n\nCopyright (c) {year}\n\nThe person who associated a work with this deed has dedicated the work to\nthe public domain by waiving all of his or her rights to the work worldwide\nunder copyright law, including all related and neighboring rights, to the\nextent allowed by law.\n\nYou can copy, modify, distribute and perform the work, even for commercial\npurposes, all without asking permission.\n"
                    ),
                    "BSL-1.0" => format!(
                        "Boost Software License - Version 1.0 - August 17th, 2003\n\nCopyright (c) {year}\n\nPermission is hereby granted, free of charge, to any person or organization\nobtaining a copy of the software and accompanying documentation covered by\nthis license (the \"Software\") to use, reproduce, display, distribute,\nexecute, and transmit the Software, and to prepare derivative works of the\nSoftware, and to permit third-parties to whom the Software is furnished to\ndo so, all subject to the following:\n\nThe copyright notices in the Software and this entire statement, including\nthe above license grant, this restriction and the following disclaimer,\nmust be included in all copies of the Software, in whole or in part, and\nall derivative works of the Software, unless such copies or derivative\nworks are solely in the form of machine-executable object code generated by\na source language processor.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT\nSHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE\nFOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE,\nARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\nDEALINGS IN THE SOFTWARE.\n"
                    ),
                    "EPL-2.0" => format!(
                        "Eclipse Public License - v 2.0\n\nCopyright (c) {year}\n\nTHE ACCOMPANYING PROGRAM IS PROVIDED UNDER THE TERMS OF THIS ECLIPSE\nPUBLIC LICENSE (\"AGREEMENT\"). ANY USE, REPRODUCTION OR DISTRIBUTION\nOF THE PROGRAM CONSTITUTES RECIPIENT'S ACCEPTANCE OF THIS AGREEMENT.\n\nhttps://www.eclipse.org/legal/epl-2.0/\n"
                    ),
                    "WTFPL" => format!(
                        "        DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE\n                    Version 2, December 2004\n\n Copyright (C) {year}\n\n Everyone is permitted to copy and distribute verbatim or modified\n copies of this license document, and changing it is allowed as long\n as the name is changed.\n\n            DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE\n   TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION\n\n  0. You just DO WHAT THE FUCK YOU WANT TO.\n"
                    ),
                    _ => "".to_string(),
                };
                if !lic_content.is_empty() {
                    std::fs::write(&lic_path, lic_content)?;
                    created_files = true;
                }
            }
        }

        // Initial Commit
        if created_files {
            let mut index = repo.index()?;
            index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
            index.write()?;
            let tree_id = index.write_tree()?;
            let tree = repo.find_tree(tree_id)?;

            // Prefer user's configured git identity; fall back to generic defaults
            let config = repo.config().ok();
            let global_name = config.as_ref()
                .and_then(|c| c.get_string("user.name").ok())
                .unwrap_or_else(|| "Git Desktop User".to_string());
            let global_email = config.as_ref()
                .and_then(|c| c.get_string("user.email").ok())
                .unwrap_or_else(|| "user@git.local".to_string());

            let sig = git2::Signature::now(&global_name, &global_email)?;
            let _ = repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[]);
        }

        Ok(repo_dir.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn list_known_repos_cmd() -> Result<Vec<crate::repos::registry::RepoEntry>, AppError> {
    let res = tokio::task::spawn_blocking(crate::repos::registry::list_known_repos)
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?;
    Ok(res)
}

#[command]
pub async fn add_repo_to_registry_cmd(
    path: String,
) -> Result<crate::repos::registry::RepoEntry, AppError> {
    let p = path.clone();
    let res = tokio::task::spawn_blocking(move || crate::repos::registry::add_repo(&p))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Repo,
        format!("Added repository '{}' to registry", res.name);
        repo_id: Some(path),
        meta: serde_json::json!({ "repo_name": res.name })
    );

    Ok(res)
}

#[command]
pub async fn remove_repo_from_registry_cmd(id: String) -> Result<(), AppError> {
    let i = id.clone();
    tokio::task::spawn_blocking(move || crate::repos::registry::remove_repo(&i))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Repo,
        "Removed repository from registry";
        repo_id: Some(id)
    );

    Ok(())
}

#[command]
pub async fn pin_repo_cmd(id: String, pinned: bool) -> Result<(), AppError> {
    let i = id.clone();
    tokio::task::spawn_blocking(move || crate::repos::registry::pin_repo(&i, pinned))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Repo,
        format!("{} repository in workspace", if pinned { "Pinned" } else { "Unpinned" });
        repo_id: Some(id)
    );

    Ok(())
}

#[command]
pub async fn get_repo_dashboard_status_cmd(
    path: String,
) -> Result<crate::repos::status::RepoDashboardStatus, AppError> {
    tokio::task::spawn_blocking(move || crate::repos::status::get_repo_dashboard_status(&path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_local_activity_cmd(
    repo_paths: Vec<String>,
    limit: Option<usize>,
) -> Result<Vec<crate::activity::local::ActivityEvent>, AppError> {
    let rps = repo_paths.clone();
    let events = tokio::task::spawn_blocking(move || {
        crate::activity::local::get_local_activity(rps, limit.unwrap_or(30))
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_debug!(
        crate::core::logging::LogCategory::Activity,
        format!("Scanned local activity across {} repos ({} events found)", repo_paths.len(), events.len());
        meta: serde_json::json!({ "repo_count": repo_paths.len(), "event_count": events.len() })
    );

    Ok(events)
}

#[command]
pub async fn get_gitlab_activity_cmd(
    account_id: String,
    project_paths: Vec<String>,
    limit: Option<usize>,
) -> Result<Vec<crate::activity::local::ActivityEvent>, AppError> {
    let accounts = keyring::list_accounts();
    let account = accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .or_else(|| keyring::get_active_account());

    if let Some(acct) = account {
        let events = crate::activity::gitlab::get_gitlab_activity(
            acct.server_url,
            acct.token,
            project_paths,
            limit.unwrap_or(20),
        )
        .await?;

        crate::log_info!(
            crate::core::logging::LogCategory::Activity,
            format!("Polled GitLab activity: fetched {} events", events.len());
            meta: serde_json::json!({ "event_count": events.len() })
        );

        Ok(events)
    } else {
        Ok(Vec::new())
    }
}

#[command]
pub async fn read_file_content_cmd(
    repo_path: String,
    file_path: String,
) -> Result<String, AppError> {
    let full_path = std::path::Path::new(&repo_path).join(&file_path);
    if !full_path.exists() {
        return Err(AppError::NotFound(format!(
            "File does not exist: {}",
            full_path.display()
        )));
    }
    std::fs::read_to_string(&full_path)
        .map_err(|e| AppError::Unknown(format!("Failed to read file: {}", e)))
}

#[command]
pub async fn save_file_content_cmd(
    repo_path: String,
    file_path: String,
    content: String,
) -> Result<(), AppError> {
    let full_path = std::path::Path::new(&repo_path).join(&file_path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Unknown(format!("Failed to create parent directories: {}", e)))?;
    }
    std::fs::write(&full_path, content.as_bytes())
        .map_err(|e| AppError::Unknown(format!("Failed to write file: {}", e)))?;

    crate::log_info!(
        crate::core::logging::LogCategory::Git,
        format!("File saved from editor: {}", file_path);
        meta: serde_json::json!({ "file_path": file_path })
    );

    Ok(())
}

#[command]
pub async fn create_directory_cmd(
    repo_path: String,
    folder_path: String,
) -> Result<(), AppError> {
    let full_path = std::path::Path::new(&repo_path).join(&folder_path);
    std::fs::create_dir_all(&full_path)
        .map_err(|e| AppError::Unknown(format!("Failed to create directory: {}", e)))?;
    Ok(())
}

#[command]
pub async fn rename_file_cmd(
    repo_path: String,
    old_path: String,
    new_path: String,
) -> Result<(), AppError> {
    let full_old = std::path::Path::new(&repo_path).join(&old_path);
    let full_new = std::path::Path::new(&repo_path).join(&new_path);

    if !full_old.exists() {
        return Err(AppError::NotFound(format!(
            "Source file does not exist: {}",
            full_old.display()
        )));
    }

    if let Some(parent) = full_new.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Unknown(format!("Failed to create parent directories: {}", e)))?;
    }

    std::fs::rename(&full_old, &full_new)
        .map_err(|e| AppError::Unknown(format!("Failed to rename file: {}", e)))?;

    crate::log_info!(
        crate::core::logging::LogCategory::Git,
        format!("Renamed '{}' to '{}'", old_path, new_path);
        meta: serde_json::json!({ "old_path": old_path, "new_path": new_path })
    );

    Ok(())
}


