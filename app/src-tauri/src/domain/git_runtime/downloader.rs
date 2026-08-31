use super::detector::{detect_git_runtime, get_mingit_dir, GitRuntimeInfo};
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Cursor};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

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

/// Searches for a pre-downloaded MinGit ZIP archive in the project or bundled paths.
pub fn find_local_mingit_archive(app_handle: Option<&AppHandle>) -> Option<PathBuf> {
    // 1. Check Tauri resource_dir via AppHandle if available
    if let Some(handle) = app_handle {
        if let Ok(res_dir) = handle.path().resource_dir() {
            let res_candidates = [
                res_dir.join("MinGit-2.47.1-64-bit.zip"),
                res_dir.join("bin").join("MinGit-2.47.1-64-bit.zip"),
                res_dir.join("_up_").join("bin").join("MinGit-2.47.1-64-bit.zip"),
                res_dir.join("resources").join("MinGit-2.47.1-64-bit.zip"),
                res_dir.join("resources").join("bin").join("MinGit-2.47.1-64-bit.zip"),
            ];
            for path in &res_candidates {
                if path.exists() {
                    return Some(path.clone());
                }
            }
        }
    }

    let candidate_paths = [
        PathBuf::from("bin").join("MinGit-2.47.1-64-bit.zip"),
        PathBuf::from("bin").join("mingit.zip"),
        PathBuf::from("..").join("bin").join("MinGit-2.47.1-64-bit.zip"),
        PathBuf::from("src-tauri").join("bin").join("MinGit-2.47.1-64-bit.zip"),
        PathBuf::from("src-tauri").join("bin").join("mingit.zip"),
        PathBuf::from("resources").join("MinGit-2.47.1-64-bit.zip"),
        PathBuf::from("resources").join("mingit.zip"),
        PathBuf::from("resources").join("bin").join("MinGit-2.47.1-64-bit.zip"),
        PathBuf::from("MinGit-2.47.1-64-bit.zip"),
    ];

    for path in &candidate_paths {
        if path.exists() {
            return Some(path.clone());
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let exe_candidates = [
                parent.join("bin").join("mingit.zip"),
                parent.join("bin").join("MinGit-2.47.1-64-bit.zip"),
                parent.join("resources").join("mingit.zip"),
                parent.join("resources").join("MinGit-2.47.1-64-bit.zip"),
                parent.join("resources").join("bin").join("MinGit-2.47.1-64-bit.zip"),
                parent.join("resources").join("_up_").join("bin").join("MinGit-2.47.1-64-bit.zip"),
                parent.join("MinGit-2.47.1-64-bit.zip"),
            ];
            for path in &exe_candidates {
                if path.exists() {
                    return Some(path.clone());
                }
            }
            if let Some(grandparent) = parent.parent() {
                let gp_candidates = [
                    grandparent.join("resources").join("MinGit-2.47.1-64-bit.zip"),
                    grandparent.join("resources").join("bin").join("MinGit-2.47.1-64-bit.zip"),
                    grandparent.join("resources").join("_up_").join("bin").join("MinGit-2.47.1-64-bit.zip"),
                    grandparent.join("bin").join("MinGit-2.47.1-64-bit.zip"),
                ];
                for path in &gp_candidates {
                    if path.exists() {
                        return Some(path.clone());
                    }
                }
            }
        }
    }

    None
}

