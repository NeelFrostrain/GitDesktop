use crate::error::AppError;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

pub const GITHUB_API_URL: &str = "https://api.github.com";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub html_url: String,
    /// Normalized to match GitLabUser usage in the frontend
    pub server_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub clone_url: String,
    pub ssh_url: String,
    pub html_url: String,
    pub default_branch: Option<String>,
    pub private: bool,
    pub stargazers_count: u32,
    pub description: Option<String>,
}

/// Unified project representation mirroring GitLabProject for the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedRepo {
    pub id: u64,
    pub name: String,
    pub path_with_namespace: String,
    pub http_url_to_repo: String,
    pub ssh_url_to_repo: String,
    pub web_url: String,
    pub default_branch: Option<String>,
    pub star_count: u32,
    pub visibility: String, // "private" | "public" | "internal"
    pub provider: String,   // "gitlab" | "github"
}

pub struct GitHubClient {
    client: reqwest::Client,
}

impl GitHubClient {
    pub fn new(token: Option<&str>) -> Result<Self, AppError> {
        let mut headers = HeaderMap::new();

        if let Some(t) = token {
            let clean = t.trim();
            if !clean.is_empty() {
                let auth_val = format!("Bearer {}", clean);
                if let Ok(val) = HeaderValue::from_str(&auth_val) {
                    headers.insert(AUTHORIZATION, val);
                }
            }
        }
        // GitHub API requires a User-Agent header
        headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop/1.0"));
        // Request JSON responses
        headers.insert(
            reqwest::header::ACCEPT,
            HeaderValue::from_static("application/vnd.github+json"),
        );

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| AppError::Network(format!("Failed to build GitHub HTTP client: {}", e)))?;

