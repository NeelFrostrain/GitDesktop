use crate::domain::accounts::active_account;
use crate::domain::accounts::oauth_pkce;
use crate::domain::accounts::provider::{
    AccountPatch, AuthProvider, ProviderAccount, ProviderKind, TokenStatus,
};
use crate::domain::accounts::token_store;
use crate::error::AppError;
use crate::integrations::bitbucket::auth::BitbucketAuthProvider;
use crate::integrations::github::auth::GitHubAuthProvider;
use crate::integrations::gitlab::auth::GitLabAuthProvider;

use tauri::command;
use tauri_plugin_opener::OpenerExt;

#[command]
pub async fn accounts_list() -> Result<Vec<ProviderAccount>, AppError> {
    tokio::task::spawn_blocking(token_store::list_accounts)
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))
}

#[command]
pub async fn accounts_set_active(
    account_id: String,
    active_repo_path: Option<String>,
) -> Result<(), AppError> {
    let aid = account_id.clone();
    let repo_path = active_repo_path.clone();
    tokio::task::spawn_blocking(move || {
        active_account::set_active_and_sync_git(&aid, repo_path.as_deref())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Switched active account to {}", account_id);
        repo_id: active_repo_path,
        meta: serde_json::json!({ "account_id": account_id })
    );

    Ok(())
}

#[command]
pub async fn accounts_update(
    account_id: String,
    patch: AccountPatch,
) -> Result<ProviderAccount, AppError> {
    let aid = account_id.clone();
    let res = tokio::task::spawn_blocking(move || token_store::update_account(&aid, patch))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Updated account settings for {}", res.handle);
        meta: serde_json::json!({ "account_id": account_id, "handle": res.handle })
    );

    Ok(res)
}

