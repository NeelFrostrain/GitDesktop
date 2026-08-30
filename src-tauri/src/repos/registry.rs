use crate::error::AppError;
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoEntry {
    pub id: String,
    pub path: String,
    pub name: String,
    pub last_opened_at: i64,
    pub pinned: bool,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct RepoRegistry {
    repos: Vec<RepoEntry>,
}

fn get_registry_file() -> PathBuf {
    let path = crate::domain::git_runtime::get_app_data_dir();
    let _ = fs::create_dir_all(&path);
    path.join("known_repos.json")
}

fn read_registry() -> RepoRegistry {
    let file = get_registry_file();
    if let Ok(content) = fs::read_to_string(file) {
        if let Ok(reg) = serde_json::from_str::<RepoRegistry>(&content) {
            return reg;
        }
    }
    RepoRegistry::default()
}

fn write_registry(reg: &RepoRegistry) {
    let file = get_registry_file();
    if let Ok(content) = serde_json::to_string_pretty(reg) {
        let _ = fs::write(file, content);
    }
}

pub fn list_known_repos() -> Vec<RepoEntry> {
    let mut reg = read_registry();

    // Auto-discover recent repos from legacy localStorage migration if empty
    if reg.repos.is_empty() {
        if let Ok(current_dir) = std::env::current_dir() {
            if Repository::open(&current_dir).is_ok() {
                let p = current_dir.to_string_lossy().to_string();
                let name = current_dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("repo")
                    .to_string();
                reg.repos.push(RepoEntry {
                    id: p.clone(),
                    path: p,
                    name,
                    last_opened_at: chrono::Utc::now().timestamp(),
                    pinned: false,
                });
                write_registry(&reg);
            }
        }
    }

    // Sort pinned first, then by last_opened_at descending
    reg.repos.sort_by(|a, b| {
        b.pinned
            .cmp(&a.pinned)
            .then_with(|| b.last_opened_at.cmp(&a.last_opened_at))
    });

    reg.repos
}

pub fn add_repo(path: &str) -> Result<RepoEntry, AppError> {
    let clean_path = path.trim();
    let repo_path = Path::new(clean_path);

    // Validate that it is a valid git repository
    if !repo_path.exists() {
        return Err(AppError::Validation(format!(
            "Directory '{}' does not exist",
            clean_path
        )));
    }

    let _repo = Repository::open(repo_path).map_err(|e| {
        AppError::Validation(format!(
            "'{}' is not a valid Git repository: {}",
            clean_path, e
        ))
    })?;

    let name = repo_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("repo")
        .to_string();

    let mut reg = read_registry();
    let normalized = clean_path.replace('\\', "/");
    let now = chrono::Utc::now().timestamp();

    if let Some(existing) = reg
        .repos
        .iter_mut()
        .find(|r| r.path.replace('\\', "/") == normalized)
    {
        existing.last_opened_at = now;
        let res = existing.clone();
        write_registry(&reg);
        return Ok(res);
    }

    let entry = RepoEntry {
        id: clean_path.to_string(),
        path: clean_path.to_string(),
        name,
        last_opened_at: now,
        pinned: false,
    };

    reg.repos.push(entry.clone());
    write_registry(&reg);

    Ok(entry)
}

pub fn remove_repo(id: &str) -> Result<(), AppError> {
    let mut reg = read_registry();
    let normalized = id.replace('\\', "/").to_lowercase();
    reg.repos.retain(|r| {
        let r_id = r.id.replace('\\', "/").to_lowercase();
        let r_path = r.path.replace('\\', "/").to_lowercase();
        r_id != normalized && r_path != normalized
    });
    write_registry(&reg);
    Ok(())
}

pub fn pin_repo(id: &str, pinned: bool) -> Result<(), AppError> {
    let mut reg = read_registry();
    let normalized = id.replace('\\', "/");
    if let Some(entry) = reg
        .repos
        .iter_mut()
        .find(|r| r.id == id || r.path.replace('\\', "/") == normalized)
    {
        entry.pinned = pinned;
        write_registry(&reg);
    }
    Ok(())
}

pub fn touch_repo_opened(path: &str) {
    let _ = add_repo(path);
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoValidationResult {
    pub path: String,
    pub is_valid: bool,
    pub folder_exists: bool,
    pub git_exists: bool,
    pub error_type: Option<String>,
    pub error_message: Option<String>,
}

pub fn validate_repo_path(path: &str) -> RepoValidationResult {
    let clean = path.trim();
    let p = Path::new(clean);

    if !p.exists() {
        return RepoValidationResult {
            path: clean.to_string(),
            is_valid: false,
            folder_exists: false,
            git_exists: false,
            error_type: Some("folder_missing".to_string()),
            error_message: Some(format!("Directory '{}' does not exist on disk", clean)),
        };
    }

    let git_dir = p.join(".git");
    let git_exists = git_dir.exists();

    match Repository::open(p) {
        Ok(_) => RepoValidationResult {
            path: clean.to_string(),
            is_valid: true,
            folder_exists: true,
            git_exists: true,
            error_type: None,
            error_message: None,
        },
        Err(e) => {
            let (err_type, msg) = if !git_exists {
                (
                    "not_a_git_repo",
                    format!("Directory '{}' is not a Git repository (.git directory is missing)", clean),
                )
            } else {
                (
                    "corrupt_git_repo",
                    format!("Invalid or corrupted Git repository at '{}': {}", clean, e),
                )
            };

            RepoValidationResult {
                path: clean.to_string(),
                is_valid: false,
                folder_exists: true,
                git_exists,
                error_type: Some(err_type.to_string()),
                error_message: Some(msg),
            }
        }
    }
}

pub fn relocate_repo(old_path: &str, new_path: &str) -> Result<RepoEntry, AppError> {
    let clean_new = new_path.trim();
    let new_repo_path = Path::new(clean_new);

    if !new_repo_path.exists() {
        return Err(AppError::Validation(format!(
            "New directory '{}' does not exist",
            clean_new
        )));
    }

    let _repo = Repository::open(new_repo_path).map_err(|e| {
        AppError::Validation(format!(
            "'{}' is not a valid Git repository: {}",
            clean_new, e
        ))
    })?;

    let name = new_repo_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("repo")
        .to_string();

    let mut reg = read_registry();
    let old_normalized = old_path.replace('\\', "/").to_lowercase();
    let new_normalized = clean_new.replace('\\', "/");
    let now = chrono::Utc::now().timestamp();

    let mut pinned = false;

    // Remove old path entry if it exists
    if let Some(idx) = reg
        .repos
        .iter()
        .position(|r| r.path.replace('\\', "/").to_lowercase() == old_normalized || r.id.replace('\\', "/").to_lowercase() == old_normalized)
    {
        pinned = reg.repos[idx].pinned;
        reg.repos.remove(idx);
    }

    // Insert or update new path entry
    let entry = if let Some(existing) = reg
        .repos
        .iter_mut()
        .find(|r| r.path.replace('\\', "/") == new_normalized)
    {
        existing.last_opened_at = now;
        existing.pinned = existing.pinned || pinned;
        existing.clone()
    } else {
        let new_entry = RepoEntry {
            id: clean_new.to_string(),
            path: clean_new.to_string(),
            name,
            last_opened_at: now,
            pinned,
        };
        reg.repos.push(new_entry.clone());
        new_entry
    };

    write_registry(&reg);
    Ok(entry)
}

pub fn remove_invalid_repos() -> Result<Vec<String>, AppError> {
    let mut reg = read_registry();
    let mut removed = Vec::new();

    reg.repos.retain(|r| {
        let p = Path::new(&r.path);
        let is_valid = p.exists() && Repository::open(p).is_ok();
        if !is_valid {
            removed.push(r.path.clone());
            false
        } else {
            true
        }
    });

    write_registry(&reg);
    Ok(removed)
}