        Ok(Self { client })
    }

    pub async fn get_current_user(&self) -> Result<GitHubUser, AppError> {
        let url = format!("{}/user", GITHUB_API_URL);
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            if resp.status().as_u16() == 401 {
                return Err(AppError::Auth(
                    "Invalid GitHub Personal Access Token. Make sure the token has 'repo' and 'read:user' scopes.".to_string()
                ));
            }
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to fetch GitHub user: {}",
                err_text
            )));
        }

        #[derive(Deserialize)]
        struct RawUser {
            id: u64,
            login: String,
            name: Option<String>,
            email: Option<String>,
            avatar_url: Option<String>,
            html_url: String,
        }

        let raw: RawUser = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse GitHub user JSON: {}", e)))?;

        Ok(GitHubUser {
            id: raw.id,
            login: raw.login,
            name: raw.name,
            email: raw.email,
            avatar_url: raw.avatar_url,
            html_url: raw.html_url,
            server_url: "https://github.com".to_string(),
        })
    }

    pub async fn fetch_repos(&self, page: u32) -> Result<Vec<UnifiedRepo>, AppError> {
        let url = format!(
            "{}/user/repos?per_page=100&page={}&sort=updated&affiliation=owner,collaborator,organization_member",
            GITHUB_API_URL, page
        );
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to fetch GitHub repos: {}",
                err_text
            )));
        }

        let mut repos: Vec<GitHubRepo> = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse GitHub repos JSON: {}", e)))?;

        // On page 1, also fetch repos from all user organizations (e.g. EpicGames)
        if page == 1 {
            #[derive(Deserialize)]
            struct GitHubOrg {
                login: String,
            }
            if let Ok(orgs_resp) = self.client.get(format!("{}/user/orgs", GITHUB_API_URL)).send().await {
                if let Ok(orgs) = orgs_resp.json::<Vec<GitHubOrg>>().await {
                    for org in orgs {
                        let org_url = format!("{}/orgs/{}/repos?per_page=100&sort=updated", GITHUB_API_URL, org.login);
                        if let Ok(org_repos_resp) = self.client.get(&org_url).send().await {
                            if let Ok(org_repos) = org_repos_resp.json::<Vec<GitHubRepo>>().await {
                                for r in org_repos {
                                    if !repos.iter().any(|existing| existing.id == r.id) {
                                        repos.push(r);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(repos
            .into_iter()
            .map(|r| UnifiedRepo {
                id: r.id,
                name: r.name.clone(),
                path_with_namespace: r.full_name.clone(),
                http_url_to_repo: r.clone_url,
                ssh_url_to_repo: r.ssh_url,
                web_url: r.html_url,
                default_branch: r.default_branch,
                star_count: r.stargazers_count,
                visibility: if r.private {
                    "private".to_string()
                } else {
                    "public".to_string()
                },
                provider: "github".to_string(),
            })
            .collect())
    }

    pub async fn search_repos(&self, query: &str, page: u32) -> Result<Vec<UnifiedRepo>, AppError> {
        let all = self.fetch_repos(page).await?;
        let q_lower = query.to_lowercase();
        let matched: Vec<UnifiedRepo> = all
            .into_iter()
            .filter(|r| {
                r.name.to_lowercase().contains(&q_lower)
                    || r.path_with_namespace.to_lowercase().contains(&q_lower)
            })
            .collect();

        if !matched.is_empty() {
            return Ok(matched);
        }

        let url = format!(
            "{}/search/repositories?q={}+fork:true&per_page=100&page={}",
            GITHUB_API_URL,
            urlencoding::encode(query),
            page
        );
        if let Ok(resp) = self.client.get(&url).send().await {
            if resp.status().is_success() {
                #[derive(Deserialize)]
                struct SearchResponse {
                    items: Vec<GitHubRepo>,
                }
                if let Ok(result) = resp.json::<SearchResponse>().await {
                    return Ok(result
                        .items
                        .into_iter()
                        .map(|r| UnifiedRepo {
                            id: r.id,
                            name: r.name.clone(),
                            path_with_namespace: r.full_name.clone(),
                            http_url_to_repo: r.clone_url,
                            ssh_url_to_repo: r.ssh_url,
                            web_url: r.html_url,
                            default_branch: r.default_branch,
                            star_count: r.stargazers_count,
                            visibility: if r.private {
                                "private".to_string()
                            } else {
                                "public".to_string()
                            },
                            provider: "github".to_string(),
                        })
                        .collect());
                }
            }
        }

        Ok(Vec::new())
    }

    pub async fn create_repo(
        &self,
        name: &str,
        private: bool,
        description: Option<&str>,
    ) -> Result<UnifiedRepo, AppError> {
        let url = format!("{}/user/repos", GITHUB_API_URL);

        let mut body = serde_json::json!({
            "name": name,
            "private": private,
            "auto_init": false,
        });

        if let Some(desc) = description {
            if !desc.trim().is_empty() {
                body["description"] = serde_json::json!(desc.trim());
            }
        }

        let resp = self.client.post(&url).json(&body).send().await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to create GitHub repo: {}",
                err_text
            )));
        }

        let repo: GitHubRepo = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse GitHub repo JSON: {}", e)))?;

        Ok(UnifiedRepo {
            id: repo.id,
            name: repo.name,
            path_with_namespace: repo.full_name,
            http_url_to_repo: repo.clone_url,
            ssh_url_to_repo: repo.ssh_url,
            web_url: repo.html_url,
            default_branch: repo.default_branch,
            star_count: repo.stargazers_count,
            visibility: if repo.private {
                "private".to_string()
            } else {
                "public".to_string()
            },
            provider: "github".to_string(),
        })
    }

    fn parse_github_prs(
        &self,
        pr_array: &[serde_json::Value],
        repo_full_name: Option<&str>,
        total_count: Option<u64>,
    ) -> Vec<crate::auth::gitlab::MergeRequest> {
        let mut results = Vec::new();
        for item in pr_array {
            let number = item.get("number").and_then(|v| v.as_u64()).unwrap_or(0);
            let title = item
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let description = item
                .get("body")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let state = item
                .get("state")
                .and_then(|v| v.as_str())
                .unwrap_or("open")
                .to_string();
            let html_url = item
                .get("html_url")
                .and_then(|v| v.as_str())
                .unwrap_or("#")
                .to_string();
            let created_at = item
                .get("created_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let source_branch = item
                .get("head")
                .and_then(|h| h.get("ref"))
                .and_then(|r| r.as_str())
                .unwrap_or("")
                .to_string();

            let target_branch = item
                .get("base")
                .and_then(|b| b.get("ref"))
                .and_then(|r| r.as_str())
                .unwrap_or("main")
                .to_string();

            let author_user = item.get("user");
            let author = author_user.map(|u| {
                let login = u.get("login").and_then(|v| v.as_str()).map(|s| s.to_string());
                let name = u.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
                let avatar = u
                    .get("avatar_url")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                crate::auth::gitlab::MergeRequestAuthor {
                    name,
                    username: login,
                    avatar_url: avatar,
                }
            });

            let mut assignees = Vec::new();
            if let Some(arr) = item.get("assignees").and_then(|v| v.as_array()) {
                for u in arr {
                    let login = u.get("login").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let name = u.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let avatar = u.get("avatar_url").and_then(|v| v.as_str()).map(|s| s.to_string());
                    assignees.push(crate::auth::gitlab::MergeRequestAuthor {
                        name,
                        username: login,
                        avatar_url: avatar,
                    });
                }
            }

            let mut reviewers = Vec::new();
            if let Some(arr) = item.get("requested_reviewers").and_then(|v| v.as_array()) {
                for u in arr {
                    let login = u.get("login").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let name = u.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let avatar = u.get("avatar_url").and_then(|v| v.as_str()).map(|s| s.to_string());
                    reviewers.push(crate::auth::gitlab::MergeRequestAuthor {
                        name,
                        username: login,
                        avatar_url: avatar,
                    });
                }
            }

            let mut labels = Vec::new();
            if let Some(arr) = item.get("labels").and_then(|v| v.as_array()) {
                for l in arr {
                    if let Some(name) = l.get("name").and_then(|v| v.as_str()) {
                        let color = l.get("color").and_then(|v| v.as_str()).map(|s| format!("#{}", s));
                        labels.push(crate::auth::gitlab::MergeRequestLabel {
                            name: name.to_string(),
                            color,
                        });
                    }
                }
            }

            let milestone = item
                .get("milestone")
                .and_then(|m| m.get("title"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let is_draft = item.get("draft").and_then(|v| v.as_bool()).unwrap_or(false);

            results.push(crate::auth::gitlab::MergeRequest {
                id: number,
                iid: number,
                title,
                description,
                state,
                source_branch,
                target_branch,
                web_url: html_url,
                created_at,
                author,
                assignees: Some(assignees),
                reviewers: Some(reviewers),
                labels: Some(labels),
                milestone,
                is_draft: Some(is_draft),
                repo_full_name: repo_full_name.map(|s| s.to_string()),
                total_count,
            });
        }
        results
    }

    pub async fn get_open_pull_requests(
        &self,
        owner_repo: &str,
    ) -> Result<Vec<crate::auth::gitlab::MergeRequest>, AppError> {
        let clean_path = owner_repo
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');

        // 1. Inspect repository metadata to detect parent if it is a fork
        let mut parent_repo_opt: Option<String> = None;
        let repo_info_url = format!("{}/repos/{}", GITHUB_API_URL, clean_path);
        if let Ok(repo_resp) = self.client.get(&repo_info_url).send().await {
            if repo_resp.status().is_success() {
                if let Ok(repo_json) = repo_resp.json::<serde_json::Value>().await {
                    let is_fork = repo_json.get("fork").and_then(|v| v.as_bool()).unwrap_or(false);
                    let parent_name = repo_json
                        .get("parent")
                        .and_then(|p| p.get("full_name"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .or_else(|| {
                            repo_json
                                .get("source")
                                .and_then(|p| p.get("full_name"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                        });

                    if is_fork || parent_name.is_some() {
                        parent_repo_opt = parent_name;
                    }
                }
            }
        }

        let effective_repo = parent_repo_opt.clone().unwrap_or_else(|| clean_path.to_string());

        // 2. Fetch exact total open PR count via Search API
        let mut total_open_count: Option<u64> = None;
        let search_url = format!("{}/search/issues?q=repo:{}+is:pr+is:open&per_page=1", GITHUB_API_URL, effective_repo);
        if let Ok(search_resp) = self.client.get(&search_url).send().await {
            if search_resp.status().is_success() {
                if let Ok(search_json) = search_resp.json::<serde_json::Value>().await {
                    if let Some(cnt) = search_json.get("total_count").and_then(|v| v.as_u64()) {
                        total_open_count = Some(cnt);
                    }
                }
            }
        }

        // 3. Fetch open pull requests from effective (parent/primary) repository
        let pulls_url = format!("{}/repos/{}/pulls?state=open&per_page=100", GITHUB_API_URL, effective_repo);
        let pulls_resp = self.client.get(&pulls_url).send().await;

        let mut results = Vec::new();
        let mut fetched_ids = std::collections::HashSet::new();

        if let Ok(resp) = pulls_resp {
            if resp.status().is_success() {
                if let Ok(pr_array) = resp.json::<Vec<serde_json::Value>>().await {
                    let count_to_use = total_open_count.unwrap_or(pr_array.len() as u64);
                    let parsed = self.parse_github_prs(&pr_array, Some(&effective_repo), Some(count_to_use));
                    for pr in parsed {
                        fetched_ids.insert(pr.id);
                        results.push(pr);
                    }
                }
            }
        }

        // 4. If repository was a fork, also fetch direct PRs from clean_path if different
        if clean_path.to_lowercase() != effective_repo.to_lowercase() {
            let direct_url = format!("{}/repos/{}/pulls?state=open&per_page=100", GITHUB_API_URL, clean_path);
            if let Ok(direct_resp) = self.client.get(&direct_url).send().await {
                if direct_resp.status().is_success() {
                    if let Ok(pr_array) = direct_resp.json::<Vec<serde_json::Value>>().await {
                        let parsed = self.parse_github_prs(&pr_array, Some(&effective_repo), total_open_count);
                        for pr in parsed {
                            if !fetched_ids.contains(&pr.id) {
                                fetched_ids.insert(pr.id);
                                results.push(pr);
                            }
                        }
                    }
                }
            }
        }

        // Sort pull requests with newest number first
        results.sort_by(|a, b| b.iid.cmp(&a.iid));

        Ok(results)
    }

    pub async fn create_pull_request(
        &self,
        owner_repo: &str,
        head: &str,
        base: &str,
        title: &str,
        body: Option<&str>,
    ) -> Result<crate::auth::gitlab::MergeRequest, AppError> {
        let clean_path = owner_repo
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');
        let url = format!("{}/repos/{}/pulls", GITHUB_API_URL, clean_path);
        let mut req_body = serde_json::json!({
            "title": title,
            "head": head,
            "base": base,
        });
        if let Some(b) = body {
            if !b.trim().is_empty() {
                req_body["body"] = serde_json::json!(b.trim());
            }
        }
        let resp = self.client.post(&url).json(&req_body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            let clean_msg = if let Ok(val) = serde_json::from_str::<serde_json::Value>(&err_text) {
                if let Some(errs) = val.get("errors").and_then(|e| e.as_array()) {
                    let msgs: Vec<String> = errs
                        .iter()
                        .filter_map(|e| e.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
                        .collect();
                    if !msgs.is_empty() {
                        msgs.join("; ")
                    } else if let Some(m) = val.get("message").and_then(|m| m.as_str()) {
                        m.to_string()
                    } else {
                        err_text
                    }
                } else if let Some(m) = val.get("message").and_then(|m| m.as_str()) {
                    m.to_string()
                } else {
                    err_text
                }
            } else {
                err_text
            };

            return Err(AppError::Network(clean_msg));
        }

        #[derive(Deserialize)]
        struct GitHubPRUser {
            login: Option<String>,
            name: Option<String>,
            avatar_url: Option<String>,
        }

        #[derive(Deserialize)]
        struct GitHubPRBranch {
            #[serde(rename = "ref")]
            branch_ref: String,
        }

        #[derive(Deserialize)]
        struct RawPR {
            number: u64,
            title: String,
            body: Option<String>,
            state: String,
            html_url: String,
            head: GitHubPRBranch,
            base: GitHubPRBranch,
            created_at: String,
            user: Option<GitHubPRUser>,
        }

        let p: RawPR = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse created PR JSON: {}", e)))?;

        Ok(crate::auth::gitlab::MergeRequest {
            id: p.number,
            iid: p.number,
            title: p.title,
            description: p.body,
            state: p.state,
            source_branch: p.head.branch_ref,
            target_branch: p.base.branch_ref,
            web_url: p.html_url,
            created_at: p.created_at,
            author: p.user.map(|u| crate::auth::gitlab::MergeRequestAuthor {
                name: u.name,
                username: u.login,
                avatar_url: u.avatar_url,
            }),
            assignees: None,
            reviewers: None,
            labels: None,
            milestone: None,
            is_draft: None,
            repo_full_name: Some(owner_repo.to_string()),
            total_count: None,
        })
    }

    pub async fn update_pull_request(
        &self,
        owner_repo: &str,
        pull_number: u64,
        title: Option<&str>,
        body: Option<&str>,
        target_branch: Option<&str>,
        state: Option<&str>,
    ) -> Result<crate::auth::gitlab::MergeRequest, AppError> {
        let clean_path = owner_repo
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');
        let url = format!("{}/repos/{}/pulls/{}", GITHUB_API_URL, clean_path, pull_number);
        let mut req_body = serde_json::Map::new();
        if let Some(t) = title {
            req_body.insert("title".to_string(), serde_json::json!(t.trim()));
        }
        if let Some(b) = body {
            req_body.insert("body".to_string(), serde_json::json!(b.trim()));
        }
        if let Some(base) = target_branch {
            req_body.insert("base".to_string(), serde_json::json!(base.trim()));
        }
        if let Some(s) = state {
            req_body.insert("state".to_string(), serde_json::json!(s.trim()));
        }

        let resp = self
            .client
            .patch(&url)
            .json(&serde_json::Value::Object(req_body))
            .send()
            .await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            let clean_msg = if let Ok(val) = serde_json::from_str::<serde_json::Value>(&err_text) {
                if let Some(errs) = val.get("errors").and_then(|e| e.as_array()) {
                    let msgs: Vec<String> = errs
                        .iter()
                        .filter_map(|e| e.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
                        .collect();
                    if !msgs.is_empty() {
                        msgs.join("; ")
                    } else if let Some(m) = val.get("message").and_then(|m| m.as_str()) {
                        m.to_string()
                    } else {
                        err_text
                    }
                } else if let Some(m) = val.get("message").and_then(|m| m.as_str()) {
                    m.to_string()
                } else {
                    err_text
                }
            } else {
                err_text
            };

            return Err(AppError::Network(clean_msg));
        }

        #[derive(Deserialize)]
        struct GitHubPRUser {
            login: Option<String>,
            name: Option<String>,
            avatar_url: Option<String>,
        }

        #[derive(Deserialize)]
        struct GitHubPRBranch {
            #[serde(rename = "ref")]
            branch_ref: String,
        }

        #[derive(Deserialize)]
        struct RawPR {
            number: u64,
            title: String,
            body: Option<String>,
            state: String,
            html_url: String,
            head: GitHubPRBranch,
            base: GitHubPRBranch,
            created_at: String,
            user: Option<GitHubPRUser>,
        }

        let p: RawPR = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse updated PR JSON: {}", e)))?;

        Ok(crate::auth::gitlab::MergeRequest {
            id: p.number,
            iid: p.number,
            title: p.title,
            description: p.body,
            state: p.state,
            source_branch: p.head.branch_ref,
            target_branch: p.base.branch_ref,
            web_url: p.html_url,
            created_at: p.created_at,
            author: p.user.map(|u| crate::auth::gitlab::MergeRequestAuthor {
                name: u.name,
                username: u.login,
                avatar_url: u.avatar_url,
            }),
            assignees: None,
            reviewers: None,
            labels: None,
            milestone: None,
            is_draft: None,
            repo_full_name: Some(owner_repo.to_string()),
            total_count: None,
        })
    }

    pub async fn get_pull_request_comments(
        &self,
        owner_repo: &str,
        pull_number: u64,
    ) -> Result<Vec<PullRequestComment>, AppError> {
        let clean_path = owner_repo
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');
        let url = format!("{}/repos/{}/issues/{}/comments", GITHUB_API_URL, clean_path, pull_number);
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Ok(Vec::new());
        }

        let arr: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
        let mut comments = Vec::new();
        for item in arr {
            let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
            let body = item.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let created_at = item.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let user = item.get("user");
            let author_username = user
                .and_then(|u| u.get("login"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let author_name = user
                .and_then(|u| u.get("name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| author_username.clone());
            let author_avatar = user
                .and_then(|u| u.get("avatar_url"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            comments.push(PullRequestComment {
                id,
                author_name,
                author_username,
                author_avatar,
                body,
                created_at,
            });
        }
        Ok(comments)
    }

    pub async fn add_pull_request_comment(
        &self,
        owner_repo: &str,
        pull_number: u64,
        body: &str,
    ) -> Result<PullRequestComment, AppError> {
        let clean_path = owner_repo
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');
        let url = format!("{}/repos/{}/issues/{}/comments", GITHUB_API_URL, clean_path, pull_number);
        let req_body = serde_json::json!({ "body": body.trim() });
        let resp = self.client.post(&url).json(&req_body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to post comment: {}", err_text)));
        }

        let item: serde_json::Value = resp.json().await.map_err(|e| AppError::Network(e.to_string()))?;
        let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
        let body = item.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let created_at = item.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let user = item.get("user");
        let author_username = user
            .and_then(|u| u.get("login"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let author_name = user
            .and_then(|u| u.get("name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| author_username.clone());
        let author_avatar = user
            .and_then(|u| u.get("avatar_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(PullRequestComment {
            id,
            author_name,
            author_username,
            author_avatar,
            body,
            created_at,
        })
    }

    pub async fn merge_pull_request(
        &self,
        owner_repo: &str,
        pull_number: u64,
        merge_method: Option<&str>,
        commit_title: Option<&str>,
        commit_message: Option<&str>,
    ) -> Result<bool, AppError> {
        let clean_path = owner_repo
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');
        let url = format!("{}/repos/{}/pulls/{}/merge", GITHUB_API_URL, clean_path, pull_number);
        let mut payload = serde_json::Map::new();
        if let Some(m) = merge_method {
            payload.insert("merge_method".to_string(), serde_json::json!(m));
        }
        if let Some(t) = commit_title {
            payload.insert("commit_title".to_string(), serde_json::json!(t));
        }
        if let Some(msg) = commit_message {
            payload.insert("commit_message".to_string(), serde_json::json!(msg));
        }

        let resp = self.client.put(&url).json(&serde_json::Value::Object(payload)).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to merge pull request: {}", err_text)));
        }
        Ok(true)
    }

    pub async fn edit_pull_request_comment(
        &self,
        owner_repo: &str,
        comment_id: u64,
        body: &str,
    ) -> Result<PullRequestComment, AppError> {
        let clean_path = owner_repo
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');
        let url = format!("{}/repos/{}/issues/comments/{}", GITHUB_API_URL, clean_path, comment_id);
        let req_body = serde_json::json!({ "body": body.trim() });
        let resp = self.client.patch(&url).json(&req_body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to edit comment: {}", err_text)));
        }
        let item: serde_json::Value = resp.json().await.map_err(|e| AppError::Network(e.to_string()))?;
        let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
        let body = item.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let created_at = item.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let user = item.get("user");
        let author_username = user
            .and_then(|u| u.get("login"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let author_name = user
            .and_then(|u| u.get("name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| author_username.clone());
        let author_avatar = user
            .and_then(|u| u.get("avatar_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(PullRequestComment {
            id,
            author_name,
            author_username,
            author_avatar,
            body,
            created_at,
        })
    }

    pub async fn delete_pull_request_comment(
        &self,
        owner_repo: &str,
        comment_id: u64,
    ) -> Result<bool, AppError> {
        let clean_path = owner_repo
            .trim_matches('/')
            .trim_end_matches(".git")
            .trim_matches('/');
        let url = format!("{}/repos/{}/issues/comments/{}", GITHUB_API_URL, clean_path, comment_id);
        let resp = self.client.delete(&url).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to delete comment: {}", err_text)));
        }
        Ok(true)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PullRequestComment {
    pub id: u64,
    pub author_name: String,
    pub author_username: String,
    pub author_avatar: Option<String>,
    pub body: String,
    pub created_at: String,
}
