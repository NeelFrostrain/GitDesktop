use crate::error::AppError;
use crate::git::command::silent_git_command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseAsset {
    pub name: String,
    pub url: String,
    pub size: Option<u64>,
    pub direct_asset_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseInfo {
    pub id: Option<String>,
    pub tag_name: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub released_at: Option<String>,
    pub author_name: Option<String>,
    pub author_avatar: Option<String>,
    pub commit_sha: Option<String>,
    pub is_draft: Option<bool>,
    pub is_prerelease: Option<bool>,
    pub upcoming_release: Option<bool>,
    pub web_url: Option<String>,
    pub assets: Vec<ReleaseAsset>,
}

/// Lists all releases and annotated release markers in the repository.
pub fn list_releases(repo_path: &str) -> Result<Vec<ReleaseInfo>, AppError> {
    let output = silent_git_command()
        .arg("tag")
        .arg("-l")
        .arg("--sort=-creatordate")
        .arg("--format=%(refname:short)|%(objectname:short)|%(contents:subject)|%(contents:body)|%(taggername)|%(creatordate:iso-strict)")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to list releases: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut releases = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(6, '|').collect();
        if !parts.is_empty() && !parts[0].trim().is_empty() {
            let tag_name = parts[0].trim().to_string();
            let sha = parts.get(1).map(|s| s.trim().to_string()).unwrap_or_default();
            let subject = parts.get(2).map(|s| s.trim().to_string()).unwrap_or_default();
            let body = parts.get(3).map(|s| s.trim().to_string()).unwrap_or_default();
            let tagger = parts.get(4).filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string());
            let date = parts.get(5).filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string()).unwrap_or_else(|| {
                chrono::Utc::now().to_rfc3339()
            });

            let name = if !subject.is_empty() {
                subject.clone()
            } else {
                format!("Release {}", tag_name)
            };

            let description = if !body.is_empty() {
                body
            } else if !subject.is_empty() && subject != format!("Release {}", tag_name) {
                subject
            } else {
                format!("Release version {}", tag_name)
            };

            let is_prerelease = tag_name.to_lowercase().contains("beta")
                || tag_name.to_lowercase().contains("alpha")
                || tag_name.to_lowercase().contains("rc");

            releases.push(ReleaseInfo {
                id: Some(tag_name.clone()),
                tag_name,
                name,
                description,
                created_at: date.clone(),
                released_at: Some(date),
                author_name: tagger,
                author_avatar: None,
                commit_sha: Some(sha),
                is_draft: Some(false),
                is_prerelease: Some(is_prerelease),
                upcoming_release: Some(false),
                web_url: None,
                assets: Vec::new(),
            });
        }
    }

    Ok(releases)
}

/// Creates a new release and associated annotated tag, optionally pushing to remote.
pub fn create_release(
    repo_path: &str,
    tag_name: &str,
    name: &str,
    description: &str,
    target_ref: Option<&str>,
    push_immediately: bool,
    remote: Option<&str>,
) -> Result<ReleaseInfo, AppError> {
    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    cmd.arg("tag").arg("-a").arg("-f");

    let full_message = if !name.trim().is_empty() && !description.trim().is_empty() {
        format!("{}\n\n{}", name.trim(), description.trim())
    } else if !name.trim().is_empty() {
        name.trim().to_string()
    } else {
        description.trim().to_string()
    };

    cmd.arg("-m").arg(&full_message);
    cmd.arg(tag_name.trim());

    if let Some(target) = target_ref {
        if !target.trim().is_empty() {
            cmd.arg(target.trim());
        }
    }

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to create release tag: {}",
            stderr.trim()
        )));
    }

    if push_immediately {
        super::tags::push_specific_tag(repo_path, remote, tag_name.trim())?;
    }

    let is_prerelease = tag_name.to_lowercase().contains("beta")
        || tag_name.to_lowercase().contains("alpha")
        || tag_name.to_lowercase().contains("rc");

    Ok(ReleaseInfo {
        id: Some(tag_name.to_string()),
        tag_name: tag_name.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        released_at: Some(chrono::Utc::now().to_rfc3339()),
        author_name: None,
        author_avatar: None,
        commit_sha: None,
        is_draft: Some(false),
        is_prerelease: Some(is_prerelease),
        upcoming_release: Some(false),
        web_url: None,
        assets: Vec::new(),
    })
}

