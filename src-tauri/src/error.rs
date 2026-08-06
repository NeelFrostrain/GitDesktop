use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize, Clone)]
pub struct AppErrorResponse {
    pub code: String,
    pub message: String,
}

#[derive(Debug)]
pub enum AppError {
    Auth(String),
    Network(String),
    Git(String),
    GitConflict(Vec<String>),
    Filesystem(String),
    NotFound(String),
    Validation(String),
    Unknown(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Auth(_) => "AUTH_ERROR",
            AppError::Network(_) => "NETWORK_ERROR",
            AppError::Git(_) => "GIT_ERROR",
            AppError::GitConflict(_) => "GIT_CONFLICT_ERROR",
            AppError::Filesystem(_) => "FILESYSTEM_ERROR",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::Unknown(_) => "UNKNOWN_ERROR",
        }
    }

    pub fn message(&self) -> String {
        match self {
            AppError::Auth(msg) => msg.clone(),
            AppError::Network(msg) => msg.clone(),
            AppError::Git(msg) => msg.clone(),
            AppError::GitConflict(files) => format!("Merge conflicts detected in: {}", files.join(", ")),
            AppError::Filesystem(msg) => msg.clone(),
            AppError::NotFound(msg) => msg.clone(),
            AppError::Validation(msg) => msg.clone(),
            AppError::Unknown(msg) => msg.clone(),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code(), self.message())
    }
}

impl std::error::Error for AppError {}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let response = AppErrorResponse {
            code: self.code().to_string(),
            message: self.message(),
        };
        response.serialize(serializer)
    }
}

impl From<git2::Error> for AppError {
    fn from(err: git2::Error) -> Self {
        AppError::Git(err.message().to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_connect() || err.is_timeout() {
            AppError::Network(format!("Network error: {}", err))
        } else if let Some(status) = err.status() {
            if status.as_u16() == 401 || status.as_u16() == 403 {
                AppError::Auth("GitLab authentication failed or token expired. Please re-authenticate.".to_string())
            } else {
                AppError::Network(format!("GitLab API error (Status {}): {}", status, err))
            }
        } else {
            AppError::Network(err.to_string())
        }
    }
}

impl From<keyring::Error> for AppError {
    fn from(err: keyring::Error) -> Self {
        AppError::Auth(format!("Secure keyring error: {}", err))
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Filesystem(err.to_string())
    }
}
