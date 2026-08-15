use super::detector::{detect_git_runtime, get_mingit_dir, GitRuntimeInfo};
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Cursor};
use tauri::{AppHandle, Emitter};

pub const MINGIT_DOWNLOAD_URL: &str =
    "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/MinGit-2.47.1-64-bit.zip";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinGitProgressPayload {
    pub status: String, // "starting", "downloading", "extracting", "completed", "error"
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub message: String,
}

pub async fn download_and_install_mingit(app_handle: &AppHandle) -> Result<GitRuntimeInfo, AppError> {
    let client = reqwest::Client::builder()
        .user_agent("GitDesktop-MinGitDownloader/1.0")
        .build()
        .map_err(|e| AppError::Network(format!("Failed to build HTTP client: {}", e)))?;

    let emit_progress = |status: &str, downloaded: u64, total: u64, percent: f64, msg: &str| {
        let payload = MinGitProgressPayload {
            status: status.to_string(),
            downloaded_bytes: downloaded,
            total_bytes: total,
            percentage: percent,
            message: msg.to_string(),
        };
        let _ = app_handle.emit("mingit:download:progress", &payload);
    };

    emit_progress("starting", 0, 0, 0.0, "Initiating MinGit download...");

    let mut res = client
        .get(MINGIT_DOWNLOAD_URL)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Failed to connect to MinGit release: {}", e)))?;

    if !res.status().is_success() {
        let err_msg = format!("HTTP error {} downloading MinGit", res.status());
        emit_progress("error", 0, 0, 0.0, &err_msg);
        return Err(AppError::Network(err_msg));
    }

    let total_bytes = res.content_length().unwrap_or(27 * 1024 * 1024);
    let mut downloaded_bytes: u64 = 0;
    let mut zip_buffer = Vec::with_capacity(total_bytes as usize);

    while let Some(chunk) = res
        .chunk()
        .await
        .map_err(|e| AppError::Network(format!("Error downloading chunk: {}", e)))?
    {
        downloaded_bytes += chunk.len() as u64;
        zip_buffer.extend_from_slice(&chunk);

        let percentage = if total_bytes > 0 {
            (downloaded_bytes as f64 / total_bytes as f64 * 100.0).min(100.0)
        } else {
            0.0
        };

        emit_progress(
            "downloading",
            downloaded_bytes,
            total_bytes,
            percentage,
            &format!(
                "Downloading MinGit ({:.1} MB / {:.1} MB)...",
                downloaded_bytes as f64 / 1_048_576.0,
                total_bytes as f64 / 1_048_576.0
            ),
        );
    }

    emit_progress("extracting", downloaded_bytes, total_bytes, 99.0, "Extracting portable MinGit files...");

    let mingit_dir = get_mingit_dir();
    if mingit_dir.exists() {
        let _ = fs::remove_dir_all(&mingit_dir);
    }
    fs::create_dir_all(&mingit_dir).map_err(|e| AppError::Filesystem(format!("Failed to create MinGit dir: {}", e)))?;

    // Extract ZIP archive in a background worker thread
    let mingit_dir_clone = mingit_dir.clone();
    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let cursor = Cursor::new(zip_buffer);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| AppError::Filesystem(format!("Failed to read MinGit zip archive: {}", e)))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| AppError::Filesystem(format!("Failed to read archive entry: {}", e)))?;

            let outpath = match file.enclosed_name() {
                Some(path) => mingit_dir_clone.join(path),
                None => continue,
            };

            if file.is_dir() {
                fs::create_dir_all(&outpath)
                    .map_err(|e| AppError::Filesystem(format!("Failed to create directory: {}", e)))?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)
                            .map_err(|e| AppError::Filesystem(format!("Failed to create parent dir: {}", e)))?;
                    }
                }
                let mut outfile = File::create(&outpath)
                    .map_err(|e| AppError::Filesystem(format!("Failed to create file {:?}: {}", outpath, e)))?;
                io::copy(&mut file, &mut outfile)
                    .map_err(|e| AppError::Filesystem(format!("Failed to write file {:?}: {}", outpath, e)))?;
            }

            // Set unix permissions on unix targets if available
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    let _ = fs::set_permissions(&outpath, fs::Permissions::from_mode(mode));
                }
            }
        }

        Ok(())
    })
    .await
    .map_err(|e| AppError::Filesystem(format!("Extraction thread panicked: {}", e)))??;

    // Verify installation
    let info = detect_git_runtime();
    if info.is_available {
        emit_progress("completed", total_bytes, total_bytes, 100.0, "MinGit installed successfully!");
        Ok(info)
    } else {
        let err_msg = "MinGit extracted but git.exe execution verification failed.".to_string();
        emit_progress("error", 0, 0, 0.0, &err_msg);
        Err(AppError::Filesystem(err_msg))
    }
}
