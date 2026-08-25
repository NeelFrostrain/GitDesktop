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
    cmd.arg("tag").arg("-a");

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
        // Force push updated tag
        use crate::git::remote::{apply_git_auth_args_pub, get_git_auth_info};
        let auth_info = get_git_auth_info(repo_path);
        let mut push_cmd = silent_git_command();
        push_cmd.current_dir(repo_path);
        apply_git_auth_args_pub(&mut push_cmd, &auth_info);
        let remote_name = remote.unwrap_or("origin");
        push_cmd.arg("push").arg(remote_name).arg("--force").arg(tag_name.trim());
        let _ = push_cmd.output();
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
