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
            rename_branch,
            delete_branch,
            push_branch,
            check_lfs_installed,
            list_lfs_files,
            track_lfs_pattern,
            untrack_lfs_pattern,
            list_lfs_locks,
            lock_lfs_file,
            unlock_lfs_file,
            list_worktrees,
            create_worktree,
            remove_worktree,
            open_in_terminal_cmd,
            open_in_vscode_cmd,
            show_in_explorer_cmd,
            create_repository_cmd,
            get_rebase_commits_cmd,

            execute_rebase_cmd,
            rebase_continue_cmd,
            rebase_abort_cmd,
            rebase_skip_cmd,
            rewrite_history_cmd,
            cherry_pick_commits_cmd,

            cherry_pick_continue_cmd,
            cherry_pick_abort_cmd,
            list_stashes_cmd,
            create_stash_cmd,
            apply_stash_cmd,
            pop_stash_cmd,
            drop_stash_cmd,
            get_stash_diff_cmd,
            list_tags_cmd,
            create_tag_cmd,
            delete_tag_cmd,
            push_tags_cmd,
            get_file_blame_cmd,
            list_reflog_cmd,
            restore_reflog_target_cmd,
            revert_commit_cmd,
            export_patch_cmd,
            apply_patch_cmd,
            get_repo_git_config_cmd,
            set_repo_git_config_cmd,
            get_git_user_identity_cmd,
            read_gitignore_cmd,

            write_gitignore_cmd,
            list_submodules_cmd,
            init_submodules_cmd,
            update_submodules_cmd,
            sync_submodules_cmd,
            discard_file_changes_cmd,
            ignore_file_pattern_cmd,
            open_file_default_cmd,
            list_accounts_cmd,
            switch_account_cmd,
            remove_account_cmd,
            update_account_info_cmd,
            set_repo_account_cmd,
            login_github_pat,
            get_github_user,
            log_action_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



