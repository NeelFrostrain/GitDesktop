pub mod autocomplete;
pub mod history;
pub mod log_store;
pub mod pty;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalSessionInfo {
    pub repo_id: String,
    pub session_id: String,
    pub is_alive: bool,
    pub pid: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub cmd: String,
    pub at: String,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogSessionSummary {
    pub session_id: String,
    pub repo_id: String,
    pub date: String,
    pub command_count: usize,
    pub size_bytes: u64,
    pub duration_secs: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AutocompleteSuggestion {
    pub text: String,
    pub value: String,
    pub description: Option<String>,
    pub kind: String, // "branch" | "remote" | "file" | "stash" | "tag" | "command" | "flag"
}

/// Generates a filesystem-safe identifier for a given repository ID/path.
pub fn safe_repo_id(repo_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(repo_id.as_bytes());
    let hash = format!("{:x}", hasher.finalize());

    let base_name: String = repo_id
        .replace('\\', "/")
        .trim_end_matches('/')
        .split('/')
        .last()
        .unwrap_or("repo")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect();

    if base_name.is_empty() {
        hash[..16].to_string()
    } else {
        format!("{}_{}", base_name, &hash[..12])
    }
}

pub fn get_terminal_base_dir() -> PathBuf {
    let mut path = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        PathBuf::from(home)
    } else {
        PathBuf::from(".")
    };
    path.push("gitlab-desktop");
    path
}

pub fn get_history_dir() -> PathBuf {
    let mut path = get_terminal_base_dir();
    path.push("terminal-history");
    let _ = std::fs::create_dir_all(&path);
    path
}

pub fn get_logs_dir() -> PathBuf {
    let mut path = get_terminal_base_dir();
    path.push("terminal-logs");
    let _ = std::fs::create_dir_all(&path);
    path
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_repo_id() {
        let id1 = safe_repo_id("E:\\Projects\\gitlab-desktop");
        assert!(id1.starts_with("gitlab-desktop_"));
        assert!(!id1.contains(':'));
        assert!(!id1.contains('\\'));
        assert!(!id1.contains('/'));

        let id2 = safe_repo_id("/home/user/my-repo");
        assert!(id2.starts_with("my-repo_"));

        // Different repos produce distinct IDs
        assert_ne!(safe_repo_id("repoA"), safe_repo_id("repoB"));
    }

    #[test]
    fn test_history_append_and_get() {
        let test_repo = "test_history_repo_abc";
        let _ = history::clear_history(test_repo);

        assert!(history::append_history(test_repo, "git status", Some(0)).is_ok());
        assert!(history::append_history(test_repo, "git checkout main", Some(0)).is_ok());
        assert!(history::append_history(test_repo, "git push origin main", Some(1)).is_ok());

        let entries = history::get_history(test_repo, 10, 0).unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].cmd, "git status");
        assert_eq!(entries[1].cmd, "git checkout main");
        assert_eq!(entries[2].cmd, "git push origin main");
        assert_eq!(entries[2].exit_code, Some(1));

        let _ = history::clear_history(test_repo);
        let entries_after_clear = history::get_history(test_repo, 10, 0).unwrap();
        assert_eq!(entries_after_clear.len(), 0);
    }

    #[test]
    fn test_log_store_session() {
        let test_repo = "test_log_repo_xyz";
        let session_id = "test_sess_001";

        log_store::append_to_session_log(test_repo, session_id, "$ git status\nOn branch main\n");
        let content = log_store::get_log_session(test_repo, session_id).unwrap();
        assert!(content.contains("=== GIT DESKTOP TERMINAL SESSION ==="));
        assert!(content.contains("$ git status"));

        let sessions = log_store::list_log_sessions(test_repo).unwrap();
        assert!(!sessions.is_empty());
        assert_eq!(sessions[0].session_id, session_id);
    }
}