pub async fn download_and_install_mingit(
    app_handle: &AppHandle,
) -> Result<GitRuntimeInfo, AppError> {
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

    // 1. Check if a pre-downloaded local ZIP archive is present in the dev directory or bundle
    let zip_buffer: Vec<u8> = if let Some(local_zip_path) = find_local_mingit_archive(Some(app_handle)) {
        emit_progress("starting", 0, 0, 0.0, "Found pre-downloaded local MinGit archive...");
        fs::read(&local_zip_path).map_err(|e| {
            AppError::Filesystem(format!("Failed to read local MinGit archive {:?}: {}", local_zip_path, e))
        })?
    } else {
        // 2. Download from official GitHub Releases
        let client = reqwest::Client::builder()
            .user_agent("GitDesktop-MinGitDownloader/1.0")
            .build()
            .map_err(|e| AppError::Network(format!("Failed to build HTTP client: {}", e)))?;

        emit_progress("starting", 0, 0, 0.0, "Initiating MinGit download...");

        let mut res =
            client.get(MINGIT_DOWNLOAD_URL).send().await.map_err(|e| {
                AppError::Network(format!("Failed to connect to MinGit release: {}", e))
            })?;

        if !res.status().is_success() {
            let err_msg = format!("HTTP error {} downloading MinGit", res.status());
            emit_progress("error", 0, 0, 0.0, &err_msg);
            return Err(AppError::Network(err_msg));
        }

        let total_bytes = res.content_length().unwrap_or(27 * 1024 * 1024);
        let mut downloaded_bytes: u64 = 0;
        let mut buf = Vec::with_capacity(total_bytes as usize);

        while let Some(chunk) = res
            .chunk()
            .await
            .map_err(|e| AppError::Network(format!("Error downloading chunk: {}", e)))?
        {
            downloaded_bytes += chunk.len() as u64;
            buf.extend_from_slice(&chunk);

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
        buf
    };

    let total_bytes = zip_buffer.len() as u64;
    let downloaded_bytes = total_bytes;

    emit_progress(
        "extracting",
        downloaded_bytes,
        total_bytes,
        99.0,
        "Extracting portable MinGit files...",
    );

    let mingit_dir = get_mingit_dir();
    if mingit_dir.exists() {
        let _ = fs::remove_dir_all(&mingit_dir);
    }
    fs::create_dir_all(&mingit_dir)
        .map_err(|e| AppError::Filesystem(format!("Failed to create MinGit dir: {}", e)))?;

    // Extract ZIP archive in a background worker thread
    let mingit_dir_clone = mingit_dir.clone();
    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let cursor = Cursor::new(zip_buffer);
        let mut archive = zip::ZipArchive::new(cursor).map_err(|e| {
            AppError::Filesystem(format!("Failed to read MinGit zip archive: {}", e))
        })?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| {
                AppError::Filesystem(format!("Failed to read archive entry: {}", e))
            })?;

            let outpath = match file.enclosed_name() {
                Some(path) => mingit_dir_clone.join(path),
                None => continue,
            };

            if file.is_dir() {
                fs::create_dir_all(&outpath).map_err(|e| {
                    AppError::Filesystem(format!("Failed to create directory: {}", e))
                })?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p).map_err(|e| {
                            AppError::Filesystem(format!("Failed to create parent dir: {}", e))
                        })?;
                    }
                }
                let mut outfile = File::create(&outpath).map_err(|e| {
                    AppError::Filesystem(format!("Failed to create file {:?}: {}", outpath, e))
                })?;
                io::copy(&mut file, &mut outfile).map_err(|e| {
                    AppError::Filesystem(format!("Failed to write file {:?}: {}", outpath, e))
                })?;
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
        // Asynchronously ensure Git LFS binary is also installed
        let _ = download_and_install_git_lfs().await;

        emit_progress(
            "completed",
            total_bytes,
            total_bytes,
            100.0,
            "MinGit installed successfully!",
        );
        Ok(info)
    } else {
        let err_msg = "MinGit extracted but git.exe execution verification failed.".to_string();
        emit_progress("error", 0, 0, 0.0, &err_msg);
        Err(AppError::Filesystem(err_msg))
    }
}

pub async fn download_and_install_git_lfs() -> Result<(), AppError> {
    let mingit_dir = get_mingit_dir();
    let target_cmd_lfs = mingit_dir.join("cmd").join("git-lfs.exe");
    let target_mingw_lfs = mingit_dir.join("mingw64").join("bin").join("git-lfs.exe");

    if target_cmd_lfs.exists() && target_mingw_lfs.exists() {
        return Ok(());
    }

    let url = "https://github.com/git-lfs/git-lfs/releases/download/v3.6.0/git-lfs-windows-amd64-v3.6.0.zip";
    let client = reqwest::Client::builder()
        .user_agent("GitDesktop-LfsDownloader/1.0")
        .build()
        .map_err(|e| AppError::Network(format!("Failed to build HTTP client: {}", e)))?;

    let res = client.get(url).send().await.map_err(|e| {
        AppError::Network(format!("Failed to download Git LFS: {}", e))
    })?;

    if !res.status().is_success() {
        return Err(AppError::Network(format!("HTTP error downloading Git LFS: {}", res.status())));
    }

    let bytes = res.bytes().await.map_err(|e| {
        AppError::Network(format!("Failed to read Git LFS response: {}", e))
    })?;

    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let cursor = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor).map_err(|e| {
            AppError::Filesystem(format!("Failed to read Git LFS zip archive: {}", e))
        })?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| {
                AppError::Filesystem(format!("Failed to read Git LFS entry: {}", e))
            })?;

            if let Some(name) = file.enclosed_name() {
                if name.file_name().and_then(|f| f.to_str()) == Some("git-lfs.exe") {
                    let mut content = Vec::new();
                    io::copy(&mut file, &mut content).map_err(|e| {
                        AppError::Filesystem(format!("Failed to extract git-lfs.exe: {}", e))
                    })?;

                    if let Some(parent) = target_cmd_lfs.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let _ = fs::write(&target_cmd_lfs, &content);

                    if let Some(parent) = target_mingw_lfs.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let _ = fs::write(&target_mingw_lfs, &content);
                    break;
                }
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| AppError::Filesystem(format!("Git LFS extraction task failed: {}", e)))??;

    Ok(())
}
