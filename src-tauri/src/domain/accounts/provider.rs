use crate::error::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Gitlab,
    Github,
    Bitbucket,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TokenStatus {
    Valid,
    ExpiringSoon,
    Expired,
    NeedsReauth,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderAccount {
    pub id: String,
    pub provider: ProviderKind,
    pub instance_url: String,
    pub handle: String,
    pub display_name: String,
    pub avatar_url: String,
    pub commit_email: String,
    pub is_active: bool,
    pub token_status: TokenStatus,
    pub scopes: Vec<String>,
    pub expires_at: Option<i64>,
    pub refresh_token_expires_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccountPatch {
    pub display_name: Option<String>,
    pub commit_email: Option<String>,
    pub avatar_url: Option<String>,
}

pub trait AuthProvider: Send + Sync {
    fn provider_kind(&self) -> ProviderKind;
    fn default_instance_url(&self) -> &'static str;
    fn start_oauth(&self, instance_url: &str) -> Result<String, AppError>;
    fn exchange_code(
        &self,
        instance_url: &str,
        code: &str,
        code_verifier: &str,
    ) -> impl std::future::Future<Output = Result<ProviderAccount, AppError>> + Send;
    fn refresh_token(
        &self,
        account: &ProviderAccount,
        refresh_token: &str,
    ) -> impl std::future::Future<Output = Result<ProviderAccount, AppError>> + Send;
    fn revoke_token(
        &self,
        account: &ProviderAccount,
    ) -> impl std::future::Future<Output = Result<(), AppError>> + Send;
}
