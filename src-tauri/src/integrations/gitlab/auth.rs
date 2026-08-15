use serde::Deserialize;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use crate::error::AppError;
use crate::domain::accounts::provider::{AuthProvider, ProviderAccount, ProviderKind, TokenStatus};
use crate::domain::accounts::oauth_pkce;

pub const GITLAB_DEFAULT_CLIENT_ID: &str = "0e59a43a08832a83adbb0c03632e8c2ecad1586a111a43a6d97e7fbe6b1bb85f";
pub const REDIRECT_URI: &str = "gitlab-desktop://oauth/gitlab/callback";

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

impl AuthProvider for GitLabAuthProvider {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Gitlab
    }

    fn default_instance_url(&self) -> &'static str {
        "https://gitlab.com"
    }

    fn start_oauth(&self, instance_url: &str) -> Result<String, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let (state, challenge, _verifier) = oauth_pkce::generate_pkce_session("gitlab", clean_url);

        let auth_url = format!(
            "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&state={}&code_challenge={}&code_challenge_method=S256&scope=api+read_user+openid+profile+email+write_repository+read_repository",
            clean_url,
            GITLAB_DEFAULT_CLIENT_ID,
            urlencoding::encode(REDIRECT_URI),
            urlencoding::encode(&state),
            urlencoding::encode(&challenge),
        );

        Ok(auth_url)
    }

    async fn exchange_code(&self, instance_url: &str, code: &str, code_verifier: &str) -> Result<ProviderAccount, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let token_url = format!("{}/oauth/token", clean_url);

        let params = [
            ("client_id", GITLAB_DEFAULT_CLIENT_ID),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", REDIRECT_URI),
            ("code_verifier", code_verifier),
        ];

        let client = reqwest::Client::new();
        let resp = client.post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("OAuth token exchange failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!("GitLab OAuth error {}: {}", status, text)));
        }

        let token_resp: GitLabOAuthTokenResponse = resp.json()
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

        let user_resp = client.get(&user_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to fetch user profile: {}", e)))?;

        let user_data: GitLabUserResponse = user_resp.json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse user profile: {}", e)))?;

        let now = chrono::Utc::now().timestamp();
        let expires_at = token_resp.expires_in.map(|exp| now + exp);
        let scopes = token_resp.scope.map(|s| s.split_whitespace().map(|x| x.to_string()).collect()).unwrap_or_default();

        let account_id = format!("gitlab:{}:{}", clean_url.replace("https://", "").replace("http://", ""), user_data.id);
        let handle = format!("@{}", user_data.username.trim_start_matches('@'));

        let account = ProviderAccount {
            id: account_id.clone(),
            provider: ProviderKind::Gitlab,
            instance_url: clean_url.to_string(),
            handle,
            display_name: user_data.name,
            avatar_url: user_data.avatar_url.unwrap_or_default(),
            commit_email: user_data.email.unwrap_or_default(),
            is_active: false,
            token_status: TokenStatus::Valid,
            scopes,
            expires_at,
        };

        crate::domain::accounts::token_store::save_account(
            account.clone(),
            &token_resp.access_token,
            token_resp.refresh_token.as_deref(),
        )?;

        Ok(account)
    }

    async fn refresh_token(&self, account: &ProviderAccount, refresh_token: &str) -> Result<ProviderAccount, AppError> {
        let clean_url = account.instance_url.trim_end_matches('/');
        let token_url = format!("{}/oauth/token", clean_url);

        let params = [
            ("client_id", GITLAB_DEFAULT_CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("redirect_uri", REDIRECT_URI),
        ];

        let client = reqwest::Client::new();
        let resp = client.post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Token refresh request failed: {}", e)))?;

        if !resp.status().is_success() {
            return Err(AppError::Auth("Failed to refresh GitLab token".to_string()));
        }

        let token_resp: GitLabOAuthTokenResponse = resp.json().await
            .map_err(|e| AppError::Auth(e.to_string()))?;

        let now = chrono::Utc::now().timestamp();
        let mut updated = account.clone();
        updated.expires_at = token_resp.expires_in.map(|exp| now + exp);
        updated.token_status = TokenStatus::Valid;

        crate::domain::accounts::token_store::save_account(
            updated.clone(),
            &token_resp.access_token,
            token_resp.refresh_token.as_deref(),
        )?;

        Ok(updated)
    }

    async fn revoke_token(&self, account: &ProviderAccount) -> Result<(), AppError> {
        let clean_url = account.instance_url.trim_end_matches('/');
        let revoke_url = format!("{}/oauth/revoke", clean_url);
        if let Ok(Some(token)) = crate::domain::accounts::token_store::get_token(&account.id) {
            let client = reqwest::Client::new();
            let _ = client.post(&revoke_url)
                .form(&[
                    ("client_id", GITLAB_DEFAULT_CLIENT_ID),
                    ("token", token.as_str()),
                ])
                .send()
                .await;
        }
        Ok(())
    }
}
