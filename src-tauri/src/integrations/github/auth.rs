use crate::core::config;
use crate::domain::accounts::oauth_pkce;
use crate::domain::accounts::provider::{AuthProvider, ProviderAccount, ProviderKind, TokenStatus};
use crate::error::AppError;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::Deserialize;

pub const GITHUB_DEFAULT_CLIENT_ID: &str = "Ov23lip7lnwBjoVPBlzU";
pub const GITHUB_DEFAULT_REDIRECT_URI: &str = "http://127.0.0.1:8585/oauth/callback";

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: String,
    token_type: String,
    scope: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    refresh_token_expires_in: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GitHubUserResponse {
    id: u64,
    login: String,
    name: Option<String>,
    email: Option<String>,
    avatar_url: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GitHubEmailResponse {
    email: String,
    primary: bool,
    verified: bool,
}

pub struct GitHubAuthProvider;

impl GitHubAuthProvider {
    pub fn get_client_id(&self) -> String {
        config::get_env_var("VITE_GITHUB_CLIENT_ID")
            .unwrap_or_else(|| GITHUB_DEFAULT_CLIENT_ID.to_string())
    }

    pub fn get_client_secret(&self) -> Option<String> {
        config::get_env_var("VITE_GITHUB_CLIENT_SECRET")
    }

    pub fn get_redirect_uri(&self) -> String {
        config::get_env_var("VITE_GITHUB_REDIRECT_URI")
            .unwrap_or_else(|| GITHUB_DEFAULT_REDIRECT_URI.to_string())
    }

    pub fn get_scopes(&self) -> String {
        config::get_env_var("VITE_GITHUB_SCOPES")
            .unwrap_or_else(|| "repo,read:user,user:email,read:org".to_string())
    }
}

impl AuthProvider for GitHubAuthProvider {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Github
    }

    fn default_instance_url(&self) -> &'static str {
        "https://github.com"
    }

    fn start_oauth(&self, instance_url: &str) -> Result<String, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let client_id = self.get_client_id();
        let redirect_uri = self.get_redirect_uri();
        let scopes = self.get_scopes();

        let (state, challenge, _verifier) =
            oauth_pkce::generate_pkce_session("github", clean_url, &redirect_uri);

        let auth_url = format!(
            "{}/login/oauth/authorize?client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
            clean_url,
            urlencoding::encode(&client_id),
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(&scopes),
            urlencoding::encode(&state),
            urlencoding::encode(&challenge),
        );

        Ok(auth_url)
    }

    async fn exchange_code(
        &self,
        instance_url: &str,
        code: &str,
        code_verifier: &str,
    ) -> Result<ProviderAccount, AppError> {
        self.exchange_code_with_redirect(instance_url, code, code_verifier, None)
            .await
    }

    async fn refresh_token(
        &self,
        account: &ProviderAccount,
        refresh_token: &str,
    ) -> Result<ProviderAccount, AppError> {
        let clean_url = account.instance_url.trim_end_matches('/');
        let token_url = format!("{}/login/oauth/access_token", clean_url);

        let client_id = self.get_client_id();
        let client_secret = self.get_client_secret();

        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));

        let mut params = vec![
            ("client_id", client_id),
            ("grant_type", "refresh_token".to_string()),
            ("refresh_token", refresh_token.to_string()),
        ];

        let secret_val = client_secret.unwrap_or_default();
        if !secret_val.is_empty() {
            params.push(("client_secret", secret_val));
        }

        let client = reqwest::Client::new();
        let resp = client
            .post(&token_url)
            .headers(headers)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("GitHub token refresh request failed: {}", e)))?;

        let body_text = resp
            .text()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to read GitHub refresh response: {}", e)))?;

        if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
            if let Some(err_code) = err_json.get("error").and_then(|v| v.as_str()) {
                let desc = err_json
                    .get("error_description")
                    .and_then(|v| v.as_str())
                    .unwrap_or(err_code);
                crate::log_error!(
                    crate::core::logging::LogCategory::Account,
                    format!("GitHub OAuth token refresh rejected: {} ({})", desc, err_code);
                    meta: serde_json::json!({ "account_id": account.id, "error": err_code, "desc": desc })
                );
                let is_invalid_token = err_code == "bad_refresh_token"
                    || err_code == "invalid_grant"
                    || err_code == "unauthorized_client"
                    || err_code == "invalid_token";
                if is_invalid_token {
                    return Err(AppError::Auth(format!("[NEEDS_REAUTH] GitHub refresh token expired or revoked: {}", desc)));
                }
                return Err(AppError::Auth(format!("GitHub OAuth refresh error: {}", desc)));
            }
        }

        let token_data: GitHubTokenResponse = serde_json::from_str(&body_text).map_err(|e| {
            AppError::Auth(format!(
                "Failed to parse GitHub refresh response ({}): {}",
                e, body_text
            ))
        })?;

        let now = chrono::Utc::now().timestamp();
        // GitHub App user access tokens expire in 8 hours (28800s)
        let expires_at = token_data.expires_in.map(|exp| now + exp);
        let refresh_token_expires_at = token_data.refresh_token_expires_in.map(|exp| now + exp);

        let mut updated = account.clone();
        updated.expires_at = expires_at;
        updated.refresh_token_expires_at = refresh_token_expires_at;
        updated.token_status = TokenStatus::Valid;

        let new_refresh_tok = token_data.refresh_token.as_deref().unwrap_or(refresh_token);

        crate::domain::accounts::token_store::save_account(
            updated.clone(),
            &token_data.access_token,
            Some(new_refresh_tok),
        )?;

        crate::log_info!(
            crate::core::logging::LogCategory::Account,
            format!("Successfully refreshed GitHub access token for account {}", account.id);
            meta: serde_json::json!({ "account_id": account.id, "handle": account.handle, "expires_at": expires_at })
        );

        Ok(updated)
    }

    async fn revoke_token(&self, _account: &ProviderAccount) -> Result<(), AppError> {
        Ok(())
    }
}

