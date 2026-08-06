pub mod error;
pub mod auth;
pub mod git;
pub mod commands;

use commands::auth_commands::*;
use commands::git_commands::*;
use commands::repo_commands::*;
use commands::window_commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize_window,
            close_window,
            select_folder_cmd,
            generate_pkce_cmd,
            login_gitlab_pat,
            start_oauth_login,
            complete_oauth_login,
            get_current_user,
            logout_gitlab,
            fetch_user_repositories,
            clone_repository,
            get_open_merge_requests,
            create_merge_request,
            publish_repository,
            get_repo_status,
            get_file_diff,
            get_commit_file_diff,
            stage_files,
            unstage_files,
            commit_changes,
            push_to_remote,
            pull_from_remote,
            fetch_remote,
            get_commit_history,
            get_commit_details,
            list_branches,
            checkout_branch,
            create_branch,
            list_accounts_cmd,
            switch_account_cmd,
            remove_account_cmd,
            set_repo_account_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
