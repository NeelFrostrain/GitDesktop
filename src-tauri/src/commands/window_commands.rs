use tauri::Window;

#[tauri::command]
pub fn minimize_window(window: Window) {
    let _ = window.minimize();
}

#[tauri::command]
pub fn toggle_maximize_window(window: Window) -> bool {
    if let Ok(maximized) = window.is_maximized() {
        if maximized {
            let _ = window.unmaximize();
            false
        } else {
            let _ = window.maximize();
            true
        }
    } else {
        let _ = window.maximize();
        true
    }
}

#[tauri::command]
pub fn close_window(window: Window) {
    let _ = window.close();
}
