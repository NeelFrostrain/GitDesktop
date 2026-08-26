use crate::auth::github::{GitHubClient, UnifiedRepo};
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
    let provider_accounts = crate::domain::accounts::token_store::list_accounts();
    let gitlab_acc = provider_accounts
        .iter()
        .find(|a| a.provider == crate::domain::accounts::provider::ProviderKind::Gitlab && a.is_active)
        .or_else(|| {
            provider_accounts
                .iter()
                .find(|a| a.provider == crate::domain::accounts::provider::ProviderKind::Gitlab)
        });

    let mut gitlab_token = None;
    let mut instance_url = None;

    if let Some(acc) = gitlab_acc {
        if let Ok(Some(tok)) = crate::domain::accounts::token_store::get_token(&acc.id) {
            gitlab_token = Some(tok);
            instance_url = Some(acc.instance_url.clone());
        }
    }

    if gitlab_token.is_none() {
        let accounts = keyring::list_accounts();
        if let Some(a) = accounts
            .iter()
            .find(|a| a.provider == "gitlab" && a.is_active)
            .or_else(|| accounts.iter().find(|a| a.provider == "gitlab"))
        {
            gitlab_token = Some(a.token.clone());
            instance_url = Some(a.server_url.clone());
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

    GitLabClient::new(server_url, token, None)
}

fn get_github_client() -> Result<GitHubClient, AppError> {
    // 1. Try to find GitHub token in token_store (OAuth or PAT)
    let provider_accounts = crate::domain::accounts::token_store::list_accounts();
    let mut github_token = None;

    if let Some(gh_acc) = provider_accounts
        .iter()
        .find(|a| a.provider == crate::domain::accounts::provider::ProviderKind::Github && a.is_active)
        .or_else(|| {
            provider_accounts
                .iter()
                .find(|a| a.provider == crate::domain::accounts::provider::ProviderKind::Github)
        })
    {
        if let Ok(Some(tok)) = crate::domain::accounts::token_store::get_token(&gh_acc.id) {
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

    GitHubClient::new(github_token.as_deref())
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
        items: paged
            .items
            .into_iter()
            .map(gitlab_project_to_unified)
            .collect(),
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
                    "MIT" => format!("MIT License\n\nCopyright (c) {} \n\nPermission is hereby granted, free of charge, to any person obtaining a copy...", year),
                    "Apache-2.0" => format!("Apache License\nVersion 2.0, January 2004\n\nCopyright {} ...", year),
                    "GPL-3.0" => format!("GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n\nCopyright (C) {} ...", year),
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