#[command]
pub async fn accounts_remove(account_id: String) -> Result<(), AppError> {
    let aid = account_id.clone();
    tokio::task::spawn_blocking(move || {
        let accounts = token_store::list_accounts();
        if let Some(acc) = accounts.iter().find(|a| a.id == aid) {
            // Revoke on remote where supported
            match acc.provider {
                ProviderKind::Gitlab => {
                    let provider = GitLabAuthProvider;
                    let _ = tokio::runtime::Handle::current().block_on(provider.revoke_token(acc));
                }
                ProviderKind::Github => {
                    let provider = GitHubAuthProvider;
                    let _ = tokio::runtime::Handle::current().block_on(provider.revoke_token(acc));
                }
                ProviderKind::Bitbucket => {
                    let provider = BitbucketAuthProvider;
                    let _ = tokio::runtime::Handle::current().block_on(provider.revoke_token(acc));
                }
                ProviderKind::Azure => {}
            }
        }
        token_store::remove_account(&aid)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Removed account {}", account_id);
        meta: serde_json::json!({ "account_id": account_id })
    );

    Ok(())
}

#[command]
pub async fn accounts_start_oauth(
    app: tauri::AppHandle,
    provider: String,
    instance_url: Option<String>,
) -> Result<(), AppError> {
    let url = match provider.to_lowercase().as_str() {
        "gitlab" => {
            let p = GitLabAuthProvider;
            let target = instance_url
                .clone()
                .unwrap_or_else(|| p.default_instance_url().to_string());
            p.start_oauth(&target)?
        }
        "github" => {
            let p = GitHubAuthProvider;
            let target = instance_url
                .clone()
                .unwrap_or_else(|| p.default_instance_url().to_string());
            p.start_oauth(&target)?
        }
        "bitbucket" => {
            let p = BitbucketAuthProvider;
            let target = instance_url
                .clone()
                .unwrap_or_else(|| p.default_instance_url().to_string());
            p.start_oauth(&target)?
        }
        "azure" => {
            return Err(AppError::Validation(
                "Azure DevOps authenticates using Personal Access Tokens (PAT). Please click 'Use Token' to connect your account.".to_string(),
            ));
        }
        _ => {
            return Err(AppError::Validation(format!(
                "Unsupported provider '{}'",
                provider
            )))
        }
    };

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Started OAuth sign-in for {}", provider);
        meta: serde_json::json!({ "provider": provider, "instance_url": instance_url })
    );

    // Spawn background loopback listener to automatically capture authorization code without user manual copy-paste
    let app_handle_bg = app.clone();
    let prov_bg = provider.clone();
    let instance_url_bg = instance_url.clone();

    tokio::spawn(async move {
        use tauri::Emitter;
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::TcpListener;

        let port = crate::core::config::get_env_var("VITE_OAUTH_LOOPBACK_PORT")
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(8585);

        if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            let start = std::time::Instant::now();
            let timeout = std::time::Duration::from_secs(120);

            while start.elapsed() < timeout {
                let remaining = timeout.saturating_sub(start.elapsed());
                let accept_res = tokio::time::timeout(remaining, listener.accept()).await;
                let (mut stream, _) = match accept_res {
                    Ok(Ok(s)) => s,
                    _ => break,
                };

                let mut buffer = [0u8; 4096];
                if let Ok(bytes_read) = stream.read(&mut buffer).await {
                    let req_str = String::from_utf8_lossy(&buffer[..bytes_read]);
                    if let Some(first_line) = req_str.lines().next() {
                        if let Some(path) = first_line.split_whitespace().nth(1) {
                            if path.starts_with("/favicon.ico") {
                                let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n").await;
                                continue;
                            }

                            let dummy_url = format!("http://127.0.0.1:{}{}", port, path);
                            if let Ok(parsed) = url::Url::parse(&dummy_url) {
                                let code_opt = parsed
                                    .query_pairs()
                                    .find(|(k, _)| k == "code")
                                    .map(|(_, v)| v.to_string());
                                let state_opt = parsed
                                    .query_pairs()
                                    .find(|(k, _)| k == "state")
                                    .map(|(_, v)| v.to_string());
                                let error_opt = parsed
                                    .query_pairs()
                                    .find(|(k, _)| k == "error" || k == "error_description")
                                    .map(|(_, v)| v.to_string());

                                if let Some(err_msg) = error_opt {
                                    let html_err = concat!(
                                            "HTTP/1.1 200 OK\r\n",
                                            "Content-Type: text/html; charset=utf-8\r\n",
                                            "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\n",
                                            "Connection: close\r\n\r\n",
                                            "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Authentication Error</title><style>",
                                            "* {{ box-sizing: border-box; margin: 0; padding: 0; }}",
                                            "body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0a0e; color: #e6e4e8; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }}",
                                            ".auth-card {{ background: #111013; border: 1px solid #dc2626; border-radius: 12px; max-width: 440px; padding: 36px 32px 28px; text-align: center; }}",
                                            "h1 {{ font-size: 20px; color: #ef4444; margin-bottom: 8px; }}",
                                            "p {{ font-size: 13px; color: #b3b0b8; line-height: 1.5; margin-bottom: 20px; }}",
                                            ".btn-return {{ display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 10px 16px; background: #dc2626; color: #ffffff; font-size: 13px; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; }}",
                                            "</style></head><body><div class=\"auth-card\"><h1>Authentication Failed</h1><p>Please return to Git Desktop and try again.</p></div></body></html>"
                                    );
                                    let _ = stream.write_all(html_err.as_bytes()).await;
                                    let _ = stream.flush().await;

                                    crate::log_error!(
                                        crate::core::logging::LogCategory::Account,
                                        format!("OAuth callback reported error: {}", err_msg)
                                    );
                                    let _ = app_handle_bg.emit("oauth-account-error", err_msg);
                                    break;
                                }

                                if let Some(code) = code_opt {
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

                                    match accounts_exchange_oauth_code(
                                        prov_bg,
                                        code,
                                        state_opt,
                                        instance_url_bg,
                                    )
                                    .await
                                    {
                                        Ok(account) => {
                                            crate::log_info!(
                                                crate::core::logging::LogCategory::Account,
                                                format!("OAuth loopback sign-in succeeded for {}", account.handle)
                                            );
                                            let _ = app_handle_bg.emit("oauth-account-synced", &account);
                                        }
                                        Err(err) => {
                                            crate::log_error!(
                                                crate::core::logging::LogCategory::Account,
                                                format!("OAuth loopback exchange failed: {}", err)
                                            );
                                            let _ = app_handle_bg.emit("oauth-account-error", err.to_string());
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| AppError::Unknown(format!("Failed to open system browser: {}", e)))?;

    Ok(())
}

#[command]
pub async fn accounts_exchange_oauth_code(
    provider: String,
    code: String,
    state: Option<String>,
    _instance_url: Option<String>,
) -> Result<ProviderAccount, AppError> {
    let prov = provider.to_lowercase();
    let state = state
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::Validation("Missing OAuth state".to_string()))?;
    let session = oauth_pkce::take_valid_pkce_session(&state, &prov)
        .ok_or_else(|| AppError::Validation("Invalid, expired, or mismatched OAuth state".to_string()))?;
    let target_url = session.instance_url;
    let verifier = session.verifier;
    let redirect_uri = Some(session.redirect_uri);

    let account = match prov.as_str() {
        "github" => {
            let p = GitHubAuthProvider;
            p.exchange_code_with_redirect(&target_url, &code, &verifier, redirect_uri.as_deref()).await?
        }
        "gitlab" => {
            let p = GitLabAuthProvider;
            p.exchange_code_with_redirect(&target_url, &code, &verifier, redirect_uri.as_deref()).await?
        }
        "bitbucket" => {
            let p = BitbucketAuthProvider;
            p.exchange_code_with_redirect(&target_url, &code, &verifier, redirect_uri.as_deref()).await?
        }
        _ => {
            return Err(AppError::Validation(format!(
                "Unsupported provider '{}'",
                provider
            )))
        }
    };

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Successfully authenticated {} account {}", provider, account.handle);
        meta: serde_json::json!({ "account_id": account.id, "provider": provider })
    );

    Ok(account)
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize)]
struct GitLabTokenUser {
    id: u64,
    username: String,
    name: String,
    email: Option<String>,
    avatar_url: Option<String>,
    web_url: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize)]
struct GitHubTokenUser {
    id: u64,
    login: String,
    name: Option<String>,
    email: Option<String>,
    avatar_url: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize)]
struct GitHubEmailItem {
    email: String,
    primary: bool,
    verified: bool,
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize)]
struct BitbucketTokenUser {
    #[serde(default)]
    uuid: String,
    username: Option<String>,
    nickname: Option<String>,
    display_name: Option<String>,
    links: Option<BitbucketLinksToken>,
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize, Default)]
struct BitbucketLinksToken {
    avatar: Option<BitbucketAvatarHref>,
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize, Default)]
struct BitbucketAvatarHref {
    href: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize)]
