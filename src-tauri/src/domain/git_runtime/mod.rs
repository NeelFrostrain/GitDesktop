pub mod detector;
pub mod downloader;

pub use detector::{
    detect_git_runtime, find_system_git, get_app_data_dir, get_mingit_bin_dirs,
    get_mingit_dir, get_mingit_executable, inject_git_path, is_mingit_installed, GitRuntimeInfo,
};
pub use downloader::{download_and_install_mingit, MinGitProgressPayload};