impl GitHubAuthProvider {

    pub async fn exchange_code_with_redirect(
        &self,
        instance_url: &str,
        code: &str,
        code_verifier: &str,
        redirect_uri_override: Option<&str>,
    ) -> Result<ProviderAccount, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let token_url = format!("{}/login/oauth/access_token", clean_url);

        let client_id = self.get_client_id();
        let client_secret = self.get_client_secret();
        let redirect_uri = redirect_uri_override
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.get_redirect_uri());

        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));

        let mut params = vec![
            ("client_id", client_id),
            ("code", code.to_string()),
            ("redirect_uri", redirect_uri),
        ];

        if !code_verifier.is_empty() {
            params.push(("code_verifier", code_verifier.to_string()));
        }

        let secret_val = client_secret.unwrap_or_default();
        if !secret_val.is_empty() {
            params.push(("client_secret", secret_val));
        }

        let client = reqwest::Client::new();
        let resp = client
            .post(&token_url)
            .headers(headers)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("GitHub token exchange failed: {}", e)))?;

        let body_text = resp
            .text()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to read GitHub token response: {}", e)))?;

        // Check if GitHub returned an OAuth error payload
        if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
            if let Some(err_code) = err_json.get("error").and_then(|v| v.as_str()) {
                let desc = err_json
                    .get("error_description")
                    .and_then(|v| v.as_str())
                    .unwrap_or(err_code);
                return Err(AppError::Auth(format!("GitHub OAuth error: {}", desc)));
            }
        }

        let token_data: GitHubTokenResponse = serde_json::from_str(&body_text).map_err(|e| {
            AppError::Auth(format!(
                "Failed to parse GitHub token response ({}): {}",
                e, body_text
            ))
        })?;


        // Fetch user profile
        let api_base = if clean_url.contains("github.com") {
            "https://api.github.com".to_string()
        } else {
            format!("{}/api/v3", clean_url)
        };

        let mut user_headers = HeaderMap::new();
        user_headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token_data.access_token))
                .map_err(|e| AppError::Auth(e.to_string()))?,
        );
        user_headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));

        let user_resp = client
            .get(format!("{}/user", api_base))
            .headers(user_headers.clone())
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to fetch GitHub profile: {}", e)))?;

        let user_data: GitHubUserResponse = user_resp
            .json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse GitHub user: {}", e)))?;

        // Fetch primary verified email if not present in public profile
        let mut user_email = user_data.email.unwrap_or_default();
        if user_email.is_empty() {
            if let Ok(emails_resp) = client
                .get(format!("{}/user/emails", api_base))
                .headers(user_headers)
                .send()
                .await
            {
                if let Ok(emails) = emails_resp.json::<Vec<GitHubEmailResponse>>().await {
                    if let Some(primary) = emails.iter().find(|e| e.primary && e.verified).or_else(|| emails.first()) {
                        user_email = primary.email.clone();
                    }
                }
            }
        }

        let account_id = format!(
            "github:{}:{}",
            clean_url.replace("https://", "").replace("http://", ""),
            user_data.id
        );
        let handle = format!("@{}", user_data.login.trim_start_matches('@'));
        let display_name = user_data.name.unwrap_or_else(|| user_data.login.clone());

        let now = chrono::Utc::now().timestamp();
        let expires_at = token_data.expires_in.map(|exp| now + exp);
        let refresh_token_expires_at = token_data.refresh_token_expires_in.map(|exp| now + exp);

        let account = ProviderAccount {
            id: account_id.clone(),
            provider: ProviderKind::Github,
            instance_url: clean_url.to_string(),
            handle,
            display_name,
            avatar_url: user_data.avatar_url.unwrap_or_default(),
            commit_email: user_email,
            is_active: true,
            token_status: TokenStatus::Valid,
            scopes: token_data
                .scope
                .map(|s| s.split(',').map(|x| x.trim().to_string()).collect())
                .unwrap_or_default(),
            expires_at,
            refresh_token_expires_at,
        };

        crate::domain::accounts::token_store::save_account(
            account.clone(),
            &token_data.access_token,
            token_data.refresh_token.as_deref(),
        )?;

        let _ = crate::domain::accounts::active_account::set_active_and_sync_git(&account.id, None);

        Ok(account)
    }
}


