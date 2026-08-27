use crate::error::AppError;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const DEFAULT_CLIENT_ID: &str =
    "gloas-37b1b096e127882b4ea65b3acd3f502d37bcf79ccf6d471367d0910eec5351df";
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
    PkcePair {
        verifier,
        challenge,
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
    pub scope: Option<String>,
    pub created_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenInfo {
    pub scope: Vec<String>,
    pub created_at: Option<i64>,
    pub expires_in_seconds: Option<i64>,
    pub resource_owner_id: Option<u64>,
}

pub async fn listen_for_oauth_callback(
    server_url: String,
    client_id: String,
    client_secret: Option<String>,
    verifier: String,
    redirect_uri: String,
    app_handle: tauri::AppHandle,
) -> Result<GitLabUser, AppError> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:8585")
        .await
        .map_err(|e| AppError::Network(format!("Failed to bind local OAuth port 8585: {}", e)))?;

    let (mut stream, _) = listener.accept().await.map_err(|e| {
        AppError::Network(format!("Failed to accept OAuth callback connection: {}", e))
    })?;

    let mut buffer = [0u8; 4096];
    let bytes_read = stream.read(&mut buffer).await?;
    let req_str = String::from_utf8_lossy(&buffer[..bytes_read]);

    let code = req_str
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|path| url::Url::parse(&format!("http://127.0.0.1:8585{}", path)).ok())
        .and_then(|url| {
            url.query_pairs()
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.to_string())
        })
        .ok_or_else(|| {
            AppError::Auth("Authorization code missing from callback request".to_string())
        })?;

    let html_response = concat!(
        "HTTP/1.1 200 OK\r\n",
        "Content-Type: text/html; charset=utf-8\r\n",
        "Connection: close\r\n\r\n",
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Git Desktop - Authorization Successful</title><style>",
        "* { box-sizing: border-box; margin: 0; padding: 0; }",
        "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0a0e; background-image: radial-gradient(circle at 50% 0%, rgba(224, 86, 56, 0.12) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 50%); color: #e6e4e8; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; user-select: none; }",
        ".auth-card { background: #111013; border: 1px solid #29272b; border-radius: 12px; box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04); width: 100%; max-width: 440px; padding: 36px 32px 28px; text-align: center; }",
        ".icon-wrapper { width: 64px; height: 64px; margin: 0 auto 20px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: center; }",
        ".icon-svg { width: 30px; height: 30px; color: #10b981; }",
        "h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }",
        "p.subtitle { font-size: 13.5px; color: #b3b0b8; line-height: 1.5; margin-bottom: 24px; }",
        ".detail-box { background: #070708; border: 1px solid #201e22; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; text-align: left; }",
        ".detail-label { font-size: 12px; color: #85818c; }",
        ".detail-val { font-size: 12px; font-weight: 600; color: #10b981; display: flex; align-items: center; gap: 5px; font-family: monospace; }",
        ".progress-bar-wrap { width: 100%; height: 3px; background: #201e22; border-radius: 2px; overflow: hidden; margin-bottom: 12px; }",
        ".progress-bar { height: 100%; background: #e05638; width: 100%; animation: shrinkProgress 1.6s linear forwards; }",
        "@keyframes shrinkProgress { from { width: 100%; } to { width: 0%; } }",
        ".hint-text { font-size: 11px; color: #85818c; margin-bottom: 18px; }",
        ".btn-return { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px 16px; background: #e05638; color: #ffffff; font-size: 13px; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; }",
        ".btn-return:hover { background: #f06344; }",
        "</style></head><body><div class=\"auth-card\"><div class=\"icon-wrapper\"><svg class=\"icon-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6L9 17l-5-5\"/></svg></div><h1>Authentication Successful</h1><p class=\"subtitle\">Your account has been connected and security credentials have been stored in your OS keyring.</p><div class=\"detail-box\"><span class=\"detail-label\">Session Status</span><span class=\"detail-val\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"></polyline></svg>Verified</span></div><div class=\"progress-bar-wrap\"><div class=\"progress-bar\"></div></div><p class=\"hint-text\">This window will close automatically in a moment.</p><button class=\"btn-return\" onclick=\"window.close()\"><span>Close Window</span></button></div><script>setTimeout(function(){window.close()},1600);</script></body></html>"
    );
    let _ = stream.write_all(html_response.as_bytes()).await;
    let _ = stream.flush().await;



    let token_resp = exchange_code_for_token_response(
        &server_url,
        &client_id,
        client_secret.as_deref(),
        &code,
        &verifier,
        &redirect_uri,
    )
    .await?;

    let client = GitLabClient::new(server_url.clone(), token_resp.access_token.clone(), None)?;
    let user = client.get_current_user().await?;

    let scopes_list = token_resp.scope.as_ref().map(|s| {
        s.split_whitespace()
            .map(|x| x.to_string())
            .collect::<Vec<String>>()
    });

    let expires_at = token_resp
        .expires_in
        .map(|exp| chrono::Utc::now().timestamp() + exp);

    let account_id = crate::auth::keyring::make_account_id(&user.username, &server_url);
    let account = crate::auth::keyring::SavedAccount {
        id: account_id.clone(),
        server_url: server_url.clone(),
        token: token_resp.access_token.clone(),
        name: user.name.clone(),
        username: user.username.clone(),
        email: user.email.clone(),
        avatar_url: user.avatar_url.clone(),
        is_active: true,
        provider: "gitlab".to_string(),
        refresh_token: token_resp.refresh_token.clone(),
        expires_at,
        scopes: scopes_list,
        created_at: Some(chrono::Utc::now().timestamp()),
    };

    crate::auth::keyring::add_or_update_account(account)?;
    crate::auth::keyring::switch_active_account(&account_id)?;
    crate::auth::keyring::save_token(&token_resp.access_token)?;
    crate::auth::keyring::save_server_url(&server_url)?;

    use tauri::Emitter;
    let _ = app_handle.emit("oauth-success", &user);

    Ok(user)
}

