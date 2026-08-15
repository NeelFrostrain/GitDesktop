use serde::Deserialize;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, ACCEPT, USER_AGENT};
use crate::error::AppError;
use crate::domain::accounts::provider::{AuthProvider, ProviderAccount, ProviderKind, TokenStatus};
use crate::domain::accounts::oauth_pkce;

pub const GITHUB_CLIENT_ID: &str = "Ov23li3kX5zN6H4dYx3E";
pub const GITHUB_REDIRECT_URI: &str = "gitlab-desktop://oauth/github/callback";

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: String,
    token_type: String,
    scope: Option<String>,
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

pub struct GitHubAuthProvider;

impl AuthProvider for GitHubAuthProvider {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Github
    }

    fn default_instance_url(&self) -> &'static str {
        "https://github.com"
    }

    fn start_oauth(&self, instance_url: &str) -> Result<String, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let (state, challenge, _verifier) = oauth_pkce::generate_pkce_session("github", clean_url);

        let auth_url = format!(
            "{}/login/oauth/authorize?client_id={}&redirect_uri={}&scope=repo,read:user,user:email&state={}&code_challenge={}&code_challenge_method=S256",
            clean_url,
            GITHUB_CLIENT_ID,
            urlencoding::encode(GITHUB_REDIRECT_URI),
            urlencoding::encode(&state),
            urlencoding::encode(&challenge),
        );

        Ok(auth_url)
    }

    async fn exchange_code(&self, instance_url: &str, code: &str, _code_verifier: &str) -> Result<ProviderAccount, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let token_url = format!("{}/login/oauth/access_token", clean_url);

        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));

        let params = [
            ("client_id", GITHUB_CLIENT_ID),
            ("code", code),
            ("redirect_uri", GITHUB_REDIRECT_URI),
        ];

        let client = reqwest::Client::new();
        let resp = client.post(&token_url)
            .headers(headers)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("GitHub token exchange failed: {}", e)))?;

        let token_data: GitHubTokenResponse = resp.json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse GitHub token response: {}", e)))?;

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

        let user_resp = client.get(format!("{}/user", api_base))
            .headers(user_headers)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to fetch GitHub profile: {}", e)))?;

        let user_data: GitHubUserResponse = user_resp.json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse GitHub user: {}", e)))?;

        let account_id = format!("github:{}:{}", clean_url.replace("https://", "").replace("http://", ""), user_data.id);
        let handle = format!("@{}", user_data.login.trim_start_matches('@'));
        let display_name = user_data.name.unwrap_or_else(|| user_data.login.clone());

        let account = ProviderAccount {
            id: account_id.clone(),
            provider: ProviderKind::Github,
            instance_url: clean_url.to_string(),
            handle,
            display_name,
            avatar_url: user_data.avatar_url.unwrap_or_default(),
            commit_email: user_data.email.unwrap_or_default(),
            is_active: false,
            token_status: TokenStatus::Valid,
            scopes: token_data.scope.map(|s| s.split(',').map(|x| x.trim().to_string()).collect()).unwrap_or_default(),
            expires_at: None,
        };

        crate::domain::accounts::token_store::save_account(
            account.clone(),
            &token_data.access_token,
            None,
        )?;

        Ok(account)
    }

    async fn refresh_token(&self, account: &ProviderAccount, _refresh_token: &str) -> Result<ProviderAccount, AppError> {
        Ok(account.clone())
    }

    async fn revoke_token(&self, _account: &ProviderAccount) -> Result<(), AppError> {
        Ok(())
    }
}
