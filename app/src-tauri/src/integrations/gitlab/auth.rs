use crate::core::config;
use crate::domain::accounts::oauth_pkce;
use crate::domain::accounts::provider::{AuthProvider, ProviderAccount, ProviderKind, TokenStatus};
use crate::error::AppError;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::Deserialize;

pub const GITLAB_DEFAULT_CLIENT_ID: &str =
    "e1e90ccf895458c58b7738412ac7f2ff830b89fbeab9cd7405d6e6a75005202d";
pub const GITLAB_DEFAULT_REDIRECT_URI: &str = "http://127.0.0.1:8585/oauth/callback";

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GitLabOAuthTokenResponse {
    access_token: String,
    token_type: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    scope: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GitLabUserResponse {
    id: u64,
    username: String,
    name: String,
    email: Option<String>,
    avatar_url: Option<String>,
    web_url: String,
}

pub struct GitLabAuthProvider;

impl GitLabAuthProvider {
    pub fn get_client_id(&self) -> String {
        config::get_env_var("VITE_GITLAB_CLIENT_ID")
            .unwrap_or_else(|| GITLAB_DEFAULT_CLIENT_ID.to_string())
    }

    pub fn get_client_secret(&self) -> Option<String> {
        config::get_env_var("VITE_GITLAB_CLIENT_SECRET")
    }

    pub fn get_redirect_uri(&self) -> String {
        config::get_env_var("VITE_GITLAB_REDIRECT_URI")
            .unwrap_or_else(|| GITLAB_DEFAULT_REDIRECT_URI.to_string())
    }

    pub fn get_scopes(&self) -> String {
        config::get_env_var("VITE_GITLAB_SCOPES").unwrap_or_else(|| {
            "api read_user openid profile email write_repository read_repository".to_string()
        })
    }
}

impl AuthProvider for GitLabAuthProvider {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Gitlab
    }

    fn default_instance_url(&self) -> &'static str {
        "https://gitlab.com"
    }

    fn start_oauth(&self, instance_url: &str) -> Result<String, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let client_id = self.get_client_id();
        let redirect_uri = self.get_redirect_uri();
        let raw_scopes = self.get_scopes();
        let formatted_scopes = raw_scopes.replace([',', ' '], "+");

        let (state, challenge, _verifier) =
            oauth_pkce::generate_pkce_session("gitlab", clean_url, &redirect_uri);

        let auth_url = format!(
            "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&state={}&code_challenge={}&code_challenge_method=S256&scope={}",
            clean_url,
            urlencoding::encode(&client_id),
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(&state),
            urlencoding::encode(&challenge),
            formatted_scopes,
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
        let token_url = format!("{}/oauth/token", clean_url);

        let client_id = self.get_client_id();
        let client_secret = self.get_client_secret();
        let redirect_uri = self.get_redirect_uri();

        let mut params = vec![
            ("client_id", client_id),
            ("grant_type", "refresh_token".to_string()),
            ("refresh_token", refresh_token.to_string()),
            ("redirect_uri", redirect_uri),
        ];

        let secret_val = client_secret.unwrap_or_default();
        if !secret_val.is_empty() {
            params.push(("client_secret", secret_val));
        }

        let client = reqwest::Client::new();
        let resp = client
            .post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("GitLab token refresh request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            crate::log_error!(
                crate::core::logging::LogCategory::Account,
                format!("GitLab OAuth refresh failed with status {}: {}", status, body_text);
                meta: serde_json::json!({ "account_id": account.id, "status": status.as_u16(), "body": body_text })
            );
            return Err(AppError::Auth(format!("Failed to refresh GitLab token ({}): {}", status, body_text)));
        }

        let token_resp: GitLabOAuthTokenResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse GitLab token refresh response: {}", e)))?;

        let now = chrono::Utc::now().timestamp();
        let mut updated = account.clone();
        updated.expires_at = token_resp.expires_in.map(|exp| now + exp);
        updated.token_status = TokenStatus::Valid;

        let new_refresh = token_resp.refresh_token.as_deref().or(Some(refresh_token));

        crate::domain::accounts::token_store::save_account(
            updated.clone(),
            &token_resp.access_token,
            new_refresh,
        )?;

        crate::log_info!(
            crate::core::logging::LogCategory::Account,
            format!("Successfully refreshed GitLab access token for account {}", account.id);
            meta: serde_json::json!({ "account_id": account.id, "handle": account.handle })
        );

        Ok(updated)
    }

    async fn revoke_token(&self, account: &ProviderAccount) -> Result<(), AppError> {
        let clean_url = account.instance_url.trim_end_matches('/');
        let revoke_url = format!("{}/oauth/revoke", clean_url);
        let client_id = self.get_client_id();

        if let Ok(Some(token)) = crate::domain::accounts::token_store::get_token(&account.id) {
            let client = reqwest::Client::new();
            let _ = client
                .post(&revoke_url)
                .form(&[
                    ("client_id", client_id.as_str()),
                    ("token", token.as_str()),
                ])
                .send()
                .await;
        }
        Ok(())
    }
}

