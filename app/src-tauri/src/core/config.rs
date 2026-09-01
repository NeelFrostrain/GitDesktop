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

    // 2. Deep search for .env files in workspace or exe directories (up to 5 levels)
    let mut candidate_paths: Vec<PathBuf> = Vec::new();

    if let Ok(mut cwd) = std::env::current_dir() {
        for _ in 0..5 {
            candidate_paths.push(cwd.join(".env"));
            candidate_paths.push(cwd.join("app").join(".env"));
            if !cwd.pop() {
                break;
            }
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(mut exe_dir) = exe_path.parent().map(|p| p.to_path_buf()) {
            for _ in 0..5 {
                candidate_paths.push(exe_dir.join(".env"));
                candidate_paths.push(exe_dir.join("app").join(".env"));
                if !exe_dir.pop() {
                    break;
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

    // 3. Built-in defaults for production deployment (when .env is absent on end-user machines)
    match key {
        "VITE_GITHUB_CLIENT_ID" => Some("Ov23lip7lnwBjoVPBlzU".to_string()),
        "VITE_GITHUB_CLIENT_SECRET" => Some("51b8724dd6644767fb1afa00890d1078e588b0f6".to_string()),
        "VITE_GITHUB_DEFAULT_INSTANCE_URL" => Some("https://github.com".to_string()),
        "VITE_GITHUB_REDIRECT_URI" => Some("http://127.0.0.1:8585/oauth/callback".to_string()),
        "VITE_GITHUB_SCOPES" => Some("repo,read:user,user:email".to_string()),

        "VITE_GITLAB_CLIENT_ID" => Some("e1e90ccf895458c58b7738412ac7f2ff830b89fbeab9cd7405d6e6a75005202d".to_string()),
        "VITE_GITLAB_CLIENT_SECRET" => Some("gloas-98224a41bdac5c7dc1c80196cb2c54cd5b1555f5c7699f6f677599fa8cfe8696".to_string()),
        "VITE_GITLAB_DEFAULT_INSTANCE_URL" => Some("https://gitlab.com".to_string()),
        "VITE_GITLAB_REDIRECT_URI" => Some("http://127.0.0.1:8585/oauth/callback".to_string()),
        "VITE_GITLAB_SCOPES" => Some("api,read_user,openid,profile,email,write_repository,read_repository".to_string()),

        "VITE_BITBUCKET_CLIENT_ID" => Some("05gvJ8RH8VjBrhncQ2lo3fJLO9sxp6dL".to_string()),
        "VITE_BITBUCKET_CLIENT_SECRET" => Some("ATOARGl9fQyacCA9STFNegKBRmR_rYHjf0lYQT-IT8e6EjJhP1C3NQX1eLF5j5CJGTqoD2314137".to_string()),
        "VITE_BITBUCKET_DEFAULT_INSTANCE_URL" => Some("https://bitbucket.org".to_string()),
        "VITE_BITBUCKET_REDIRECT_URI" => Some("http://127.0.0.1:8585/oauth/callback".to_string()),
        "VITE_BITBUCKET_SCOPES" => Some("account,repository,pullrequest".to_string()),

        "VITE_OAUTH_LOOPBACK_PORT" => Some("8585".to_string()),
        "VITE_OAUTH_REDIRECT_SCHEME" => Some("git-desktop://oauth".to_string()),

        _ => None,
    }
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
                if ((v.starts_with('"') && v.ends_with('"'))
                    || (v.starts_with('\'') && v.ends_with('\'')))
                    && v.len() >= 2
                {
                    v = &v[1..v.len() - 1];
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
