use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LogLevel {
    #[serde(rename = "Debug")]
    Debug,
    #[serde(rename = "Info")]
    Info,
    #[serde(rename = "Success")]
    Success,
    #[serde(rename = "Warn")]
    Warn,
    #[serde(rename = "Error")]
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LogCategory {
    #[serde(rename = "Git")]
    Git,
    #[serde(rename = "Account")]
    Account,
    #[serde(rename = "Remote")]
    Remote,
    #[serde(rename = "Signing")]
    Signing,
    #[serde(rename = "Activity")]
    Activity,
    #[serde(rename = "Repo")]
    Repo,
    #[serde(rename = "Terminal")]
    Terminal,
    #[serde(rename = "App")]
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
