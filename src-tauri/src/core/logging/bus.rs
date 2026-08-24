use crate::core::logging::model::LogEntry;
use crate::core::logging::store;
use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock, RwLock};
use tauri::{AppHandle, Emitter};

const RING_BUFFER_CAPACITY: usize = 500;

static GLOBAL_APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static RING_BUFFER: RwLock<Option<VecDeque<LogEntry>>> = RwLock::new(None);
static BUS_LOCK: Mutex<()> = Mutex::new(());

/// Initializes or updates the global AppHandle reference for broadcasting events.
pub fn init_app_handle(app: AppHandle) {
    let _ = GLOBAL_APP_HANDLE.set(app);
}

/// Dispatches a LogEntry to the in-memory ring buffer, disk persistence, and frontend broadcast.
pub fn log(app_opt: Option<&AppHandle>, entry: LogEntry) {
    let _guard = match BUS_LOCK.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };

    // 1. Push to in-memory ring buffer (newest first)
    if let Ok(mut lock) = RING_BUFFER.write() {
        let buffer = lock.get_or_insert_with(|| VecDeque::with_capacity(RING_BUFFER_CAPACITY));
        if buffer.len() >= RING_BUFFER_CAPACITY {
            buffer.pop_back();
        }
        buffer.push_front(entry.clone());
    }

    // 2. Append to disk via store
    store::append_log(&entry);

    // 3. Emit Tauri event "app:log" to frontend
    let handle = app_opt.or_else(|| GLOBAL_APP_HANDLE.get());
    if let Some(app) = handle {
        let _ = app.emit("app:log", &entry);
    }
}

/// Returns recent in-memory log entries (newest first).
pub fn get_recent_logs(limit: usize) -> Vec<LogEntry> {
    if let Ok(lock) = RING_BUFFER.read() {
        if let Some(ref buffer) = *lock {
            return buffer.iter().take(limit).cloned().collect();
        }
    }
    Vec::new()
}
