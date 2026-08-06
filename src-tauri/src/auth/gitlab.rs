use serde::{Deserialize, Serialize};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use sha2::{Sha256, Digest};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use crate::error::AppError;

pub const DEFAULT_CLIENT_ID: &str = "gloas-37b1b096e127882b4ea65b3acd3f502d37bcf79ccf6d471367d0910eec5351df";
pub const LOOPBACK_REDIRECT_URI: &str = "http://127.0.0.1:8585/oauth/callback";
pub const DEFAULT_REDIRECT_URI: &str = "gitlab-desktop://oauth/callback";

#[derive(Debug, Serialize, Deserialize)]
pub struct PkcePair {
    pub verifier: String,
    pub challenge: String,
}

pub fn generate_pkce() -> PkcePair {
    let verifier: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    PkcePair { verifier, challenge }
}

#[derive(Debug, Deserialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub refresh_token: Option<String>,
}

pub async fn listen_for_oauth_callback(
    server_url: String,
    client_id: String,
    client_secret: Option<String>,
    verifier: String,
    redirect_uri: String,
    app_handle: tauri::AppHandle,
) -> Result<GitLabUser, AppError> {
    use tokio::net::TcpListener;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let listener = TcpListener::bind("127.0.0.1:8585")
        .await
        .map_err(|e| AppError::Network(format!("Failed to bind local OAuth port 8585: {}", e)))?;

    let (mut stream, _) = listener
        .accept()
        .await
        .map_err(|e| AppError::Network(format!("Failed to accept OAuth callback connection: {}", e)))?;

    let mut buffer = [0u8; 4096];
    let bytes_read = stream.read(&mut buffer).await?;
    let req_str = String::from_utf8_lossy(&buffer[..bytes_read]);

    let code = req_str
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|path| url::Url::parse(&format!("http://127.0.0.1:8585{}", path)).ok())
        .and_then(|url| url.query_pairs().find(|(k, _)| k == "code").map(|(_, v)| v.to_string()))
        .ok_or_else(|| AppError::Auth("Authorization code missing from callback request".to_string()))?;

    let html_response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<!DOCTYPE html><html><body style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0d0d14;color:#f0f0f3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;'><div><h2 style='color:#fc6d26;margin-bottom:8px;'>GitLab Desktop Authorized!</h2><p style='color:#c8c8ce;'>Authentication was successful. You can close this tab and return to the app.</p></div></body></html>";
    let _ = stream.write_all(html_response.as_bytes()).await;
    let _ = stream.flush().await;

    let token = exchange_code_for_token(
        &server_url,
        &client_id,
        client_secret.as_deref(),
        &code,
        &verifier,
        &redirect_uri,
    )
    .await?;

    let client = GitLabClient::new(server_url.clone(), token.clone(), None)?;
    let user = client.get_current_user().await?;

    crate::auth::keyring::save_token(&token)?;
    crate::auth::keyring::save_server_url(&server_url)?;

    use tauri::Emitter;
    let _ = app_handle.emit("oauth-success", &user);

    Ok(user)
}

