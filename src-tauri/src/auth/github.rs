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
    pub fn new(token: &str) -> Result<Self, AppError> {
        let mut headers = HeaderMap::new();

        let auth_val = format!("Bearer {}", token.trim());
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&auth_val)
                .map_err(|_| AppError::Validation("Invalid GitHub token format".to_string()))?,
        );
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
            "{}/user/repos?per_page=20&page={}&sort=updated&affiliation=owner,collaborator,organization_member",
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

        let repos: Vec<GitHubRepo> = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse GitHub repos JSON: {}", e)))?;

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
}
