use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum LogLevel {
    #[serde(alias = "debug", alias = "DEBUG")]
    Debug,
    #[serde(alias = "info", alias = "INFO")]
    Info,
    #[serde(alias = "success", alias = "SUCCESS")]
    Success,
    #[serde(alias = "warn", alias = "WARN", alias = "warning", alias = "Warning", alias = "WARNING")]
    Warn,
    #[serde(alias = "error", alias = "ERROR")]
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum LogCategory {
    #[serde(alias = "git", alias = "GIT")]
    Git,
    #[serde(alias = "account", alias = "ACCOUNT", alias = "auth", alias = "Auth", alias = "AUTH")]
    Account,
    #[serde(alias = "remote", alias = "REMOTE")]
    Remote,
    #[serde(alias = "signing", alias = "SIGNING")]
    Signing,
    #[serde(alias = "activity", alias = "ACTIVITY")]
    Activity,
    #[serde(alias = "repo", alias = "REPO")]
    Repo,
    #[serde(alias = "terminal", alias = "TERMINAL")]
    Terminal,
    #[serde(alias = "app", alias = "APP", alias = "system", alias = "System", alias = "SYSTEM")]
    App,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub at: String,
    pub level: LogLevel,
    pub category: LogCategory,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

impl LogEntry {
    pub fn new(
        level: LogLevel,
        category: LogCategory,
        message: impl Into<String>,
        repo_id: Option<String>,
        metadata: Option<serde_json::Value>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            at: chrono::Utc::now().to_rfc3339(),
            level,
            category,
            message: message.into(),
            repo_id,
            metadata,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LogFilter {
    pub categories: Option<Vec<LogCategory>>,
    pub levels: Option<Vec<LogLevel>>,
    pub repo_id: Option<String>,
    pub search: Option<String>,
    pub this_repo_only: Option<bool>,
}

impl LogFilter {
    pub fn matches(&self, entry: &LogEntry) -> bool {
        if let Some(ref cats) = self.categories {
            if !cats.is_empty() && !cats.contains(&entry.category) {
                return false;
            }
        }

        if let Some(ref lvls) = self.levels {
            if !lvls.is_empty() && !lvls.contains(&entry.level) {
                return false;
            }
        }

        if self.this_repo_only.unwrap_or(false) {
            if let Some(ref filter_repo) = self.repo_id {
                if entry.repo_id.as_deref() != Some(filter_repo.as_str()) {
                    return false;
                }
            }
        } else if let Some(ref filter_repo) = self.repo_id {
            // If repo_id is supplied without strict this_repo_only, include global events (None) or this repo
            if let Some(ref entry_repo) = entry.repo_id {
                if entry_repo != filter_repo {
                    return false;
                }
            }
        }

        if let Some(ref q) = self.search {
            let q_lower = q.to_lowercase();
            let matches_msg = entry.message.to_lowercase().contains(&q_lower);
            let matches_meta = entry
                .metadata
                .as_ref()
                .map(|m| m.to_string().to_lowercase().contains(&q_lower))
                .unwrap_or(false);

            if !matches_msg && !matches_meta {
                return false;
            }
        }

        true
    }
}