/// Updates an existing release title and changelog notes by forcing tag update.
pub fn update_release(
    repo_path: &str,
    tag_name: &str,
    name: &str,
    description: &str,
    push_immediately: bool,
    remote: Option<&str>,
) -> Result<ReleaseInfo, AppError> {
    let full_message = if !name.trim().is_empty() && !description.trim().is_empty() {
        format!("{}\n\n{}", name.trim(), description.trim())
    } else if !name.trim().is_empty() {
        name.trim().to_string()
    } else {
        description.trim().to_string()
    };

    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    cmd.arg("tag").arg("-a").arg("-f").arg("-m").arg(&full_message).arg(tag_name.trim());

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to update release tag: {}",
            stderr.trim()
        )));
    }

    if push_immediately {
        super::tags::push_specific_tag(repo_path, remote, tag_name.trim())?;
    }

    Ok(ReleaseInfo {
        id: Some(tag_name.to_string()),
        tag_name: tag_name.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        released_at: Some(chrono::Utc::now().to_rfc3339()),
        author_name: None,
        author_avatar: None,
        commit_sha: None,
        is_draft: Some(false),
        is_prerelease: Some(tag_name.to_lowercase().contains("beta") || tag_name.to_lowercase().contains("rc")),
        upcoming_release: Some(false),
        web_url: None,
        assets: Vec::new(),
    })
}

/// Helper to extract (host, owner/group, repo_name) from remote URL
pub fn parse_remote_url_parts(url: &str) -> Option<(String, String, String)> {
    let clean = url.trim().trim_end_matches(".git");
    if clean.starts_with("git@") {
        let after_at = &clean["git@".len()..];
        if let Some((host, path)) = after_at.split_once(':') {
            let path_clean = path.trim_start_matches('/');
            if let Some((owner, repo)) = path_clean.split_once('/') {
                return Some((host.to_lowercase(), owner.to_string(), repo.to_string()));
            }
        }
    } else if clean.starts_with("https://") || clean.starts_with("http://") || clean.starts_with("ssh://") {
        let without_proto = clean
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_start_matches("ssh://git@")
            .trim_start_matches("ssh://");

        if let Some((host, path)) = without_proto.split_once('/') {
            let path_clean = path.trim_start_matches('/');
            if let Some((owner, repo)) = path_clean.split_once('/') {
                return Some((host.to_lowercase(), owner.to_string(), repo.to_string()));
            }
        }
    }
    None
}

/// Helper to get credential password/token directly from Git Credential Manager
pub fn get_credential_from_git_helper(repo_path: &str, host: &str) -> Option<String> {
    use std::io::Write;
    use std::process::Stdio;

    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    cmd.arg("credential").arg("fill");

    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    if let Some(mut stdin) = child.stdin.take() {
        let input = format!("protocol=https\nhost={}\n\n", host);
        let _ = stdin.write_all(input.as_bytes());
    }

    let output = child.wait_with_output().ok()?;
    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let trimmed = line.trim();
            if let Some((k, v)) = trimmed.split_once('=') {
                if k.trim() == "password" {
                    let pass = v.trim().to_string();
                    if !pass.is_empty() {
                        return Some(pass);
                    }
                }
            }
        }
    }
    None
}

/// Finds an authentication token for a host from keyring accounts, Git Credential Manager, or environment variables
pub fn find_token_for_host(repo_path: &str, host: &str) -> Option<String> {
    // 1. Check keyring/local accounts
    let accounts = crate::auth::keyring::list_accounts();
    for acct in &accounts {
        let acct_host = acct
            .server_url
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_end_matches('/')
            .to_lowercase();

        if (host.contains("github.com") && acct.provider == "github")
            || (!acct_host.is_empty() && host.to_lowercase().contains(&acct_host))
        {
            let token = acct.token.trim().to_string();
            if !token.is_empty() {
                return Some(token);
            }
        }
    }

    // 2. Check Git Credential Manager / helper via `git credential fill`
    if let Some(token) = get_credential_from_git_helper(repo_path, host) {
        if !token.trim().is_empty() {
            return Some(token.trim().to_string());
        }
    }

    // 3. Check environment variables
    if host.contains("github.com") {
        for env_var in &["GITHUB_TOKEN", "GH_TOKEN"] {
            if let Ok(t) = std::env::var(env_var) {
                if !t.trim().is_empty() {
                    return Some(t.trim().to_string());
                }
            }
        }
    } else if host.contains("gitlab") {
        for env_var in &["GITLAB_TOKEN", "GL_TOKEN"] {
            if let Ok(t) = std::env::var(env_var) {
                if !t.trim().is_empty() {
                    return Some(t.trim().to_string());
                }
            }
        }
    }

    None
}

