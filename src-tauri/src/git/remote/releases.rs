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
pub struct ReleaseProgressPayload {
    pub stage: String,
    pub message: String,
    pub current_file: Option<String>,
    pub file_index: Option<usize>,
    pub total_files: Option<usize>,
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
    pub is_latest: Option<bool>,
    pub upcoming_release: Option<bool>,
    pub web_url: Option<String>,
    pub assets: Vec<ReleaseAsset>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseMeta {
    pub is_latest: Option<bool>,
    pub web_url: Option<String>,
}

/// Helper to save release metadata to .git/releases/<tag_name>/meta.json
pub fn save_local_release_meta(
    repo_path: &str,
    tag_name: &str,
    is_latest: Option<bool>,
    web_url: Option<String>,
) {
    let local_dir = std::path::Path::new(repo_path)
        .join(".git")
        .join("releases")
        .join(tag_name);

    let _ = std::fs::create_dir_all(&local_dir);
    let meta_path = local_dir.join("meta.json");

    let existing = load_local_release_meta(repo_path, tag_name);
    let meta = ReleaseMeta {
        is_latest: if is_latest.is_some() { is_latest } else { existing.as_ref().and_then(|e| e.is_latest) },
        web_url: web_url.or_else(|| existing.as_ref().and_then(|e| e.web_url.clone())),
    };

    if let Ok(json) = serde_json::to_string_pretty(&meta) {
        let _ = std::fs::write(meta_path, json);
    }

    // If this release was explicitly marked as latest, ensure other releases are demoted
    if is_latest == Some(true) {
        let all_releases_dir = std::path::Path::new(repo_path).join(".git").join("releases");
        if let Ok(entries) = std::fs::read_dir(all_releases_dir) {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        let other_tag = entry.file_name().to_string_lossy().to_string();
                        if other_tag != tag_name {
                            if let Some(mut other_meta) = load_local_release_meta(repo_path, &other_tag) {
                                if other_meta.is_latest == Some(true) {
                                    other_meta.is_latest = Some(false);
                                    let other_meta_path = entry.path().join("meta.json");
                                    if let Ok(json) = serde_json::to_string_pretty(&other_meta) {
                                        let _ = std::fs::write(other_meta_path, json);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Helper to load release metadata from .git/releases/<tag_name>/meta.json
pub fn load_local_release_meta(repo_path: &str, tag_name: &str) -> Option<ReleaseMeta> {
    let meta_path = std::path::Path::new(repo_path)
        .join(".git")
        .join("releases")
        .join(tag_name)
        .join("meta.json");

    if meta_path.is_file() {
        if let Ok(content) = std::fs::read_to_string(meta_path) {
            return serde_json::from_str::<ReleaseMeta>(&content).ok();
        }
    }
    None
}

/// Helper to load local assets from .git/releases/<tag_name>
pub fn load_local_release_assets(repo_path: &str, tag_name: &str) -> Vec<ReleaseAsset> {
    let local_dir = std::path::Path::new(repo_path)
        .join(".git")
        .join("releases")
        .join(tag_name);

    let mut assets = Vec::new();
    if local_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&local_dir) {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_file() {
                        let fname = entry.file_name().to_string_lossy().to_string();
                        // Ignore internal meta.json file from assets list
                        if fname == "meta.json" {
                            continue;
                        }
                        let size = entry.metadata().ok().map(|m| m.len());
                        let path_str = entry.path().to_string_lossy().to_string();
                        assets.push(ReleaseAsset {
                            name: fname,
                            url: path_str.clone(),
                            size,
                            direct_asset_url: Some(path_str),
                        });
                    }
                }
            }
        }
    }
    assets
}

/// Helper to copy local asset files into .git/releases/<tag_name> and prune removed files
pub fn save_local_release_assets(
    repo_path: &str,
    tag_name: &str,
    file_paths: &[String],
) -> Vec<ReleaseAsset> {
    let local_dir = std::path::Path::new(repo_path)
        .join(".git")
        .join("releases")
        .join(tag_name);

    let _ = std::fs::create_dir_all(&local_dir);
    let mut assets = Vec::new();
    let mut kept_filenames = std::collections::HashSet::new();

    for fp in file_paths {
        let src_path = std::path::Path::new(fp);
        if let Some(fname) = src_path.file_name().and_then(|n| n.to_str()) {
            if fname == "meta.json" {
                continue;
            }
            kept_filenames.insert(fname.to_string());
            let dest_path = local_dir.join(fname);
            let size = if src_path == dest_path {
                std::fs::metadata(&dest_path).ok().map(|m| m.len())
            } else if let Ok(meta) = std::fs::metadata(fp) {
                let _ = std::fs::copy(fp, &dest_path);
                Some(meta.len())
            } else {
                std::fs::metadata(&dest_path).ok().map(|m| m.len())
            };
            let path_str = dest_path.to_string_lossy().to_string();
            assets.push(ReleaseAsset {
                name: fname.to_string(),
                url: path_str.clone(),
                size,
                direct_asset_url: Some(path_str),
            });
        }
    }

    // Clean up any files in local_dir that were deleted/removed by user
    if let Ok(read_dir) = std::fs::read_dir(&local_dir) {
        for entry in read_dir.flatten() {
            if let Ok(file_name) = entry.file_name().into_string() {
                if file_name != "meta.json" && !kept_filenames.contains(&file_name) {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    assets
}

/// Lists all releases and annotated release markers in the repository.
pub fn list_releases(repo_path: &str) -> Result<Vec<ReleaseInfo>, AppError> {
    let repo = git2::Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let mut releases = Vec::new();
    let tag_names = repo.tag_names(None).map_err(|e| AppError::Git(e.to_string()))?;

    let mut any_explicit_latest = false;
    let mut tag_items = Vec::new();

    for name_opt in tag_names.iter() {
        if let Some(tag_name) = name_opt {
            if let Ok(obj) = repo.revparse_single(tag_name) {
                let sha = obj.id().to_string();
                let short_sha = if sha.len() >= 7 { sha[..7].to_string() } else { sha.clone() };

                let (subject, body, tagger_name, date_str) = if let Some(tag_obj) = obj.as_tag() {
                    let raw_msg = tag_obj.message().unwrap_or("").trim();
                    let (subj, b) = if let Some(idx) = raw_msg.find("\n\n") {
                        (raw_msg[..idx].trim().to_string(), raw_msg[idx + 2..].trim().to_string())
                    } else if let Some(idx) = raw_msg.find('\n') {
                        (raw_msg[..idx].trim().to_string(), raw_msg[idx + 1..].trim().to_string())
                    } else {
                        (raw_msg.to_string(), String::new())
                    };
                    let tagger = tag_obj.tagger().and_then(|t| t.name().map(|s| s.to_string()));
                    let time = tag_obj.tagger().map(|t| {
                        chrono::DateTime::from_timestamp(t.when().seconds(), 0)
                            .unwrap_or_else(chrono::Utc::now)
                            .to_rfc3339()
                    }).unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
                    (subj, b, tagger, time)
                } else if let Ok(commit) = obj.peel_to_commit() {
                    let subj = commit.summary().unwrap_or("").to_string();
                    let b = commit.body().unwrap_or("").to_string();
                    let author = commit.author().name().map(|s| s.to_string());
                    let time = chrono::DateTime::from_timestamp(commit.time().seconds(), 0)
                        .unwrap_or_else(chrono::Utc::now)
                        .to_rfc3339();
                    (subj, b, author, time)
                } else {
                    (String::new(), String::new(), None, chrono::Utc::now().to_rfc3339())
                };

                let local_meta = load_local_release_meta(repo_path, tag_name);
                if let Some(m) = &local_meta {
                    if m.is_latest == Some(true) {
                        any_explicit_latest = true;
                    }
                }

                tag_items.push((tag_name.to_string(), short_sha, subject, body, tagger_name, date_str, local_meta));
            }
        }
    }

    // Sort tags descending by date
    tag_items.sort_by(|a, b| b.5.cmp(&a.5));

    for (index, (tag_name, sha, subject, body, tagger_name, date_str, local_meta)) in tag_items.into_iter().enumerate() {
        let name = if !subject.is_empty() {
            subject
        } else {
            format!("Release {}", tag_name)
        };

        let description = if !body.is_empty() {
            body
        } else {
            format!("Release version {}", tag_name)
        };

        let is_prerelease = tag_name.to_lowercase().contains("beta")
            || tag_name.to_lowercase().contains("alpha")
            || tag_name.to_lowercase().contains("rc");

        let assets = load_local_release_assets(repo_path, &tag_name);

        let is_latest = if let Some(meta) = &local_meta {
            if let Some(explicit_latest) = meta.is_latest {
                Some(explicit_latest)
            } else if is_prerelease {
                Some(false)
            } else if !any_explicit_latest {
                Some(index == 0)
            } else {
                Some(false)
            }
        } else if is_prerelease {
            Some(false)
        } else if !any_explicit_latest {
            Some(index == 0)
        } else {
            Some(false)
        };

        let web_url = local_meta.and_then(|m| m.web_url);

        releases.push(ReleaseInfo {
            id: Some(tag_name.clone()),
            tag_name,
            name,
            description,
            created_at: date_str.clone(),
            released_at: Some(date_str),
            author_name: tagger_name,
            author_avatar: None,
            commit_sha: Some(sha),
            is_draft: Some(false),
            is_prerelease: Some(is_prerelease),
            is_latest,
            upcoming_release: Some(false),
            web_url,
            assets,
        });
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
    is_latest: Option<bool>,
    is_prerelease: Option<bool>,
    file_paths: Option<&[String]>,
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

    let is_pre = is_prerelease.unwrap_or_else(|| {
        tag_name.to_lowercase().contains("beta")
            || tag_name.to_lowercase().contains("alpha")
            || tag_name.to_lowercase().contains("rc")
    });

    let assets = if let Some(files) = file_paths {
        save_local_release_assets(repo_path, tag_name.trim(), files)
    } else {
        Vec::new()
    };

    save_local_release_meta(repo_path, tag_name.trim(), is_latest, None);

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
        is_prerelease: Some(is_pre),
        is_latest,
        upcoming_release: Some(false),
        web_url: None,
        assets,
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
    is_latest: Option<bool>,
    is_prerelease: Option<bool>,
    file_paths: Option<&[String]>,
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

    let assets = if let Some(files) = file_paths {
        save_local_release_assets(repo_path, tag_name.trim(), files)
    } else {
        save_local_release_assets(repo_path, tag_name.trim(), &[])
    };

    save_local_release_meta(repo_path, tag_name.trim(), is_latest, None);

    let is_pre = is_prerelease.unwrap_or_else(|| {
        tag_name.to_lowercase().contains("beta") || tag_name.to_lowercase().contains("rc")
    });

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
        is_prerelease: Some(is_pre),
        is_latest,
        upcoming_release: Some(false),
        web_url: None,
        assets,
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

/// Publishes a release to GitHub / GitLab platform API if connected account credentials exist,
/// configuring latest status and uploading attached release assets with real-time stage progress.
pub async fn publish_release_to_remote_api(
    app_handle: Option<&tauri::AppHandle>,
    repo_path: &str,
    tag_name: &str,
    name: &str,
    description: &str,
    remote: Option<&str>,
    is_latest: Option<bool>,
    is_prerelease: Option<bool>,
    file_paths: Option<&[String]>,
) -> Result<(Option<String>, Vec<ReleaseAsset>), AppError> {
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
        None => return Ok((None, Vec::new())),
    };

    let (host, owner, repo_name) = match parse_remote_url_parts(&remote_url_str) {
        Some(parts) => parts,
        None => return Ok((None, Vec::new())),
    };

    let is_pre = is_prerelease.unwrap_or_else(|| {
        tag_name.to_lowercase().contains("beta")
            || tag_name.to_lowercase().contains("alpha")
            || tag_name.to_lowercase().contains("rc")
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::Git(format!("Failed to build HTTP client: {}", e)))?;

    let mut uploaded_assets = Vec::new();
    let mut release_web_url: Option<String> = None;

    // 1. GitHub API Release
    if host.contains("github.com") {
        if let Some(token) = find_token_for_host(repo_path, &host) {
            let token = token.trim();
            if !token.is_empty() {
                if let Some(app) = app_handle {
                    use tauri::Emitter;
                    let _ = app.emit(
                        "release:progress",
                        &ReleaseProgressPayload {
                            stage: "publishing".to_string(),
                            message: format!("Publishing release '{}' to GitHub API...", name),
                            current_file: None,
                            file_index: None,
                            total_files: None,
                        },
                    );
                }

                let make_latest_val = match is_latest {
                    Some(true) => "true",
                    Some(false) => "false",
                    None => if is_pre { "false" } else { "legacy" },
                };

                let create_url = format!("https://api.github.com/repos/{}/{}/releases", owner, repo_name);
                let body = serde_json::json!({
                    "tag_name": tag_name,
                    "name": name,
                    "body": description,
                    "draft": false,
                    "prerelease": is_pre,
                    "make_latest": make_latest_val
                });

                let mut github_release_id: Option<u64> = None;

                let res = client
                    .post(&create_url)
                    .header("User-Agent", "GitDesktop")
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", "2022-11-28")
                    .bearer_auth(token)
                    .json(&body)
                    .send()
                    .await;

                if let Ok(resp) = res {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            release_web_url = json.get("html_url").and_then(|u| u.as_str()).map(|s| s.to_string());
                            github_release_id = json.get("id").and_then(|i| i.as_u64());
                        }
                    } else if resp.status().as_u16() == 422 {
                        // Release already exists for tag, try to update it
                        let tag_release_url = format!("https://api.github.com/repos/{}/{}/releases/tags/{}", owner, repo_name, tag_name);
                        let get_res = client
                            .get(&tag_release_url)
                            .header("User-Agent", "GitDesktop")
                            .header("Accept", "application/vnd.github+json")
                            .header("X-GitHub-Api-Version", "2022-11-28")
                            .bearer_auth(token)
                            .send()
                            .await;

                        if let Ok(tag_resp) = get_res {
                            if let Ok(tag_json) = tag_resp.json::<serde_json::Value>().await {
                                if let Some(release_id) = tag_json.get("id").and_then(|i| i.as_u64()) {
                                    github_release_id = Some(release_id);
                                    let update_url = format!("https://api.github.com/repos/{}/{}/releases/{}", owner, repo_name, release_id);
                                    let update_body = serde_json::json!({
                                        "name": name,
                                        "body": description,
                                        "prerelease": is_prerelease,
                                        "make_latest": make_latest_val
                                    });

                                    let patch_res = client
                                        .patch(&update_url)
                                        .header("User-Agent", "GitDesktop")
                                        .header("Accept", "application/vnd.github+json")
                                        .header("X-GitHub-Api-Version", "2022-11-28")
                                        .bearer_auth(token)
                                        .json(&update_body)
                                        .send()
                                        .await;

                                    if let Ok(patch_resp) = patch_res {
                                        if let Ok(p_json) = patch_resp.json::<serde_json::Value>().await {
                                            release_web_url = p_json.get("html_url").and_then(|u| u.as_str()).map(|s| s.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Upload attached files to GitHub release assets
                if let (Some(rel_id), Some(files)) = (github_release_id, file_paths) {
                    let total_cnt = files.len();
                    for (idx, fp) in files.iter().enumerate() {
                        let fname = std::path::Path::new(fp)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("asset");

                        if let Some(app) = app_handle {
                            use tauri::Emitter;
                            let _ = app.emit(
                                "release:progress",
                                &ReleaseProgressPayload {
                                    stage: "uploading".to_string(),
                                    message: format!("Uploading asset ({}/{}): {}", idx + 1, total_cnt, fname),
                                    current_file: Some(fname.to_string()),
                                    file_index: Some(idx + 1),
                                    total_files: Some(total_cnt),
                                },
                            );
                        }

                        if let Ok(data) = tokio::fs::read(fp).await {
                            let encoded_name = urlencoding::encode(fname);
                            let upload_url = format!(
                                "https://uploads.github.com/repos/{}/{}/releases/{}/assets?name={}",
                                owner, repo_name, rel_id, encoded_name
                            );

                            let up_res = client
                                .post(&upload_url)
                                .header("User-Agent", "GitDesktop")
                                .header("Accept", "application/vnd.github+json")
                                .header("X-GitHub-Api-Version", "2022-11-28")
                                .header("Content-Type", "application/octet-stream")
                                .bearer_auth(token)
                                .body(data)
                                .send()
                                .await;

                            if let Ok(up_resp) = up_res {
                                if let Ok(asset_json) = up_resp.json::<serde_json::Value>().await {
                                    let name_str = asset_json
                                        .get("name")
                                        .and_then(|n| n.as_str())
                                        .unwrap_or(fname)
                                        .to_string();
                                    let download_url = asset_json
                                        .get("browser_download_url")
                                        .and_then(|u| u.as_str())
                                        .map(|s| s.to_string())
                                        .unwrap_or_default();
                                    let size_num = asset_json.get("size").and_then(|s| s.as_u64());

                                    uploaded_assets.push(ReleaseAsset {
                                        name: name_str,
                                        url: download_url.clone(),
                                        size: size_num,
                                        direct_asset_url: Some(download_url),
                                    });
                                }
                            }
                        }
                    }
                }

                return Ok((release_web_url, uploaded_assets));
            }
        }
    } else if host.contains("gitlab") {
        // 2. GitLab API Release
        if let Some(token) = find_token_for_host(repo_path, &host) {
            let token = token.trim();
            if !token.is_empty() {
                if let Some(app) = app_handle {
                    use tauri::Emitter;
                    let _ = app.emit(
                        "release:progress",
                        &ReleaseProgressPayload {
                            stage: "publishing".to_string(),
                            message: format!("Publishing release '{}' to GitLab API...", name),
                            current_file: None,
                            file_index: None,
                            total_files: None,
                        },
                    );
                }

                let project_path = format!("{}/{}", owner, repo_name);
                let encoded_project: String = urlencoding::encode(&project_path).to_string();
                let base_server = if host == "gitlab.com" {
                    "https://gitlab.com".to_string()
                } else {
                    format!("https://{}", host)
                };

                let released_at_val = match is_latest {
                    Some(true) => Some(chrono::Utc::now().to_rfc3339()),
                    Some(false) => Some("1970-01-01T00:00:00Z".to_string()),
                    None => None,
                };

                let create_url = format!("{}/api/v4/projects/{}/releases", base_server, encoded_project);
                let mut body = serde_json::json!({
                    "name": name,
                    "tag_name": tag_name,
                    "description": description
                });
                if let Some(r_at) = &released_at_val {
                    body["released_at"] = serde_json::json!(r_at);
                }

                let res = client
                    .post(&create_url)
                    .header("PRIVATE-TOKEN", token)
                    .json(&body)
                    .send()
                    .await;

                if let Ok(resp) = res {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            release_web_url = json
                                .get("_links")
                                .and_then(|l| l.get("self"))
                                .and_then(|u| u.as_str())
                                .map(|s| s.to_string());
                        }
                    } else if resp.status().as_u16() == 409 {
                        // Release already exists, update it via PUT
                        let update_url = format!("{}/api/v4/projects/{}/releases/{}", base_server, encoded_project, tag_name);
                        let mut update_body = serde_json::json!({
                            "name": name,
                            "description": description
                        });
                        if let Some(r_at) = &released_at_val {
                            update_body["released_at"] = serde_json::json!(r_at);
                        }

                        let put_res = client
                            .put(&update_url)
                            .header("PRIVATE-TOKEN", token)
                            .json(&update_body)
                            .send()
                            .await;

                        if let Ok(p_resp) = put_res {
                            if let Ok(p_json) = p_resp.json::<serde_json::Value>().await {
                                release_web_url = p_json
                                    .get("_links")
                                    .and_then(|l| l.get("self"))
                                    .and_then(|u| u.as_str())
                                    .map(|s| s.to_string());
                            }
                        }
                    }
                }

                // Upload attached files to GitLab uploads & release asset links
                if let Some(files) = file_paths {
                    let total_cnt = files.len();
                    for (idx, fp) in files.iter().enumerate() {
                        let fname = std::path::Path::new(fp)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("asset")
                            .to_string();

                        if let Some(app) = app_handle {
                            use tauri::Emitter;
                            let _ = app.emit(
                                "release:progress",
                                &ReleaseProgressPayload {
                                    stage: "uploading".to_string(),
                                    message: format!("Uploading asset ({}/{}): {}", idx + 1, total_cnt, fname),
                                    current_file: Some(fname.clone()),
                                    file_index: Some(idx + 1),
                                    total_files: Some(total_cnt),
                                },
                            );
                        }

                        if let Ok(data) = tokio::fs::read(fp).await {
                            let part = reqwest::multipart::Part::bytes(data).file_name(fname.clone());
                            let form = reqwest::multipart::Form::new().part("file", part);

                            let upload_url = format!("{}/api/v4/projects/{}/uploads", base_server, encoded_project);
                            let up_res = client
                                .post(&upload_url)
                                .header("PRIVATE-TOKEN", token)
                                .multipart(form)
                                .send()
                                .await;

                            if let Ok(up_resp) = up_res {
                                if let Ok(up_json) = up_resp.json::<serde_json::Value>().await {
                                    if let Some(rel_url) = up_json.get("url").and_then(|u| u.as_str()) {
                                        let full_asset_url = format!("{}{}", base_server, rel_url);
                                        let link_url = format!(
                                            "{}/api/v4/projects/{}/releases/{}/assets/links",
                                            base_server, encoded_project, tag_name
                                        );
                                        let link_body = serde_json::json!({
                                            "name": fname,
                                            "url": full_asset_url,
                                            "direct_asset_url": full_asset_url
                                        });

                                        let _ = client
                                            .post(&link_url)
                                            .header("PRIVATE-TOKEN", token)
                                            .json(&link_body)
                                            .send()
                                            .await;

                                        uploaded_assets.push(ReleaseAsset {
                                            name: fname,
                                            url: full_asset_url.clone(),
                                            size: None,
                                            direct_asset_url: Some(full_asset_url),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                save_local_release_meta(repo_path, tag_name, is_latest, release_web_url.clone());
                return Ok((release_web_url, uploaded_assets));
            }
        }
    }

    save_local_release_meta(repo_path, tag_name, is_latest, release_web_url.clone());
    Ok((release_web_url, uploaded_assets))
}

/// Deletes a release and optionally removes local and remote tags.
pub fn delete_release(
    repo_path: &str,
    tag_name: &str,
    delete_tag: bool,
    remote: Option<&str>,
) -> Result<(), AppError> {
    let local_dir = std::path::Path::new(repo_path)
        .join(".git")
        .join("releases")
        .join(tag_name);
    let _ = std::fs::remove_dir_all(local_dir);

    if delete_tag {
        super::tags::delete_tag(repo_path, tag_name)?;
        let _ = super::tags::delete_remote_tag(repo_path, remote, tag_name);
    }
    Ok(())
}
