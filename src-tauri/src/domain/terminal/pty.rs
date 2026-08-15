use super::{
    log_store::{append_to_session_log, cleanup_old_sessions},
    TerminalSessionInfo,
};
use crate::error::AppError;
use chrono::Utc;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use tauri::{AppHandle, Emitter};

pub struct ActivePtySession {
    pub repo_id: String,
    pub session_id: String,
    pub pty_master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub pty_writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    pub is_alive: Arc<AtomicBool>,
}

static SESSIONS: OnceLock<Arc<Mutex<HashMap<String, ActivePtySession>>>> = OnceLock::new();

fn get_sessions_map() -> Arc<Mutex<HashMap<String, ActivePtySession>>> {
    SESSIONS.get_or_init(|| Arc::new(Mutex::new(HashMap::new()))).clone()
}

#[cfg(target_os = "windows")]
fn build_default_command(repo_path: &str) -> CommandBuilder {
    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.args(["-NoLogo", "-NoExit", "-ExecutionPolicy", "Bypass"]);
    cmd.cwd(repo_path);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    crate::domain::git_runtime::inject_git_path(&mut cmd);
    cmd
}

#[cfg(not(target_os = "windows"))]
fn build_default_command(repo_path: &str) -> CommandBuilder {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    let mut cmd = CommandBuilder::new(shell);
    cmd.cwd(repo_path);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd
}

pub fn open_session(
    app_handle: &AppHandle,
    repo_id: &str,
    repo_path: &str,
) -> Result<TerminalSessionInfo, AppError> {
    let map = get_sessions_map();
    let mut sessions = map.lock().unwrap();

    if let Some(existing) = sessions.get(repo_id) {
        if existing.is_alive.load(Ordering::SeqCst) {
            return Ok(TerminalSessionInfo {
                repo_id: repo_id.to_string(),
                session_id: existing.session_id.clone(),
                is_alive: true,
                pid: None,
            });
        }
    }

    // Clean up old log sessions beyond the retention limit (e.g. 20)
    cleanup_old_sessions(repo_id, 20);

    let session_id = Utc::now().format("%Y%m%d_%H%M%S").to_string();

    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| AppError::Filesystem(format!("Failed to open PTY: {}", e)))?;

    let cmd = build_default_command(repo_path);
    let child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| AppError::Filesystem(format!("Failed to spawn shell: {}", e)))?;

    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| AppError::Filesystem(format!("Failed to take PTY writer: {}", e)))?;

    let mut reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|e| AppError::Filesystem(format!("Failed to clone PTY reader: {}", e)))?;

    let is_alive = Arc::new(AtomicBool::new(true));
    let is_alive_clone = is_alive.clone();
    let repo_id_owned = repo_id.to_string();
    let session_id_clone = session_id.clone();
    let app_handle_clone = app_handle.clone();

    // Spawn reader thread for stdout/stderr stream
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let safe_repo_id = repo_id_owned.replace('\\', "/").replace(':', "_");
        let event_name = format!("terminal:{}:data", safe_repo_id);
        let exit_event = format!("terminal:{}:exit", safe_repo_id);

        while is_alive_clone.load(Ordering::SeqCst) {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    append_to_session_log(&repo_id_owned, &session_id_clone, &text);
                    let _ = app_handle_clone.emit(&event_name, &text);
                }
                Err(_) => break,
            }
        }

        is_alive_clone.store(false, Ordering::SeqCst);
        let _ = app_handle_clone.emit(&exit_event, ());
    });

    let session = ActivePtySession {
        repo_id: repo_id.to_string(),
        session_id: session_id.clone(),
        pty_master: Arc::new(Mutex::new(pty_pair.master)),
        pty_writer: Arc::new(Mutex::new(writer)),
        child: Arc::new(Mutex::new(child)),
        is_alive,
    };

    sessions.insert(repo_id.to_string(), session);

    Ok(TerminalSessionInfo {
        repo_id: repo_id.to_string(),
        session_id,
        is_alive: true,
        pid: None,
    })
}

pub fn write_to_session(repo_id: &str, data: &str) -> Result<(), AppError> {
    let map = get_sessions_map();
    let sessions = map.lock().unwrap();

    if let Some(session) = sessions.get(repo_id) {
        if let Ok(mut writer) = session.pty_writer.lock() {
            writer
                .write_all(data.as_bytes())
                .map_err(|e| AppError::Filesystem(format!("Failed to write to terminal: {}", e)))?;
            let _ = writer.flush();
            return Ok(());
        }
    }

    Err(AppError::NotFound(format!("No active terminal session for repo '{}'", repo_id)))
}

pub fn resize_session(repo_id: &str, cols: u16, rows: u16) -> Result<(), AppError> {
    let map = get_sessions_map();
    let sessions = map.lock().unwrap();

    if let Some(session) = sessions.get(repo_id) {
        if let Ok(master) = session.pty_master.lock() {
            let _ = master.resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            });
            return Ok(());
        }
    }

    Ok(())
}

pub fn kill_session(repo_id: &str) -> Result<(), AppError> {
    let map = get_sessions_map();
    let mut sessions = map.lock().unwrap();

    if let Some(session) = sessions.remove(repo_id) {
        session.is_alive.store(false, Ordering::SeqCst);
        if let Ok(mut child) = session.child.lock() {
            let _ = child.kill();
        }
    }

    Ok(())
}