pub async fn exchange_code_for_token_response(
    server_url: &str,
    client_id: &str,
    client_secret: Option<&str>,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<OAuthTokenResponse, AppError> {
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
        let token_resp: OAuthTokenResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse token response: {}", e)))?;
        return Ok(token_resp);
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
            let token_resp: OAuthTokenResponse = resp2
                .json()
                .await
                .map_err(|e| AppError::Auth(format!("Failed to parse token response: {}", e)))?;
            return Ok(token_resp);
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

pub async fn exchange_code_for_token(
    server_url: &str,
    client_id: &str,
    client_secret: Option<&str>,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<String, AppError> {
    let resp = exchange_code_for_token_response(
        server_url,
        client_id,
        client_secret,
        code,
        verifier,
        redirect_uri,
    )
    .await?;
    Ok(resp.access_token)
}

pub async fn refresh_oauth_token(
    server_url: &str,
    client_id: &str,
    client_secret: Option<&str>,
    refresh_token: &str,
) -> Result<OAuthTokenResponse, AppError> {
    let clean_url = server_url.trim_end_matches('/');
    let token_url = format!("{}/oauth/token", clean_url);
    let clean_cid = client_id.trim();

    let client = reqwest::Client::new();
    let mut params = vec![
        ("client_id", clean_cid.to_string()),
        ("grant_type", "refresh_token".to_string()),
        ("refresh_token", refresh_token.trim().to_string()),
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
            AppError::Auth(format!("Failed to parse refreshed token response: {}", e))
        })?;
        return Ok(token_resp);
    }

    let err_text = resp.text().await.unwrap_or_default();
    Err(AppError::Auth(format!(
        "OAuth token refresh failed: {}",
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
pub struct MergeRequestAuthor {
    pub name: Option<String>,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergeRequestLabel {
    pub name: String,
    pub color: Option<String>,
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
    pub author: Option<MergeRequestAuthor>,
    pub assignees: Option<Vec<MergeRequestAuthor>>,
    pub reviewers: Option<Vec<MergeRequestAuthor>>,
    pub labels: Option<Vec<MergeRequestLabel>>,
    pub milestone: Option<String>,
    pub is_draft: Option<bool>,
}

pub struct GitLabClient {
    client: reqwest::Client,
    server_url: String,
    _token: String,
}

impl GitLabClient {
    pub fn new(
        server_url: String,
        token: String,
        custom_ca_pem: Option<String>,
    ) -> Result<Self, AppError> {
        let clean_url = server_url.trim_end_matches('/').to_string();
        let mut builder = reqwest::Client::builder();

        if let Some(ca_pem) = custom_ca_pem {
            if !ca_pem.trim().is_empty() {
                let cert = reqwest::Certificate::from_pem(ca_pem.as_bytes()).map_err(|e| {
                    AppError::Validation(format!("Invalid custom CA certificate PEM: {}", e))
                })?;
                builder = builder.add_root_certificate(cert);
            }
        }

        let mut headers = HeaderMap::new();
        if let Ok(val) = HeaderValue::from_str(&token) {
            headers.insert(HeaderName::from_static("private-token"), val);
        }
        let auth_val = format!("Bearer {}", token);
        if let Ok(val) = HeaderValue::from_str(&auth_val) {
            headers.insert(AUTHORIZATION, val);
        }
        headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop/1.0"));
        headers.insert(
            reqwest::header::ACCEPT,
            HeaderValue::from_static("application/json"),
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
                return Err(AppError::Auth(
                    "Invalid GitLab Personal Access Token or OAuth token.".to_string(),
                ));
            }
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to fetch GitLab user: {}",
                err_text
            )));
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

        let raw: RawUser = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse user JSON: {}", e)))?;

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

    pub async fn get_token_info(&self) -> Result<TokenInfo, AppError> {
        let url = format!("{}/oauth/token/info", self.server_url);
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to fetch token info: {}",
                err_text
            )));
        }

        #[derive(Deserialize)]
        struct RawTokenInfo {
            scope: Option<Vec<String>>,
            scopes: Option<Vec<String>>,
            created_at: Option<i64>,
            expires_in: Option<i64>,
            expires_in_seconds: Option<i64>,
            resource_owner_id: Option<u64>,
        }

        let raw: RawTokenInfo = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse token info JSON: {}", e)))?;

        let scopes_list = raw.scopes.or(raw.scope).unwrap_or_default();
        let expires_in_seconds = raw.expires_in.or(raw.expires_in_seconds);

        Ok(TokenInfo {
            scope: scopes_list,
            created_at: raw.created_at,
            expires_in_seconds,
            resource_owner_id: raw.resource_owner_id,
        })
    }

    pub async fn fetch_projects(&self, page: u32) -> Result<PagedResult<GitLabProject>, AppError> {
        let url = format!(
            "{}/api/v4/projects?membership=true&order_by=updated_at&per_page=30&page={}",
            self.server_url, page
        );
        let mut resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            let fallback_url = format!(
                "{}/api/v4/projects?min_access_level=10&order_by=updated_at&per_page=30&page={}",
                self.server_url, page
            );
            resp = self.client.get(&fallback_url).send().await?;
        }

        if !resp.status().is_success() {
            let fallback_url2 = format!(
                "{}/api/v4/projects?owned=true&order_by=updated_at&per_page=30&page={}",
                self.server_url, page
            );
            resp = self.client.get(&fallback_url2).send().await?;
        }

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!(
                "Failed to fetch projects: {}",
                err_text
            )));
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

    pub async fn get_open_merge_requests(
        &self,
        project_id: &str,
    ) -> Result<Vec<MergeRequest>, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests?state=opened",
            self.server_url, encoded_id
        );
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            return Err(AppError::Network(format!(
                "Failed to fetch merge requests (Status {})",
                resp.status()
            )));
        }

        let raw_mrs: Vec<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse MRs JSON: {}", e)))?;

        let mut results = Vec::new();
        for item in raw_mrs {
            let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
            let iid = item.get("iid").and_then(|v| v.as_u64()).unwrap_or(id);
            let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let description = item.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
            let state = item.get("state").and_then(|v| v.as_str()).unwrap_or("opened").to_string();
            let source_branch = item.get("source_branch").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let target_branch = item.get("target_branch").and_then(|v| v.as_str()).unwrap_or("main").to_string();
            let web_url = item.get("web_url").and_then(|v| v.as_str()).unwrap_or("#").to_string();
            let created_at = item.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string();

            let author = item.get("author").map(|u| {
                let username = u.get("username").and_then(|v| v.as_str()).map(|s| s.to_string());
                let name = u.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
                let avatar_url = u.get("avatar_url").and_then(|v| v.as_str()).map(|s| s.to_string());
                MergeRequestAuthor { name, username, avatar_url }
            });

            let mut assignees = Vec::new();
            if let Some(arr) = item.get("assignees").and_then(|v| v.as_array()) {
                for u in arr {
                    let username = u.get("username").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let name = u.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let avatar_url = u.get("avatar_url").and_then(|v| v.as_str()).map(|s| s.to_string());
                    assignees.push(MergeRequestAuthor { name, username, avatar_url });
                }
            }

            let mut reviewers = Vec::new();
            if let Some(arr) = item.get("reviewers").and_then(|v| v.as_array()) {
                for u in arr {
                    let username = u.get("username").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let name = u.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let avatar_url = u.get("avatar_url").and_then(|v| v.as_str()).map(|s| s.to_string());
                    reviewers.push(MergeRequestAuthor { name, username, avatar_url });
                }
            }

            let mut labels = Vec::new();
            if let Some(arr) = item.get("labels").and_then(|v| v.as_array()) {
                for l in arr {
                    if let Some(name) = l.as_str() {
                        labels.push(MergeRequestLabel { name: name.to_string(), color: None });
                    } else if let Some(name) = l.get("name").and_then(|v| v.as_str()) {
                        let color = l.get("color").and_then(|v| v.as_str()).map(|s| s.to_string());
                        labels.push(MergeRequestLabel { name: name.to_string(), color });
                    }
                }
            }

            let milestone = item.get("milestone").and_then(|m| m.get("title")).and_then(|v| v.as_str()).map(|s| s.to_string());
            let is_draft = item.get("draft").and_then(|v| v.as_bool()).or_else(|| item.get("work_in_progress").and_then(|v| v.as_bool())).unwrap_or(false);

            results.push(MergeRequest {
                id: iid,
                iid,
                title,
                description,
                state,
                source_branch,
                target_branch,
                web_url,
                created_at,
                author,
                assignees: Some(assignees),
                reviewers: Some(reviewers),
                labels: Some(labels),
                milestone,
                is_draft: Some(is_draft),
            });
        }

        Ok(results)
    }

    pub async fn create_merge_request(
        &self,
        project_id: &str,
        source_branch: &str,
        target_branch: &str,
        title: &str,
    ) -> Result<MergeRequest, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests",
            self.server_url, encoded_id
        );

        let payload = serde_json::json!({
            "source_branch": source_branch,
            "target_branch": target_branch,
            "title": title,
        });

        let resp = self.client.post(&url).json(&payload).send().await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            let clean_msg = if let Ok(val) = serde_json::from_str::<serde_json::Value>(&err_text) {
                if let Some(m) = val.get("message").and_then(|m| m.as_str()) {
                    m.to_string()
                } else if let Some(m) = val.get("error").and_then(|m| m.as_str()) {
                    m.to_string()
                } else {
                    err_text
                }
            } else {
                err_text
            };

            return Err(AppError::Network(clean_msg));
        }

        let mr: MergeRequest = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse created MR JSON: {}", e)))?;

        Ok(mr)
    }

    pub async fn update_merge_request(
        &self,
        project_id: &str,
        mr_iid: u64,
        title: Option<&str>,
        description: Option<&str>,
        target_branch: Option<&str>,
        state_event: Option<&str>,
    ) -> Result<MergeRequest, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}",
            self.server_url, encoded_id, mr_iid
        );

        let mut payload = serde_json::Map::new();
        if let Some(t) = title {
            payload.insert("title".to_string(), serde_json::json!(t.trim()));
        }
        if let Some(d) = description {
            payload.insert("description".to_string(), serde_json::json!(d.trim()));
        }
        if let Some(tb) = target_branch {
            payload.insert("target_branch".to_string(), serde_json::json!(tb.trim()));
        }
        if let Some(se) = state_event {
            payload.insert("state_event".to_string(), serde_json::json!(se.trim()));
        }

        let resp = self
            .client
            .put(&url)
            .json(&serde_json::Value::Object(payload))
            .send()
            .await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            let clean_msg = if let Ok(val) = serde_json::from_str::<serde_json::Value>(&err_text) {
                if let Some(m) = val.get("message").and_then(|m| m.as_str()) {
                    m.to_string()
                } else if let Some(m) = val.get("error").and_then(|m| m.as_str()) {
                    m.to_string()
                } else {
                    err_text
                }
            } else {
                err_text
            };

            return Err(AppError::Network(clean_msg));
        }

        let mr: MergeRequest = resp
            .json()
            .await
            .map_err(|e| AppError::Network(format!("Failed to parse updated MR JSON: {}", e)))?;

        Ok(mr)
    }

    pub async fn get_merge_request_comments(
        &self,
        project_id: &str,
        mr_iid: u64,
    ) -> Result<Vec<crate::auth::github::PullRequestComment>, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!("{}/api/v4/projects/{}/merge_requests/{}/notes?sort=asc", self.server_url, encoded_id, mr_iid);
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Ok(Vec::new());
        }

        let arr: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
        let mut comments = Vec::new();
        for item in arr {
            let is_system = item.get("system").and_then(|v| v.as_bool()).unwrap_or(false);
            if is_system { continue; }
            let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
            let body = item.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let created_at = item.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let author = item.get("author");
            let author_username = author
                .and_then(|u| u.get("username"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let author_name = author
                .and_then(|u| u.get("name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| author_username.clone());
            let author_avatar = author
                .and_then(|u| u.get("avatar_url"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            comments.push(crate::auth::github::PullRequestComment {
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

    pub async fn add_merge_request_comment(
        &self,
        project_id: &str,
        mr_iid: u64,
        body: &str,
    ) -> Result<crate::auth::github::PullRequestComment, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!("{}/api/v4/projects/{}/merge_requests/{}/notes", self.server_url, encoded_id, mr_iid);
        let req_body = serde_json::json!({ "body": body.trim() });
        let resp = self.client.post(&url).json(&req_body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to post note: {}", err_text)));
        }

        let item: serde_json::Value = resp.json().await.map_err(|e| AppError::Network(e.to_string()))?;
        let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
        let body = item.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let created_at = item.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let author = item.get("author");
        let author_username = author
            .and_then(|u| u.get("username"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let author_name = author
            .and_then(|u| u.get("name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| author_username.clone());
        let author_avatar = author
            .and_then(|u| u.get("avatar_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(crate::auth::github::PullRequestComment {
            id,
            author_name,
            author_username,
            author_avatar,
            body,
            created_at,
        })
    }

    pub async fn merge_merge_request(
        &self,
        project_id: &str,
        mr_iid: u64,
        squash: Option<bool>,
        should_remove_source_branch: Option<bool>,
        commit_message: Option<&str>,
    ) -> Result<bool, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}/merge",
            self.server_url, encoded_id, mr_iid
        );
        let mut payload = serde_json::Map::new();
        if let Some(sq) = squash {
            payload.insert("squash".to_string(), serde_json::json!(sq));
        }
        if let Some(rm) = should_remove_source_branch {
            payload.insert("should_remove_source_branch".to_string(), serde_json::json!(rm));
        }
        if let Some(msg) = commit_message {
            payload.insert("merge_commit_message".to_string(), serde_json::json!(msg));
        }

        let resp = self.client.put(&url).json(&serde_json::Value::Object(payload)).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to merge merge request: {}", err_text)));
        }
        Ok(true)
    }

    pub async fn edit_merge_request_comment(
        &self,
        project_id: &str,
        mr_iid: u64,
        note_id: u64,
        body: &str,
    ) -> Result<crate::auth::github::PullRequestComment, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}/notes/{}",
            self.server_url, encoded_id, mr_iid, note_id
        );
        let req_body = serde_json::json!({ "body": body.trim() });
        let resp = self.client.put(&url).json(&req_body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to edit note: {}", err_text)));
        }
        let item: serde_json::Value = resp.json().await.map_err(|e| AppError::Network(e.to_string()))?;
        let id = item.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
        let body = item.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let created_at = item.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let author = item.get("author");
        let author_username = author
            .and_then(|u| u.get("username"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let author_name = author
            .and_then(|u| u.get("name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| author_username.clone());
        let author_avatar = author
            .and_then(|u| u.get("avatar_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(crate::auth::github::PullRequestComment {
            id,
            author_name,
            author_username,
            author_avatar,
            body,
            created_at,
        })
    }

    pub async fn delete_merge_request_comment(
        &self,
        project_id: &str,
        mr_iid: u64,
        note_id: u64,
    ) -> Result<bool, AppError> {
        let encoded_id = urlencoding::encode(project_id);
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}/notes/{}",
            self.server_url, encoded_id, mr_iid, note_id
        );
        let resp = self.client.delete(&url).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Network(format!("Failed to delete note: {}", err_text)));
        }
        Ok(true)
    }

    pub async fn create_project(
        &self,
        name: &str,
        is_private: bool,
        description: Option<&str>,
    ) -> Result<GitLabProject, AppError> {
        let url = format!("{}/api/v4/projects", self.server_url);
        let visibility = if is_private { "private" } else { "public" };

        let mut body = serde_json::json!({
            "name": name,
            "visibility": visibility,
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
                "Failed to create GitLab project: {}",
                err_text
            )));
        }

        let project: GitLabProject = resp.json().await.map_err(|e| {
            AppError::Network(format!("Failed to parse project response JSON: {}", e))
        })?;

        Ok(project)
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
