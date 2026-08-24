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
    let output = silent_git_command()
        .arg("tag")
        .arg("-l")
        .arg("--format=%(refname:short)|%(objectname:short)|%(contents:subject)|%(taggername)")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to list tags: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut tags = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if !parts.is_empty() && !parts[0].trim().is_empty() {
            let name = parts[0].to_string();
            let sha = parts.get(1).unwrap_or(&"").to_string();
            let msg = parts
                .get(2)
                .filter(|s| !s.trim().is_empty())
                .map(|s| s.to_string());
            let tagger = parts
                .get(3)
                .filter(|s| !s.trim().is_empty())
                .map(|s| s.to_string());
            let is_annotated = msg.is_some() || tagger.is_some();

            tags.push(TagInfo {
                name,
                sha,
                message: msg,
                is_annotated,
                tagger_name: tagger,
            });
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
    use crate::git::remote::{apply_git_auth_args_pub, get_git_auth_info};

    let auth_info = get_git_auth_info(repo_path);
    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    apply_git_auth_args_pub(&mut cmd, &auth_info);

    cmd.arg("push").arg("origin").arg("--tags");

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to push tags: {}",
            stderr.trim()
        )));
    }
    Ok(())
}
