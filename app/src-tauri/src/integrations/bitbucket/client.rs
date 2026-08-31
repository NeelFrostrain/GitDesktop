use crate::auth::github::PullRequestComment;
use crate::auth::gitlab::{MergeRequest, MergeRequestAuthor};
use crate::error::AppError;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde_json::Value;

const BITBUCKET_API_URL: &str = "https://api.bitbucket.org/2.0";

pub struct BitbucketClient {
    client: reqwest::Client,
    _token: Option<String>,
}

impl BitbucketClient {
    pub fn new(token: Option<&str>) -> Result<Self, AppError> {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("GitDesktop/0.1.0"),
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("application/json"),
        );

        if let Some(t) = token {
            if !t.trim().is_empty() {
                let auth_header = if t.starts_with("Bearer ") || t.starts_with("Basic ") {
                    t.to_string()
                } else {
                    format!("Bearer {}", t.trim())
                };
                if let Ok(val) = HeaderValue::from_str(&auth_header) {
                    headers.insert(AUTHORIZATION, val);
                }
            }
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| AppError::Network(e.to_string()))?;

        Ok(Self {
            client,
            _token: token.map(|t| t.to_string()),
        })
    }

    /// Parses Bitbucket PR json entries into unified `MergeRequest` objects.
    fn parse_bitbucket_prs(&self, pr_array: &[Value], repo_full_name: Option<&str>) -> Vec<MergeRequest> {
        let mut results = Vec::new();
        for item in pr_array {
            let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
            let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let description = item
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let state = item.get("state").and_then(|v| v.as_str()).unwrap_or("OPEN").to_lowercase();
            let html_url = item
                .get("links")
                .and_then(|l| l.get("html"))
                .and_then(|h| h.get("href"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let created_at = item
                .get("created_on")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let source_branch = item
                .get("source")
                .and_then(|s| s.get("branch"))
                .and_then(|b| b.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let target_branch = item
                .get("destination")
                .and_then(|d| d.get("branch"))
                .and_then(|b| b.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("main")
                .to_string();

            let author_obj = item.get("author").unwrap_or(&Value::Null);
            let author_name = author_obj
                .get("display_name")
                .or_else(|| author_obj.get("nickname"))
                .and_then(|v| v.as_str())
                .unwrap_or("Bitbucket User")
                .to_string();
            let author_username = author_obj
                .get("nickname")
                .or_else(|| author_obj.get("username"))
                .and_then(|v| v.as_str())
                .unwrap_or(&author_name)
                .to_string();
            let author_avatar = author_obj
                .get("links")
                .and_then(|l| l.get("avatar"))
                .and_then(|a| a.get("href"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let author = MergeRequestAuthor {
                name: Some(author_name),
                username: Some(author_username),
                avatar_url: author_avatar,
            };

            results.push(MergeRequest {
                id,
                iid: id,
                title,
                description: Some(description),
                state,
                source_branch,
                target_branch,
                web_url: html_url,
                created_at,
                author: Some(author),
                assignees: None,
                reviewers: None,
                labels: None,
                milestone: None,
                is_draft: Some(false),
                repo_full_name: repo_full_name.map(|s| s.to_string()),
                total_count: None,
            });
        }
        results
    }

    /// Fetches open PRs for a Bitbucket repository `workspace/repo_slug`.
    pub async fn get_open_pull_requests(&self, workspace_repo: &str) -> Result<Vec<MergeRequest>, AppError> {
        let clean = workspace_repo.trim_matches('/').trim_end_matches(".git").trim_matches('/');
        let url = format!("{}/repositories/{}/pullrequests?q=state=%22OPEN%22&pagelen=50", BITBUCKET_API_URL, clean);

        let resp = self.client.get(&url).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Bitbucket API Error ({}): {}",
                status, err_text
            )));
        }

        let json = resp.json::<Value>().await.map_err(|e| AppError::Unknown(e.to_string()))?;
        let values = json.get("values").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        Ok(self.parse_bitbucket_prs(&values, Some(clean)))
    }

    /// Creates a new Pull Request on Bitbucket.
    pub async fn create_pull_request(
        &self,
        workspace_repo: &str,
        source_branch: &str,
        target_branch: &str,
        title: &str,
        description: Option<&str>,
    ) -> Result<MergeRequest, AppError> {
        let clean = workspace_repo.trim_matches('/').trim_end_matches(".git").trim_matches('/');
        let url = format!("{}/repositories/{}/pullrequests", BITBUCKET_API_URL, clean);

        let payload = serde_json::json!({
            "title": title,
            "description": description.unwrap_or(""),
            "source": {
                "branch": { "name": source_branch }
            },
            "destination": {
                "branch": { "name": target_branch }
            }
        });

        let resp = self.client.post(&url).json(&payload).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to create Bitbucket PR ({}): {}",
                status, err_text
            )));
        }

        let pr_json = resp.json::<Value>().await.map_err(|e| AppError::Unknown(e.to_string()))?;
        let prs = self.parse_bitbucket_prs(&[pr_json], Some(clean));
        prs.into_iter().next().ok_or_else(|| AppError::Unknown("Failed to parse created PR response".to_string()))
    }

    /// Merges an existing Pull Request on Bitbucket.
    pub async fn merge_pull_request(
        &self,
        workspace_repo: &str,
        pr_id: u64,
        commit_message: Option<&str>,
        merge_strategy: Option<&str>,
        close_source_branch: Option<bool>,
    ) -> Result<bool, AppError> {
        let clean = workspace_repo.trim_matches('/').trim_end_matches(".git").trim_matches('/');
        let url = format!("{}/repositories/{}/pullrequests/{}/merge", BITBUCKET_API_URL, clean, pr_id);

        let mut payload = serde_json::json!({});
        if let Some(msg) = commit_message {
            payload["message"] = serde_json::json!(msg);
        }
        if let Some(strat) = merge_strategy {
            let bb_strat = match strat {
                "squash" => "squash",
                "rebase" => "fast_forward",
                _ => "merge_commit",
            };
            payload["merge_strategy"] = serde_json::json!(bb_strat);
        }
        if let Some(close) = close_source_branch {
            payload["close_source_branch"] = serde_json::json!(close);
        }

        let resp = self.client.post(&url).json(&payload).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to merge Bitbucket PR ({}): {}",
                status, err_text
            )));
        }

        Ok(true)
    }

    /// Fetches comments for a Bitbucket PR.
    pub async fn get_comments(&self, workspace_repo: &str, pr_id: u64) -> Result<Vec<PullRequestComment>, AppError> {
        let clean = workspace_repo.trim_matches('/').trim_end_matches(".git").trim_matches('/');
        let url = format!("{}/repositories/{}/pullrequests/{}/comments", BITBUCKET_API_URL, clean, pr_id);

        let resp = self.client.get(&url).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            return Ok(Vec::new());
        }

        let json = resp.json::<Value>().await.map_err(|e| AppError::Unknown(e.to_string()))?;
        let values = json.get("values").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        let mut comments = Vec::new();
        for item in values {
            let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
            let body = item
                .get("content")
                .and_then(|c| c.get("raw"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let created_at = item.get("created_on").and_then(|v| v.as_str()).unwrap_or("").to_string();

            let user_obj = item.get("user").unwrap_or(&Value::Null);
            let user_name = user_obj.get("display_name").and_then(|v| v.as_str()).unwrap_or("User").to_string();
            let user_avatar = user_obj
                .get("links")
                .and_then(|l| l.get("avatar"))
                .and_then(|a| a.get("href"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            comments.push(PullRequestComment {
                id,
                author_name: user_name.clone(),
                author_username: user_name,
                author_avatar: user_avatar,
                body,
                created_at,
            });
        }

        Ok(comments)
    }

    /// Adds a comment to a Bitbucket PR.
    pub async fn add_comment(&self, workspace_repo: &str, pr_id: u64, content: &str) -> Result<PullRequestComment, AppError> {
        let clean = workspace_repo.trim_matches('/').trim_end_matches(".git").trim_matches('/');
        let url = format!("{}/repositories/{}/pullrequests/{}/comments", BITBUCKET_API_URL, clean, pr_id);

        let payload = serde_json::json!({
            "content": { "raw": content }
        });

        let resp = self.client.post(&url).json(&payload).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to post Bitbucket comment ({}): {}",
                status, err_text
            )));
        }

        let item = resp.json::<Value>().await.map_err(|e| AppError::Unknown(e.to_string()))?;
        let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
        let body = item
            .get("content")
            .and_then(|c| c.get("raw"))
            .and_then(|v| v.as_str())
            .unwrap_or(content)
            .to_string();
        let created_at = item.get("created_on").and_then(|v| v.as_str()).unwrap_or("").to_string();

        Ok(PullRequestComment {
            id,
            author_name: "You".to_string(),
            author_username: "you".to_string(),
            author_avatar: None,
            body,
            created_at,
        })
    }
}
