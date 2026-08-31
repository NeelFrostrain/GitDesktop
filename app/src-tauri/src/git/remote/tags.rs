use crate::error::AppError;
use crate::git::command::silent_git_command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagInfo {
    pub name: String,
    pub sha: String,
    pub message: Option<String>,
    pub is_annotated: bool,
    pub tagger_name: Option<String>,
}

pub fn list_tags(repo_path: &str) -> Result<Vec<TagInfo>, AppError> {
    let repo = git2::Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let mut tags = Vec::new();
    let tag_names = repo.tag_names(None).map_err(|e| AppError::Git(e.to_string()))?;

    for name in tag_names.iter().flatten() {
        if let Ok(obj) = repo.revparse_single(name) {
                let sha = obj.id().to_string();
                let short_sha = if sha.len() >= 7 { sha[..7].to_string() } else { sha.clone() };

                if let Some(tag_obj) = obj.as_tag() {
                    let message = tag_obj.message().map(|m| m.trim().to_string());
                    let tagger_name = tag_obj.tagger().and_then(|t| t.name().map(|s| s.to_string()));
                    tags.push(TagInfo {
                        name: name.to_string(),
                        sha: short_sha,
                        message,
                        is_annotated: true,
                        tagger_name,
                    });
                } else {
                    tags.push(TagInfo {
                        name: name.to_string(),
                        sha: short_sha,
                        message: None,
                        is_annotated: false,
                        tagger_name: None,
                    });
                }
            }
        }

    Ok(tags)
}

pub fn create_tag(
    repo_path: &str,
    name: &str,
    message: Option<&str>,
    target_sha: Option<&str>,
) -> Result<(), AppError> {
    let mut cmd = silent_git_command();
    cmd.arg("tag");

    if let Some(msg) = message {
        if !msg.trim().is_empty() {
            cmd.arg("-a").arg("-m").arg(msg.trim());
        }
    }

    cmd.arg(name.trim());

    if let Some(sha) = target_sha {
        if !sha.trim().is_empty() {
            cmd.arg(sha.trim());
        }
    }

    cmd.current_dir(repo_path);
    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to create tag: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

pub fn delete_tag(repo_path: &str, name: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("tag")
        .arg("-d")
        .arg(name)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to delete tag: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn push_tags(repo_path: &str) -> Result<(), AppError> {
    push_tags_to_remote(repo_path, None)
}

pub fn fetch_tags_from_remote(repo_path: &str, remote: Option<&str>) -> Result<(), AppError> {
    use crate::git::remote::{apply_git_auth_args_pub, get_git_auth_info};

    let auth_info = get_git_auth_info(repo_path);
    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    apply_git_auth_args_pub(&mut cmd, &auth_info);

    let remote_name = remote.unwrap_or("origin");
    cmd.arg("fetch").arg(remote_name).arg("--tags").arg("--force");

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to fetch tags from '{}': {}",
            remote_name,
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn push_tags_to_remote(repo_path: &str, remote: Option<&str>) -> Result<(), AppError> {
    use crate::git::remote::{apply_git_auth_args_pub, get_git_auth_info};

    let auth_info = get_git_auth_info(repo_path);
    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    apply_git_auth_args_pub(&mut cmd, &auth_info);

    let remote_name = remote.unwrap_or("origin");
    cmd.arg("push").arg(remote_name).arg("--tags");

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to push tags to '{}': {}",
            remote_name,
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn push_specific_tag(
    repo_path: &str,
    remote: Option<&str>,
    tag_name: &str,
) -> Result<(), AppError> {
    use crate::git::remote::{apply_git_auth_args_pub, get_git_auth_info};

    let auth_info = get_git_auth_info(repo_path);
    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    apply_git_auth_args_pub(&mut cmd, &auth_info);

    let remote_name = remote.unwrap_or("origin");
    let tag = tag_name.trim();
    let refspec = format!("refs/tags/{}:refs/tags/{}", tag, tag);
    cmd.arg("push").arg(remote_name).arg("--force").arg(&refspec);

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to push tag '{}' to '{}': {}",
            tag,
            remote_name,
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn delete_remote_tag(
    repo_path: &str,
    remote: Option<&str>,
    tag_name: &str,
) -> Result<(), AppError> {
    use crate::git::remote::{apply_git_auth_args_pub, get_git_auth_info};

    let auth_info = get_git_auth_info(repo_path);
    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    apply_git_auth_args_pub(&mut cmd, &auth_info);

    let remote_name = remote.unwrap_or("origin");
    cmd.arg("push").arg(remote_name).arg("--delete").arg(tag_name);

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to delete remote tag '{}' on '{}': {}",
            tag_name,
            remote_name,
            stderr.trim()
        )));
    }
    Ok(())
}