impl GitLabAuthProvider {
    pub async fn exchange_code_with_redirect(
        &self,
        instance_url: &str,
        code: &str,
        code_verifier: &str,
        redirect_uri_override: Option<&str>,
    ) -> Result<ProviderAccount, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let token_url = format!("{}/oauth/token", clean_url);

        let client_id = self.get_client_id();
        let client_secret = self.get_client_secret();
        let redirect_uri = redirect_uri_override
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.get_redirect_uri());

        let mut params = vec![
            ("client_id", client_id.clone()),
            ("code", code.to_string()),
            ("grant_type", "authorization_code".to_string()),
            ("redirect_uri", redirect_uri.clone()),
            ("code_verifier", code_verifier.to_string()),
        ];

        let secret_val = client_secret.unwrap_or_default();
        if !secret_val.is_empty() {
            params.push(("client_secret", secret_val));
        }


        let client = reqwest::Client::new();
        let resp = client
            .post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("OAuth token exchange failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!(
                "GitLab OAuth error {}: {}",
                status, text
            )));
        }

        let token_resp: GitLabOAuthTokenResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse GitLab token response: {}", e)))?;

        // Fetch user profile
        let user_url = format!("{}/api/v4/user", clean_url);
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token_resp.access_token))
                .map_err(|e| AppError::Auth(e.to_string()))?,
        );

        let user_resp = client
            .get(&user_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to fetch user profile: {}", e)))?;

        let user_data: GitLabUserResponse = user_resp
            .json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse user profile: {}", e)))?;

        let now = chrono::Utc::now().timestamp();
        let expires_at = token_resp.expires_in.map(|exp| now + exp);
        let scopes = token_resp
            .scope
            .map(|s| s.split_whitespace().map(|x| x.to_string()).collect())
            .unwrap_or_default();

        let account_id = format!(
            "gitlab:{}:{}",
            clean_url.replace("https://", "").replace("http://", ""),
            user_data.id
        );
        let handle = format!("@{}", user_data.username.trim_start_matches('@'));

        let account = ProviderAccount {
            id: account_id.clone(),
            provider: ProviderKind::Gitlab,
            instance_url: clean_url.to_string(),
            handle,
            display_name: user_data.name,
            avatar_url: user_data.avatar_url.unwrap_or_default(),
            commit_email: user_data.email.unwrap_or_default(),
            is_active: true,
            token_status: TokenStatus::Valid,
            scopes,
            expires_at,
            refresh_token_expires_at: None,
        };

        crate::domain::accounts::token_store::save_account(
            account.clone(),
            &token_resp.access_token,
            token_resp.refresh_token.as_deref(),
        )?;

        let _ = crate::domain::accounts::active_account::set_active_and_sync_git(&account.id, None);

        Ok(account)
    }
}
