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
        std::process::Command::new("cmd")
            .arg("/c")
            .arg("code")
            .arg(&repo_path)
            .spawn()?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("code")
            .arg(&repo_path)
            .spawn()?;
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
        std::process::Command::new("open")
            .arg(&repo_path)
            .spawn()?;
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
pub async fn add_repo_to_registry_cmd(path: String) -> Result<crate::repos::registry::RepoEntry, AppError> {
    tokio::task::spawn_blocking(move || crate::repos::registry::add_repo(&path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn remove_repo_from_registry_cmd(id: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::repos::registry::remove_repo(&id))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn pin_repo_cmd(id: String, pinned: bool) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::repos::registry::pin_repo(&id, pinned))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
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
    tokio::task::spawn_blocking(move || {
        crate::activity::local::get_local_activity(repo_paths, limit.unwrap_or(30))
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn get_gitlab_activity_cmd(
    account_id: String,
    project_paths: Vec<String>,
    limit: Option<usize>,
) -> Result<Vec<crate::activity::local::ActivityEvent>, AppError> {
    let accounts = keyring::list_accounts();
    let account = accounts.into_iter().find(|a| a.id == account_id)
        .or_else(|| keyring::get_active_account());

    if let Some(acct) = account {
        crate::activity::gitlab::get_gitlab_activity(
            acct.server_url,
            acct.token,
            project_paths,
            limit.unwrap_or(20),
        ).await
    } else {
        Ok(Vec::new())
    }
}