struct BitbucketEmailsTokenResponse {
    values: Option<Vec<BitbucketEmailTokenItem>>,
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize)]
struct BitbucketEmailTokenItem {
    email: String,
    is_primary: Option<bool>,
    is_confirmed: Option<bool>,
}

#[command]
pub async fn accounts_connect_with_token(
    provider: String,
    token: String,
    instance_url: Option<String>,
    username: Option<String>,
) -> Result<ProviderAccount, AppError> {
    use base64::Engine;
    use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};

    let prov = provider.to_lowercase();
    let token = token.trim();
    if token.is_empty() {
        return Err(AppError::Validation("Token cannot be empty".to_string()));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| AppError::Unknown(e.to_string()))?;

    let account = match prov.as_str() {
        "gitlab" => {
            let base_url = instance_url
                .filter(|u| !u.trim().is_empty())
                .unwrap_or_else(|| "https://gitlab.com".to_string());
            let clean_url = base_url.trim_end_matches('/').to_string();

            let mut headers = HeaderMap::new();
            headers.insert(
                "PRIVATE-TOKEN",
                HeaderValue::from_str(token)
                    .map_err(|_| AppError::Validation("Invalid characters in token".to_string()))?,
            );
            headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));

            let user_url = format!("{}/api/v4/user", clean_url);
            let resp = client
                .get(&user_url)
                .headers(headers)
                .send()
                .await
                .map_err(|e| AppError::Auth(format!("Failed to connect to GitLab at {}: {}", clean_url, e)))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(AppError::Auth(format!(
                    "GitLab authentication failed (HTTP {}): {}",
                    status,
                    if body.is_empty() { "Check your Personal Access Token and instance URL" } else { &body }
                )));
            }

            let user: GitLabTokenUser = resp.json().await.map_err(|e| {
                AppError::Auth(format!("Failed to parse GitLab user profile: {}", e))
            })?;

            let host = url::Url::parse(&clean_url)
                .map(|u| u.host_str().unwrap_or("gitlab.com").to_string())
                .unwrap_or_else(|_| "gitlab.com".to_string());

            let account_id = format!("gitlab:{}:{}", host, user.id);
            let handle = if user.username.starts_with('@') {
                user.username.clone()
            } else {
                format!("@{}", user.username)
            };

            let acc = ProviderAccount {
                id: account_id,
                provider: ProviderKind::Gitlab,
                instance_url: clean_url,
                handle,
                display_name: if !user.name.is_empty() {
                    user.name
                } else {
                    user.username.clone()
                },
                avatar_url: user.avatar_url.unwrap_or_default(),
                commit_email: user.email.unwrap_or_default(),
                is_active: false,
                token_status: TokenStatus::Valid,
                scopes: vec![
                    "api".to_string(),
                    "read_user".to_string(),
                    "write_repository".to_string(),
                    "read_repository".to_string(),
                ],
                expires_at: None,
                refresh_token_expires_at: None,
            };

            token_store::save_account(acc.clone(), token, None)?;
            acc
        }
        "github" => {
            let base_url = instance_url
                .filter(|u| !u.trim().is_empty())
                .unwrap_or_else(|| "https://github.com".to_string());
            let clean_url = base_url.trim_end_matches('/').to_string();

            let api_base = if clean_url.contains("github.com") {
                "https://api.github.com".to_string()
            } else {
                format!("{}/api/v3", clean_url)
            };

            let mut headers = HeaderMap::new();
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", token))
                    .map_err(|_| AppError::Validation("Invalid characters in token".to_string()))?,
            );
            headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));
            headers.insert(ACCEPT, HeaderValue::from_static("application/vnd.github.v3+json"));

            let user_url = format!("{}/user", api_base);
            let resp = client
                .get(&user_url)
                .headers(headers.clone())
                .send()
                .await
                .map_err(|e| AppError::Auth(format!("Failed to connect to GitHub at {}: {}", clean_url, e)))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(AppError::Auth(format!(
                    "GitHub authentication failed (HTTP {}): {}",
                    status,
                    if body.is_empty() { "Check your Personal Access Token and scopes" } else { &body }
                )));
            }

            let scopes_header = resp
                .headers()
                .get("x-oauth-scopes")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("repo, read:user, user:email");

            let scopes_vec: Vec<String> = scopes_header
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            let user: GitHubTokenUser = resp.json().await.map_err(|e| {
                AppError::Auth(format!("Failed to parse GitHub user profile: {}", e))
            })?;

            let mut user_email = user.email.unwrap_or_default();
            if user_email.is_empty() {
                if let Ok(emails_resp) = client
                    .get(format!("{}/user/emails", api_base))
                    .headers(headers)
                    .send()
                    .await
                {
                    if let Ok(emails) = emails_resp.json::<Vec<GitHubEmailItem>>().await {
                        if let Some(primary) = emails.iter().find(|e| e.primary && e.verified).or_else(|| emails.first()) {
                            user_email = primary.email.clone();
                        }
                    }
                }
            }

            let host = url::Url::parse(&clean_url)
                .map(|u| u.host_str().unwrap_or("github.com").to_string())
                .unwrap_or_else(|_| "github.com".to_string());

            let account_id = format!("github:{}:{}", host, user.id);
            let handle = format!("@{}", user.login);

            let acc = ProviderAccount {
                id: account_id,
                provider: ProviderKind::Github,
                instance_url: clean_url,
                handle,
                display_name: user.name.unwrap_or(user.login),
                avatar_url: user.avatar_url.unwrap_or_default(),
                commit_email: user_email,
                is_active: false,
                token_status: TokenStatus::Valid,
                scopes: if scopes_vec.is_empty() {
                    vec!["repo".to_string(), "read:user".to_string(), "user:email".to_string()]
                } else {
                    scopes_vec
                },
                expires_at: None,
                refresh_token_expires_at: None,
            };

            token_store::save_account(acc.clone(), token, None)?;
            acc
        }
        "bitbucket" => {
            let clean_url = "https://bitbucket.org".to_string();
            let mut headers = HeaderMap::new();
            headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));
            headers.insert(ACCEPT, HeaderValue::from_static("application/json"));

            let auth_header = if let Some(ref u) = username.filter(|u| !u.trim().is_empty()) {
                let creds = format!("{}:{}", u.trim(), token);
                let encoded = base64::engine::general_purpose::STANDARD.encode(creds.as_bytes());
                format!("Basic {}", encoded)
            } else {
                format!("Bearer {}", token)
            };

            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&auth_header)
                    .map_err(|_| AppError::Validation("Invalid credentials".to_string()))?,
            );

            let resp = client
                .get("https://api.bitbucket.org/2.0/user")
                .headers(headers.clone())
                .send()
                .await
                .map_err(|e| AppError::Auth(format!("Failed to connect to Bitbucket: {}", e)))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(AppError::Auth(format!(
                    "Bitbucket authentication failed (HTTP {}): {}",
                    status,
                    if body.is_empty() { "Check your Bitbucket username and App Password" } else { &body }
                )));
            }

            let user: BitbucketTokenUser = resp.json().await.map_err(|e| {
                AppError::Auth(format!("Failed to parse Bitbucket user profile: {}", e))
            })?;

            let user_handle = user
                .username
                .or(user.nickname)
                .unwrap_or_else(|| user.uuid.clone());

            let mut user_email = String::new();
            if let Ok(emails_resp) = client
                .get("https://api.bitbucket.org/2.0/user/emails")
                .headers(headers)
                .send()
                .await
            {
                if let Ok(emails_data) = emails_resp.json::<BitbucketEmailsTokenResponse>().await {
                    if let Some(list) = emails_data.values {
                        if let Some(primary) = list.iter().find(|e| e.is_primary == Some(true)).or_else(|| list.first()) {
                            user_email = primary.email.clone();
                        }
                    }
                }
            }

            let avatar_url = user.links.and_then(|l| l.avatar).and_then(|a| a.href).unwrap_or_default();
            let account_id = format!("bitbucket:bitbucket.org:{}", user_handle);

            let acc = ProviderAccount {
                id: account_id,
                provider: ProviderKind::Bitbucket,
                instance_url: clean_url,
                handle: format!("@{}", user_handle),
                display_name: user.display_name.unwrap_or(user_handle),
                avatar_url,
                commit_email: user_email,
                is_active: false,
                token_status: TokenStatus::Valid,
                scopes: vec![
                    "account".to_string(),
                    "repository".to_string(),
                    "pullrequest".to_string(),
                ],
                expires_at: None,
                refresh_token_expires_at: None,
            };

            token_store::save_account(acc.clone(), token, None)?;
            acc
        }
        "azure" => {
            let clean_url = instance_url
                .filter(|u| !u.trim().is_empty())
                .unwrap_or_else(|| "https://dev.azure.com".to_string())
                .trim_end_matches('/')
                .to_string();

            let mut headers = HeaderMap::new();
            headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));
            headers.insert(ACCEPT, HeaderValue::from_static("application/json"));

            let auth_str = format!(":{}", token.trim());
            let encoded = base64::engine::general_purpose::STANDARD.encode(auth_str.as_bytes());
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Basic {}", encoded))
                    .map_err(|_| AppError::Validation("Invalid token".to_string()))?,
            );

            // Fetch user profile from Azure DevOps
            let profile_url = "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1-preview.1";
            let profile_resp = client
                .get(profile_url)
                .headers(headers.clone())
                .send()
                .await;

            let (user_handle, display_name, email_str) = if let Ok(resp) = profile_resp {
                if resp.status().is_success() {
                    let v: serde_json::Value = resp.json().await.unwrap_or_default();
                    let d_name = v.get("displayName").and_then(|s| s.as_str()).unwrap_or("Azure User").to_string();
                    let p_alias = v.get("publicAlias").and_then(|s| s.as_str()).map(|s| s.to_string());
                    let email = v.get("emailAddress").and_then(|s| s.as_str()).unwrap_or("").to_string();
                    let handle = p_alias.unwrap_or_else(|| {
                        if !email.is_empty() {
                            email.split('@').next().unwrap_or("azure_user").to_string()
                        } else {
                            username.clone().filter(|u| !u.trim().is_empty()).unwrap_or_else(|| "azure_user".to_string())
                        }
                    });
                    (handle, d_name, email)
                } else {
                    let u_h = username.clone().filter(|u| !u.trim().is_empty()).unwrap_or_else(|| "azure_user".to_string());
                    (u_h.clone(), u_h, "".to_string())
                }
            } else {
                let u_h = username.clone().filter(|u| !u.trim().is_empty()).unwrap_or_else(|| "azure_user".to_string());
                (u_h.clone(), u_h, "".to_string())
            };

            let account_id = format!("azure:dev.azure.com:{}", user_handle);

            let acc = ProviderAccount {
                id: account_id,
                provider: ProviderKind::Azure,
                instance_url: clean_url,
                handle: format!("@{}", user_handle),
                display_name,
                avatar_url: "".to_string(),
                commit_email: email_str,
                is_active: false,
                token_status: TokenStatus::Valid,
                scopes: vec![
                    "vso.code_full".to_string(),
                    "vso.project".to_string(),
                ],
                expires_at: None,
                refresh_token_expires_at: None,
            };

            token_store::save_account(acc.clone(), token, None)?;
            acc
        }
        _ => {
            return Err(AppError::Validation(format!(
                "Unsupported provider '{}'",
                provider
            )))
        }
    };

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Successfully added {} account via personal token: {}", provider, account.handle);
        meta: serde_json::json!({ "account_id": account.id, "provider": provider })
    );

    Ok(account)
}
