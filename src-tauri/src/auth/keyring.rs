use keyring::Entry;
use crate::error::AppError;

const SERVICE_NAME: &str = "gitlab-desktop";
const TOKEN_KEY: &str = "gitlab_token";
const SERVER_URL_KEY: &str = "gitlab_server_url";

pub fn save_token(token: &str) -> Result<(), AppError> {
    let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)?;
    entry.set_password(token)?;
    Ok(())
}

pub fn get_token() -> Result<Option<String>, AppError> {
    let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::from(e)),
    }
}

pub fn delete_token() -> Result<(), AppError> {
    let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::from(e)),
    }
}

pub fn save_server_url(url: &str) -> Result<(), AppError> {
    let entry = Entry::new(SERVICE_NAME, SERVER_URL_KEY)?;
    entry.set_password(url)?;
    Ok(())
}

pub fn get_server_url() -> Result<Option<String>, AppError> {
    let entry = Entry::new(SERVICE_NAME, SERVER_URL_KEY)?;
    match entry.get_password() {
        Ok(url) => Ok(Some(url)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::from(e)),
    }
}