pub async fn exchange_code_for_token(
    server_url: &str,
    client_id: &str,
    client_secret: Option<&str>,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<String, AppError> {
    let clean_url = server_url.trim_end_matches('/');
    let token_url = format!("{}/oauth/token", clean_url);
    let clean_cid = client_id.trim();
    let clean_code = code.trim();
    let clean_verifier = verifier.trim();
    let clean_redirect = redirect_uri.trim();

    let client = reqwest::Client::new();

    // Primary PKCE payload
    let mut params = vec![
        ("client_id", clean_cid.to_string()),
        ("grant_type", "authorization_code".to_string()),
        ("code", clean_code.to_string()),
        ("redirect_uri", clean_redirect.to_string()),
        ("code_verifier", clean_verifier.to_string()),
    ];

    if let Some(secret) = client_secret {
        let clean_secret = secret.trim();
        if !clean_secret.is_empty() {
            params.push(("client_secret", clean_secret.to_string()));
        }
    }

    let resp = client.post(&token_url).form(&params).send().await?;

    if resp.status().is_success() {
        let token_resp: OAuthTokenResponse = resp.json().await.map_err(|e| {
            AppError::Auth(format!("Failed to parse token response: {}", e))
        })?;
        return Ok(token_resp.access_token);
    }

    // Fallback: If request failed and client_secret was sent, try pure PKCE without client_secret
    if client_secret.is_some() {
        let pure_params = vec![
            ("client_id", clean_cid.to_string()),
            ("grant_type", "authorization_code".to_string()),
            ("code", clean_code.to_string()),
            ("redirect_uri", clean_redirect.to_string()),
            ("code_verifier", clean_verifier.to_string()),
        ];
        let resp2 = client.post(&token_url).form(&pure_params).send().await?;

        if resp2.status().is_success() {
            let token_resp: OAuthTokenResponse = resp2.json().await.map_err(|e| {
                AppError::Auth(format!("Failed to parse token response: {}", e))
            })?;
            return Ok(token_resp.access_token);
        }
        let err_text = resp2.text().await.unwrap_or_default();
        return Err(AppError::Auth(format!(
            "OAuth token exchange failed: {}. (Note: Authorization codes expire immediately once used. Please click 'Sign in with GitLab' to start a fresh authorization login).",
            err_text
        )));
    }

    let err_text = resp.text().await.unwrap_or_default();
    Err(AppError::Auth(format!(
        "OAuth token exchange failed: {}. (Note: Authorization codes expire immediately once used. Please click 'Sign in with GitLab' to start a fresh authorization login).",
        err_text
    )))
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitLabUser {
    pub id: u64,
    pub name: String,
    pub username: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub web_url: String,
    pub server_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitLabProject {
    pub id: u64,
    pub name: String,
    pub path_with_namespace: String,
    pub http_url_to_repo: String,
    pub ssh_url_to_repo: String,
    pub web_url: String,
    pub default_branch: Option<String>,
    pub star_count: u32,
    pub visibility: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PagedResult<T> {
    pub items: Vec<T>,
    pub page: u32,
    pub total_pages: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergeRequest {
    pub id: u64,
    pub iid: u64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub source_branch: String,
    pub target_branch: String,
    pub web_url: String,
    pub created_at: String,
}

pub struct GitLabClient {
    client: reqwest::Client,
    server_url: String,
    _token: String,
}

impl GitLabClient {
    pub fn new(server_url: String, token: String, custom_ca_pem: Option<String>) -> Result<Self, AppError> {
        let clean_url = server_url.trim_end_matches('/').to_string();
        let mut builder = reqwest::Client::builder();

        if let Some(ca_pem) = custom_ca_pem {
            if !ca_pem.trim().is_empty() {
                let cert = reqwest::Certificate::from_pem(ca_pem.as_bytes())
                    .map_err(|e| AppError::Validation(format!("Invalid custom CA certificate PEM: {}", e)))?;
                builder = builder.add_root_certificate(cert);
            }
        }

        let mut headers = HeaderMap::new();
        let auth_val = format!("Bearer {}", token);
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&auth_val)
                .map_err(|_| AppError::Validation("Invalid authorization token format".to_string()))?,
        );

        let client = builder
            .default_headers(headers)
            .build()
            .map_err(|e| AppError::Network(format!("Failed to build HTTP client: {}", e)))?;

        Ok(Self {
            client,
            server_url: clean_url,
            _token: token,
        })
    }

    pub async fn get_current_user(&self) -> Result<GitLabUser, AppError> {
        let url = format!("{}/api/v4/user", self.server_url);
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            if resp.status().as_u16() == 401 {
                return Err(AppError::Auth("Invalid GitLab Personal Access Token or OAuth token.".to_string()));
            }
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to fetch GitLab user: {}", err_text)));
        }

        #[derive(Deserialize)]
        struct RawUser {
            id: u64,
            name: String,
            username: String,
            email: Option<String>,
            avatar_url: Option<String>,
            web_url: String,
        }

        let raw: RawUser = resp.json().await.map_err(|e| AppError::Network(format!("Failed to parse user JSON: {}", e)))?;

        Ok(GitLabUser {
            id: raw.id,
            name: raw.name,
            username: raw.username,
            email: raw.email,
            avatar_url: raw.avatar_url,
            web_url: raw.web_url,
            server_url: self.server_url.clone(),
        })
    }

    pub async fn fetch_projects(&self, page: u32) -> Result<PagedResult<GitLabProject>, AppError> {
        let url = format!(
            "{}/api/v4/projects?membership=true&order_by=updated_at&per_page=20&page={}",
            self.server_url, page
        );
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to fetch projects: {}", err_text)));
        }

        let total_pages = resp
            .headers()
            .get("x-total-pages")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(1);

        let projects: Vec<GitLabProject> = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse projects JSON: {}", e)))?;

        Ok(PagedResult {
            items: projects,
            page,
            total_pages,
        })
    }

    pub async fn get_open_merge_requests(&self, project_id: &str) -> Result<Vec<MergeRequest>, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!("{}/api/v4/projects/{}/merge_requests?state=opened", self.server_url, encoded_id);
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            return Err(AppError::Network(format!("Failed to fetch merge requests (Status {})", resp.status())));
        }

        let mrs: Vec<MergeRequest> = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse MRs JSON: {}", e)))?;

        Ok(mrs)
    }

    pub async fn create_merge_request(
        &self,
        project_id: &str,
        source_branch: &str,
        target_branch: &str,
        title: &str,
    ) -> Result<MergeRequest, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!("{}/api/v4/projects/{}/merge_requests", self.server_url, encoded_id);

        let payload = serde_json::json!({
            "source_branch": source_branch,
            "target_branch": target_branch,
            "title": title,
        });

        let resp = self.client.post(&url).json(&payload).send().await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to create MR: {}", err_text)));
        }

        let mr: MergeRequest = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse created MR JSON: {}", e)))?;

        Ok(mr)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_pkce() {
        let pkce = generate_pkce();
        assert_eq!(pkce.verifier.len(), 64);
        assert!(!pkce.challenge.is_empty());
    }
}

