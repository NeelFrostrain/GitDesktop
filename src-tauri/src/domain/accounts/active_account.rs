use git2::Repository;
use std::path::Path;
use crate::error::AppError;
use super::token_store;

pub fn set_active_and_sync_git(account_id: &str, active_repo_path: Option<&str>) -> Result<(), AppError> {
    // 1. Update active account in store
    token_store::set_active_account(account_id)?;

    // 2. Find the newly activated account
    let accounts = token_store::list_accounts();
    let account = accounts.into_iter().find(|a| a.id == account_id)
        .ok_or_else(|| AppError::NotFound(format!("Account '{}' not found", account_id)))?;

    // 3. Update Git identity
    if let Some(path_str) = active_repo_path {
        let repo_path = Path::new(path_str);
        if let Ok(repo) = Repository::open(repo_path) {
            if let Ok(mut config) = repo.config() {
                let _ = config.set_str("user.name", &account.display_name);
                if !account.commit_email.is_empty() {
                    let _ = config.set_str("user.email", &account.commit_email);
                }
            }
        }
    }

    Ok(())
}
