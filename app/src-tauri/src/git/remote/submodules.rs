use crate::error::AppError;
use crate::git::command::silent_git_command;
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmoduleInfo {
    pub name: String,
    pub path: String,
    pub url: String,
    pub head_sha: String,
    pub is_dirty: bool,
    pub is_initialized: bool,
    pub branch: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Default)]
struct GitmodulesEntry {
    name: String,
    path: String,
    url: String,
    branch: Option<String>,
}

fn parse_gitmodules_file(repo_path: &str) -> HashMap<String, GitmodulesEntry> {
    let mut map = HashMap::new();
    let gitmodules_path = Path::new(repo_path).join(".gitmodules");
    if !gitmodules_path.exists() {
        return map;
    }

    if let Ok(content) = fs::read_to_string(&gitmodules_path) {
        let mut current_name = String::new();
        let mut current_path = String::new();
        let mut current_url = String::new();
        let mut current_branch: Option<String> = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("[submodule \"") && trimmed.ends_with("\"]") {
                if !current_path.is_empty() {
                    let norm = current_path.replace('\\', "/").trim_start_matches("./").to_string();
                    map.insert(
                        norm.clone(),
                        GitmodulesEntry {
                            name: if current_name.is_empty() { norm } else { current_name },
                            path: current_path,
                            url: current_url,
                            branch: current_branch,
                        },
                    );
                }
                current_name = trimmed
                    .trim_start_matches("[submodule \"")
                    .trim_end_matches("\"]")
                    .to_string();
                current_path = String::new();
                current_url = String::new();
                current_branch = None;
            } else if let Some((k, v)) = trimmed.split_once('=') {
                let k = k.trim();
                let v = v.trim().trim_matches('"').trim_matches('\'').to_string();
                match k {
                    "path" => current_path = v,
                    "url" => current_url = v,
                    "branch" => current_branch = if v.is_empty() { None } else { Some(v) },
                    _ => {}
                }
            }
        }

        if !current_path.is_empty() {
            let norm = current_path.replace('\\', "/").trim_start_matches("./").to_string();
            map.insert(
                norm.clone(),
                GitmodulesEntry {
                    name: if current_name.is_empty() { norm } else { current_name },
                    path: current_path,
                    url: current_url,
                    branch: current_branch,
                },
            );
        }
    }

    map
}

pub fn list_submodules(repo_path: &str) -> Result<Vec<SubmoduleInfo>, AppError> {
    let gitmodules_map = parse_gitmodules_file(repo_path);
    let mut result_map: HashMap<String, SubmoduleInfo> = HashMap::new();

    // 1. Query git submodule status command
    let output = silent_git_command()
        .arg("submodule")
        .arg("status")
        .current_dir(repo_path)
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let status_char = parts[0].chars().next().unwrap_or(' ');
                    let sha = parts[0].trim_start_matches(['-', '+', 'U']).to_string();
                    let path = parts[1].to_string();
                    let norm_path = path.replace('\\', "/").trim_start_matches("./").to_string();

                    let gitmodule_meta = gitmodules_map.get(&norm_path);
                    let name = gitmodule_meta
                        .map(|m| m.name.clone())
                        .unwrap_or_else(|| norm_path.split('/').next_back().unwrap_or(&norm_path).to_string());
                    let url = gitmodule_meta.map(|m| m.url.clone()).unwrap_or_default();
                    let branch = gitmodule_meta.and_then(|m| m.branch.clone());

                    let is_dirty = status_char == '+';
                    let is_initialized = status_char != '-';

                    result_map.insert(
                        norm_path.clone(),
                        SubmoduleInfo {
                            name,
                            path: norm_path,
                            url,
                            head_sha: sha,
                            is_dirty,
                            is_initialized,
                            branch,
                        },
                    );
                }
            }
        }
    }

    // 2. Query libgit2 repository submodules for any unlisted entries
    if let Ok(repo) = Repository::open(repo_path) {
        if let Ok(mut submodules) = repo.submodules() {
            for sub in submodules.iter_mut() {
                let sub_path = sub.path().to_string_lossy().replace('\\', "/").trim_start_matches("./").to_string();
                let sub_name = sub.name().unwrap_or(&sub_path).to_string();
                let sub_url = sub.url().map(|s| s.to_string()).unwrap_or_default();
                let head_sha = sub.head_id().or_else(|| sub.workdir_id()).or_else(|| sub.index_id())
                    .map(|o| o.to_string())
                    .unwrap_or_default();

                let sub_full_path = Path::new(repo_path).join(&sub_path);
                let is_initialized = sub_full_path.exists() && sub_full_path.join(".git").exists();

                result_map
                    .entry(sub_path.clone())
                    .and_modify(|existing| {
                        if existing.url.is_empty() && !sub_url.is_empty() {
                            existing.url = sub_url.clone();
                        }
                        if existing.head_sha.is_empty() && !head_sha.is_empty() {
                            existing.head_sha = head_sha.clone();
                        }
                    })
                    .or_insert_with(|| {
                        let gitmodule_meta = gitmodules_map.get(&sub_path);
                        SubmoduleInfo {
                            name: sub_name,
                            path: sub_path,
                            url: if sub_url.is_empty() {
                                gitmodule_meta.map(|m| m.url.clone()).unwrap_or_default()
                            } else {
                                sub_url
                            },
                            head_sha,
                            is_dirty: false,
                            is_initialized,
                            branch: gitmodule_meta.and_then(|m| m.branch.clone()),
                        }
                    });
            }
        }
    }

    // 3. Ensure any .gitmodules entries not yet initialized are included
    for (norm_path, entry) in gitmodules_map {
        result_map.entry(norm_path.clone()).or_insert_with(|| SubmoduleInfo {
            name: entry.name,
            path: norm_path,
            url: entry.url,
            head_sha: String::new(),
            is_dirty: false,
            is_initialized: false,
            branch: entry.branch,
        });
    }

    let mut list: Vec<SubmoduleInfo> = result_map.into_values().collect();
    list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(list)
}