/// Publishes a release to GitHub / GitLab platform API if connected account credentials exist
pub async fn publish_release_to_remote_api(
    repo_path: &str,
    tag_name: &str,
    name: &str,
    description: &str,
    remote: Option<&str>,
) -> Result<Option<String>, AppError> {
    let remote_name = remote.unwrap_or("origin");
    let remote_url_str = {
        if let Ok(repo) = git2::Repository::open(repo_path) {
            if let Ok(remote_obj) = repo.find_remote(remote_name) {
                remote_obj.url().map(|u| u.to_string())
            } else {
                None
            }
        } else {
            None
        }
    };

    let remote_url_str = match remote_url_str {
        Some(u) => u,
        None => return Ok(None),
    };

    let (host, owner, repo_name) = match parse_remote_url_parts(&remote_url_str) {
        Some(parts) => parts,
        None => return Ok(None),
    };

    let is_prerelease = tag_name.to_lowercase().contains("beta")
        || tag_name.to_lowercase().contains("alpha")
        || tag_name.to_lowercase().contains("rc");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Git(format!("Failed to build HTTP client: {}", e)))?;

    // 1. GitHub API Release
    if host.contains("github.com") {
        if let Some(token) = find_token_for_host(repo_path, &host) {
            let token = token.trim();
            if !token.is_empty() {
                let create_url = format!("https://api.github.com/repos/{}/{}/releases", owner, repo_name);
                let body = serde_json::json!({
                    "tag_name": tag_name,
                    "name": name,
                    "body": description,
                    "draft": false,
                    "prerelease": is_prerelease
                });

                let res = client
                    .post(&create_url)
                    .header("User-Agent", "GitDesktop")
                    .header("Accept", "application/vnd.github+json")
                    .bearer_auth(token)
                    .json(&body)
                    .send()
                    .await;

                if let Ok(resp) = res {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            let html_url = json.get("html_url").and_then(|u| u.as_str()).map(|s| s.to_string());
                            return Ok(html_url);
                        }
                    } else if resp.status().as_u16() == 422 {
                        // Release already exists for tag, try to update it
                        let tag_release_url = format!("https://api.github.com/repos/{}/{}/releases/tags/{}", owner, repo_name, tag_name);
                        let get_res = client
                            .get(&tag_release_url)
                            .header("User-Agent", "GitDesktop")
                            .header("Accept", "application/vnd.github+json")
                            .bearer_auth(token)
                            .send()
                            .await;

                        if let Ok(tag_resp) = get_res {
                            if let Ok(tag_json) = tag_resp.json::<serde_json::Value>().await {
                                if let Some(release_id) = tag_json.get("id").and_then(|i| i.as_u64()) {
                                    let update_url = format!("https://api.github.com/repos/{}/{}/releases/{}", owner, repo_name, release_id);
                                    let update_body = serde_json::json!({
                                        "name": name,
                                        "body": description,
                                        "prerelease": is_prerelease
                                    });

                                    let patch_res = client
                                        .patch(&update_url)
                                        .header("User-Agent", "GitDesktop")
                                        .header("Accept", "application/vnd.github+json")
                                        .bearer_auth(token)
                                        .json(&update_body)
                                        .send()
                                        .await;

                                    if let Ok(patch_resp) = patch_res {
                                        if let Ok(p_json) = patch_resp.json::<serde_json::Value>().await {
                                            let html_url = p_json.get("html_url").and_then(|u| u.as_str()).map(|s| s.to_string());
                                            return Ok(html_url);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } else if host.contains("gitlab") {
        // 2. GitLab API Release
        if let Some(token) = find_token_for_host(repo_path, &host) {
            let token = token.trim();
            if !token.is_empty() {
                let project_path = format!("{}/{}", owner, repo_name);
                let encoded_project: String = urlencoding::encode(&project_path).to_string();
                let base_server = if host == "gitlab.com" {
                    "https://gitlab.com".to_string()
                } else {
                    format!("https://{}", host)
                };

                let create_url = format!("{}/api/v4/projects/{}/releases", base_server, encoded_project);
                let body = serde_json::json!({
                    "name": name,
                    "tag_name": tag_name,
                    "description": description
                });

                let res = client
                    .post(&create_url)
                    .header("PRIVATE-TOKEN", token)
                    .json(&body)
                    .send()
                    .await;

                if let Ok(resp) = res {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            let web_url = json.get("_links").and_then(|l| l.get("self")).and_then(|u| u.as_str()).map(|s| s.to_string());
                            return Ok(web_url);
                        }
                    } else if resp.status().as_u16() == 409 {
                        // Release already exists, update it via PUT
                        let update_url = format!("{}/api/v4/projects/{}/releases/{}", base_server, encoded_project, tag_name);
                        let update_body = serde_json::json!({
                            "name": name,
                            "description": description
                        });

                        let put_res = client
                            .put(&update_url)
                            .header("PRIVATE-TOKEN", token)
                            .json(&update_body)
                            .send()
                            .await;

                        if let Ok(p_resp) = put_res {
                            if let Ok(p_json) = p_resp.json::<serde_json::Value>().await {
                                let web_url = p_json.get("_links").and_then(|l| l.get("self")).and_then(|u| u.as_str()).map(|s| s.to_string());
                                return Ok(web_url);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

/// Deletes a release and optionally removes local and remote tags.
pub fn delete_release(
    repo_path: &str,
    tag_name: &str,
    delete_tag: bool,
    remote: Option<&str>,
) -> Result<(), AppError> {
    if delete_tag {
        super::tags::delete_tag(repo_path, tag_name)?;
        let _ = super::tags::delete_remote_tag(repo_path, remote, tag_name);
    }
    Ok(())
}
