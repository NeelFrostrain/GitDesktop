use crate::auth::github::PullRequestComment;
use crate::auth::gitlab::{MergeRequest, MergeRequestAuthor};
use crate::error::AppError;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde_json::Value;

pub struct AzureDevOpsClient {
    client: reqwest::Client,
    instance_url: String,
    _token: Option<String>,
}

impl AzureDevOpsClient {
    pub fn new(instance_url: Option<&str>, token: Option<&str>) -> Result<Self, AppError> {
        let base_url = instance_url
            .unwrap_or("https://dev.azure.com")
            .trim_end_matches('/')
            .to_string();

        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("GitDesktop/0.1.0"),
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("application/json;api-version=7.1-preview.1"),
        );

        if let Some(t) = token {
            let auth_str = format!(":{}", t);
            let b64 = STANDARD.encode(auth_str.as_bytes());
            if let Ok(hv) = HeaderValue::from_str(&format!("Basic {}", b64)) {
                headers.insert(AUTHORIZATION, hv);
            }
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| AppError::Network(e.to_string()))?;

        Ok(Self {
            client,
            instance_url: base_url,
            _token: token.map(|s| s.to_string()),
        })
    }

    /// Parses path formatted as `org/project/repo` or `project/repo` into components.
    fn parse_azure_path(&self, repo_path: &str) -> (String, String, String) {
        let clean = repo_path
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');

        let parts: Vec<&str> = clean.split('/').filter(|s| !s.is_empty()).collect();
        if parts.len() >= 3 {
            (parts[0].to_string(), parts[1].to_string(), parts[2].to_string())
        } else if parts.len() == 2 {
            // Default org from instance_url or empty
            let org = if self.instance_url.contains("dev.azure.com/") {
                self.instance_url.split("dev.azure.com/").nth(1).unwrap_or("").to_string()
            } else {
                "".to_string()
            };
            (org, parts[0].to_string(), parts[1].to_string())
        } else if parts.len() == 1 {
            ("".to_string(), parts[0].to_string(), parts[0].to_string())
        } else {
            ("".to_string(), "".to_string(), "".to_string())
        }
    }

    fn build_api_url(&self, org: &str, project: &str, repo: &str, endpoint: &str) -> String {
        if !org.is_empty() {
            format!("https://dev.azure.com/{}/{}/_apis/git/repositories/{}/{}", org, project, repo, endpoint)
        } else if self.instance_url.contains("visualstudio.com") {
            format!("{}/{}/_apis/git/repositories/{}/{}", self.instance_url, project, repo, endpoint)
        } else {
            format!("https://dev.azure.com/{}/_apis/git/repositories/{}/{}", project, repo, endpoint)
        }
    }

    fn parse_azure_prs(&self, pr_array: &[Value], repo_full_name: Option<&str>) -> Vec<MergeRequest> {
        let mut results = Vec::new();
        for item in pr_array {
            let id = item.get("pullRequestId").and_then(|v| v.as_u64()).unwrap_or(0);
            let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let description = item
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let state = item.get("status").and_then(|v| v.as_str()).unwrap_or("active").to_lowercase();
            let web_url = item
                .get("url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let created_at = item
                .get("creationDate")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let source_ref = item.get("sourceRefName").and_then(|v| v.as_str()).unwrap_or("");
            let source_branch = source_ref.trim_start_matches("refs/heads/").to_string();

            let target_ref = item.get("targetRefName").and_then(|v| v.as_str()).unwrap_or("");
            let target_branch = target_ref.trim_start_matches("refs/heads/").to_string();

            let author_obj = item.get("createdBy").unwrap_or(&Value::Null);
            let author_name = author_obj
                .get("displayName")
                .and_then(|v| v.as_str())
                .unwrap_or("Azure DevOps User")
                .to_string();
            let author_username = author_obj
                .get("uniqueName")
                .and_then(|v| v.as_str())
                .unwrap_or(&author_name)
                .to_string();
            let author_avatar = author_obj
                .get("_links")
                .and_then(|l| l.get("avatar"))
                .and_then(|a| a.get("href"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let is_draft = item.get("isDraft").and_then(|v| v.as_bool()).unwrap_or(false);

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
                web_url,
                created_at,
                author: Some(author),
                assignees: None,
                reviewers: None,
                labels: None,
                milestone: None,
                is_draft: Some(is_draft),
                repo_full_name: repo_full_name.map(|s| s.to_string()),
                total_count: None,
            });
        }
        results
    }

    /// Fetches open PRs from Azure DevOps repository.
    pub async fn get_open_pull_requests(&self, repo_path: &str) -> Result<Vec<MergeRequest>, AppError> {
        let (org, project, repo) = self.parse_azure_path(repo_path);
        let url = self.build_api_url(&org, &project, &repo, "pullrequests?searchCriteria.status=active&$top=50&api-version=7.1-preview.1");

        let resp = self.client.get(&url).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Azure DevOps API Error ({}): {}",
                status, err_text
            )));
        }

        let json = resp.json::<Value>().await.map_err(|e| AppError::Unknown(e.to_string()))?;
        let values = json.get("value").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        Ok(self.parse_azure_prs(&values, Some(repo_path)))
    }

    /// Creates a new Pull Request in Azure DevOps.
    pub async fn create_pull_request(
        &self,
        repo_path: &str,
        source_branch: &str,
        target_branch: &str,
        title: &str,
        description: Option<&str>,
    ) -> Result<MergeRequest, AppError> {
        let (org, project, repo) = self.parse_azure_path(repo_path);
        let url = self.build_api_url(&org, &project, &repo, "pullrequests?api-version=7.1-preview.1");

        let src_ref = if source_branch.starts_with("refs/heads/") {
            source_branch.to_string()
        } else {
            format!("refs/heads/{}", source_branch)
        };

        let tgt_ref = if target_branch.starts_with("refs/heads/") {
            target_branch.to_string()
        } else {
            format!("refs/heads/{}", target_branch)
        };

        let payload = serde_json::json!({
            "sourceRefName": src_ref,
            "targetRefName": tgt_ref,
            "title": title,
            "description": description.unwrap_or(""),
        });

        let resp = self.client.post(&url).json(&payload).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to create Azure DevOps PR ({}): {}",
                status, err_text
            )));
        }

        let pr_json = resp.json::<Value>().await.map_err(|e| AppError::Unknown(e.to_string()))?;
        let prs = self.parse_azure_prs(&[pr_json], Some(repo_path));
        prs.into_iter().next().ok_or_else(|| AppError::Unknown("Failed to parse created PR response".to_string()))
    }

    /// Completes / Merges a Pull Request in Azure DevOps.
    pub async fn merge_pull_request(
        &self,
        repo_path: &str,
        pr_id: u64,
        commit_message: Option<&str>,
        merge_strategy: Option<&str>,
        close_source_branch: Option<bool>,
    ) -> Result<bool, AppError> {
        let (org, project, repo) = self.parse_azure_path(repo_path);
        let url = self.build_api_url(&org, &project, &repo, &format!("pullrequests/{}?api-version=7.1-preview.1", pr_id));

        let strat = match merge_strategy {
            Some("squash") => "squash",
            Some("rebase") => "rebase",
            _ => "noFastForward",
        };

        let mut completion_options = serde_json::json!({
            "mergeStrategy": strat,
            "deleteSourceBranch": close_source_branch.unwrap_or(false),
        });

        if let Some(msg) = commit_message {
            completion_options["mergeCommitMessage"] = serde_json::json!(msg);
        }

        let payload = serde_json::json!({
            "status": "completed",
            "completionOptions": completion_options,
        });

        let resp = self.client.patch(&url).json(&payload).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to merge Azure DevOps PR ({}): {}",
                status, err_text
            )));
        }

        Ok(true)
    }

    /// Fetches comment threads for an Azure DevOps PR.
    pub async fn get_comments(&self, repo_path: &str, pr_id: u64) -> Result<Vec<PullRequestComment>, AppError> {
        let (org, project, repo) = self.parse_azure_path(repo_path);
        let url = self.build_api_url(&org, &project, &repo, &format!("pullrequests/{}/threads?api-version=7.1-preview.1", pr_id));

        let resp = self.client.get(&url).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            return Ok(Vec::new());
        }

        let json = resp.json::<Value>().await.map_err(|e| AppError::Unknown(e.to_string()))?;
        let threads = json.get("value").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        let mut comments = Vec::new();
        for thread in threads {
            let thread_comments = thread.get("comments").and_then(|c| c.as_array()).cloned().unwrap_or_default();
            for c in thread_comments {
                let id = c.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
                let content = c.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let published = c.get("publishedDate").and_then(|v| v.as_str()).unwrap_or("").to_string();

                let author_obj = c.get("author").unwrap_or(&Value::Null);
                let author_name = author_obj.get("displayName").and_then(|v| v.as_str()).unwrap_or("User").to_string();
                let author_avatar = author_obj
                    .get("_links")
                    .and_then(|l| l.get("avatar"))
                    .and_then(|a| a.get("href"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                comments.push(PullRequestComment {
                    id,
                    author_name: author_name.clone(),
                    author_username: author_name,
                    author_avatar,
                    body: content,
                    created_at: published,
                });
            }
        }

        Ok(comments)
    }

    /// Adds a comment to an Azure DevOps PR thread.
    pub async fn add_comment(&self, repo_path: &str, pr_id: u64, content: &str) -> Result<PullRequestComment, AppError> {
        let (org, project, repo) = self.parse_azure_path(repo_path);
        let url = self.build_api_url(&org, &project, &repo, &format!("pullrequests/{}/threads?api-version=7.1-preview.1", pr_id));

        let payload = serde_json::json!({
            "comments": [
                {
                    "parentCommentId": 0,
                    "content": content,
                    "commentType": 1
                }
            ],
            "status": 1
        });

        let resp = self.client.post(&url).json(&payload).send().await.map_err(|e| AppError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to post Azure DevOps comment ({}): {}",
                status, err_text
            )));
        }

        Ok(PullRequestComment {
            id: 1,
            author_name: "You".to_string(),
            author_username: "you".to_string(),
            author_avatar: None,
            body: content.to_string(),
            created_at: "".to_string(),
        })
    }
}