pub fn add_submodule(
    repo_path: &str,
    url: &str,
    path: Option<&str>,
    branch: Option<&str>,
) -> Result<SubmoduleInfo, AppError> {
    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err(AppError::Validation("Submodule repository URL cannot be empty".to_string()));
    }

    let mut cmd = silent_git_command();
    cmd.arg("submodule").arg("add");

    if let Some(b) = branch {
        let trimmed_branch = b.trim();
        if !trimmed_branch.is_empty() {
            cmd.arg("-b").arg(trimmed_branch);
        }
    }

    cmd.arg("--").arg(clean_url);

    if let Some(p) = path {
        let trimmed_path = p.trim().trim_start_matches("./");
        if !trimmed_path.is_empty() {
            cmd.arg(trimmed_path);
        }
    }

    let output = cmd.current_dir(repo_path).output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let err = if !stderr.trim().is_empty() { stderr } else { stdout };
        return Err(AppError::Git(format!("Failed to add submodule: {}", err.trim())));
    }

    // Update & initialize added submodule
    let _ = silent_git_command()
        .arg("submodule")
        .arg("update")
        .arg("--init")
        .arg("--recursive")
        .current_dir(repo_path)
        .output();

    let list = list_submodules(repo_path)?;
    let target_path = path.map(|p| p.trim().replace('\\', "/")).unwrap_or_default();
    let created = list
        .into_iter()
        .find(|s| s.url == clean_url || (!target_path.is_empty() && s.path == target_path))
        .unwrap_or_else(|| SubmoduleInfo {
            name: clean_url.split('/').next_back().unwrap_or("submodule").replace(".git", ""),
            path: target_path,
            url: clean_url.to_string(),
            head_sha: String::new(),
            is_dirty: false,
            is_initialized: true,
            branch: branch.map(|b| b.to_string()),
        });

    Ok(created)
}

pub fn remove_submodule(repo_path: &str, path: &str) -> Result<(), AppError> {
    let clean_path = path.trim().replace('\\', "/").trim_start_matches("./").to_string();
    if clean_path.is_empty() {
        return Err(AppError::Validation("Submodule path cannot be empty".to_string()));
    }

    // 1. Deinit submodule
    let _ = silent_git_command()
        .arg("submodule")
        .arg("deinit")
        .arg("-f")
        .arg("--")
        .arg(&clean_path)
        .current_dir(repo_path)
        .output();

    // 2. Remove from git index & working tree
    let rm_output = silent_git_command()
        .arg("rm")
        .arg("-f")
        .arg("--")
        .arg(&clean_path)
        .current_dir(repo_path)
        .output()?;

    if !rm_output.status.success() {
        let stderr = String::from_utf8_lossy(&rm_output.stderr);
        return Err(AppError::Git(format!(
            "Failed to remove submodule from Git: {}",
            stderr.trim()
        )));
    }

    // 3. Remove .git/modules directory if present
    let git_modules_dir = Path::new(repo_path).join(".git").join("modules").join(&clean_path);
    if git_modules_dir.exists() {
        let _ = fs::remove_dir_all(&git_modules_dir);
    }

    Ok(())
}

pub fn update_single_submodule(
    repo_path: &str,
    path: &str,
    remote: Option<bool>,
) -> Result<(), AppError> {
    let clean_path = path.trim().replace('\\', "/").trim_start_matches("./").to_string();
    let mut cmd = silent_git_command();
    cmd.arg("submodule").arg("update").arg("--init").arg("--recursive");

    if remote.unwrap_or(false) {
        cmd.arg("--remote");
    }

    cmd.arg("--").arg(&clean_path);

    let output = cmd.current_dir(repo_path).output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to update submodule '{}': {}",
            clean_path,
            stderr.trim()
        )));
    }

    Ok(())
}

pub fn init_submodules(repo_path: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("submodule")
        .arg("init")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to init submodules: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn update_submodules(repo_path: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("submodule")
        .arg("update")
        .arg("--init")
        .arg("--recursive")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to update submodules: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn sync_submodules(repo_path: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("submodule")
        .arg("sync")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to sync submodules: {}",
            stderr.trim()
        )));
    }
    Ok(())
}
