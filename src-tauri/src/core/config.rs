use std::fs;
use std::path::{Path, PathBuf};

/// Reads an environment variable, falling back to parsing .env file in workspace or exe directories.
pub fn get_env_var(key: &str) -> Option<String> {
    // 1. Check OS process environment first
    if let Ok(val) = std::env::var(key) {
        let trimmed = val.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    // 2. Search for .env files in likely candidate locations
    let mut candidate_paths: Vec<PathBuf> = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        candidate_paths.push(cwd.join(".env"));
        if let Some(parent) = cwd.parent() {
            candidate_paths.push(parent.join(".env"));
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidate_paths.push(exe_dir.join(".env"));
            if let Some(p1) = exe_dir.parent() {
                candidate_paths.push(p1.join(".env"));
                if let Some(p2) = p1.parent() {
                    candidate_paths.push(p2.join(".env"));
                }
            }
        }
    }

    for env_path in candidate_paths {
        if env_path.exists() {
            if let Some(val) = parse_env_file_for_key(&env_path, key) {
                return Some(val);
            }
        }
    }

    None
}

fn parse_env_file_for_key(path: &Path, target_key: &str) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some((k, v)) = line.split_once('=') {
            let k = k.trim();
            if k == target_key {
                let mut v = v.trim();
                // Strip outer quotes if any
                if (v.starts_with('"') && v.ends_with('"'))
                    || (v.starts_with('\'') && v.ends_with('\''))
                {
                    if v.len() >= 2 {
                        v = &v[1..v.len() - 1];
                    }
                }
                let res = v.trim().to_string();
                if !res.is_empty() {
                    return Some(res);
                }
            }
        }
    }
    None
}
