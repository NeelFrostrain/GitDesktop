// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
fn attach_console_if_available() {
    unsafe {
        extern "system" {
            fn AttachConsole(dwProcessId: u32) -> i32;
            fn SetStdHandle(nStdHandle: u32, hHandle: *mut std::ffi::c_void) -> i32;
            fn CreateFileW(
                lpFileName: *const u16,
                dwDesiredAccess: u32,
                dwShareMode: u32,
                lpSecurityAttributes: *const std::ffi::c_void,
                dwCreationDisposition: u32,
                dwFlagsAndAttributes: u32,
                hTemplateFile: *mut std::ffi::c_void,
            ) -> *mut std::ffi::c_void;
        }

        const ATTACH_PARENT_PROCESS: u32 = 0xFFFFFFFF;
        const STD_OUTPUT_HANDLE: u32 = 0xFFFFFFF5; // -11
        const STD_ERROR_HANDLE: u32 = 0xFFFFFFF4;  // -12
        const GENERIC_READ_WRITE: u32 = 0xC0000000;
        const FILE_SHARE_READ_WRITE: u32 = 0x00000003;
        const OPEN_EXISTING: u32 = 3;

        if AttachConsole(ATTACH_PARENT_PROCESS) != 0 {
            let conout_name: Vec<u16> = "CONOUT$\0".encode_utf16().collect();
            let handle = CreateFileW(
                conout_name.as_ptr(),
                GENERIC_READ_WRITE,
                FILE_SHARE_READ_WRITE,
                std::ptr::null(),
                OPEN_EXISTING,
                0,
                std::ptr::null_mut(),
            );
            if !handle.is_null() && handle != -1isize as *mut std::ffi::c_void {
                SetStdHandle(STD_OUTPUT_HANDLE, handle);
                SetStdHandle(STD_ERROR_HANDLE, handle);
            }
        }
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    attach_console_if_available();

    // Aggressively minimize WebView2 Chromium memory consumption
    // #[cfg(target_os = "windows")]
    // {
    //     std::env::set_var(
    //         "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    //         "--js-flags=\"--max-old-space-size=128\" --disable-features=Translate,OptimizationHints,MediaRouter --disable-background-networking"
    //     );
    // }

    git_desktop_lib::run()
}
