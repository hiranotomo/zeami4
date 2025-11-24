/**
 * Tauri Commands for Settings
 *
 * Exposes settings functionality to the frontend.
 */

use crate::config::{backup, keychain, storage, Settings};
use anyhow::Result;

// ============================================================================
// Settings Commands
// ============================================================================

/// Load settings from disk and Keychain
#[tauri::command]
pub async fn load_settings() -> Result<Settings, String> {
    storage::load_settings().map_err(|e| e.to_string())
}

/// Save settings to disk and Keychain
#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> {
    // Create auto-backup before saving
    backup::create_auto_backup().ok(); // Don't fail if backup fails

    storage::save_settings(&settings).map_err(|e| e.to_string())
}

/// Reset settings to defaults
#[tauri::command]
pub async fn reset_settings() -> Result<Settings, String> {
    storage::reset_settings().map_err(|e| e.to_string())
}

/// Export settings to a file
#[tauri::command]
pub async fn export_settings(settings: Settings, path: String) -> Result<(), String> {
    storage::export_settings(&settings, &path, false).map_err(|e| e.to_string())
}

/// Import settings from a file
#[tauri::command]
pub async fn import_settings(path: String) -> Result<Settings, String> {
    storage::import_settings(&path).map_err(|e| e.to_string())
}

// ============================================================================
// Validation Commands
// ============================================================================

/// Test GitHub token validity
#[tauri::command]
pub async fn test_github_token(token: String) -> Result<TokenValidation, String> {
    use octocrab::Octocrab;

    let octocrab = Octocrab::builder()
        .personal_token(token)
        .build()
        .map_err(|e| e.to_string())?;

    match octocrab.current().user().await {
        Ok(user) => Ok(TokenValidation {
            valid: true,
            username: Some(user.login),
            scopes: Some(vec!["repo".to_string(), "workflow".to_string()]), // TODO: parse from headers
            error: None,
        }),
        Err(e) => Ok(TokenValidation {
            valid: false,
            username: None,
            scopes: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Validate repository exists and is accessible
#[tauri::command]
pub async fn validate_repository(
    owner: String,
    repo: String,
    token: String,
) -> Result<RepoValidation, String> {
    use octocrab::Octocrab;

    let octocrab = Octocrab::builder()
        .personal_token(token)
        .build()
        .map_err(|e| e.to_string())?;

    match octocrab.repos(&owner, &repo).get().await {
        Ok(repository) => Ok(RepoValidation {
            exists: true,
            has_issues: repository.has_issues.unwrap_or(false),
            has_wiki: repository.has_wiki.unwrap_or(false),
            default_branch: repository.default_branch,
            is_private: repository.private.unwrap_or(false),
            error: None,
        }),
        Err(e) => Ok(RepoValidation {
            exists: false,
            has_issues: false,
            has_wiki: false,
            default_branch: None,
            is_private: false,
            error: Some(e.to_string()),
        }),
    }
}

/// Validate file system path
#[tauri::command]
pub fn validate_path(path: String) -> Result<PathValidation, String> {
    use std::path::Path;

    let path = Path::new(&path);

    Ok(PathValidation {
        exists: path.exists(),
        is_directory: path.is_dir(),
        is_file: path.is_file(),
        is_writable: path.metadata().map(|m| !m.permissions().readonly()).unwrap_or(false),
        absolute_path: path.canonicalize().ok().map(|p| p.to_string_lossy().to_string()),
    })
}

// ============================================================================
// Backup Commands
// ============================================================================

/// List all backups
#[tauri::command]
pub fn list_backups() -> Result<Vec<BackupInfoDto>, String> {
    let backups = backup::list_backups().map_err(|e| e.to_string())?;

    Ok(backups
        .into_iter()
        .map(|b| BackupInfoDto {
            path: b.path.to_string_lossy().to_string(),
            filename: b.filename,
            created_at: b
                .created_at
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            size: b.size,
            size_human: b.size_human_readable(),
        })
        .collect())
}

/// Restore from a backup
#[tauri::command]
pub fn restore_backup(backup_path: String) -> Result<Settings, String> {
    use std::path::PathBuf;

    let path = PathBuf::from(backup_path);
    backup::restore_backup(&path).map_err(|e| e.to_string())?;

    // Load and return restored settings
    storage::load_settings().map_err(|e| e.to_string())
}

/// Delete a specific backup
#[tauri::command]
pub fn delete_backup(backup_path: String) -> Result<(), String> {
    use std::path::PathBuf;

    let path = PathBuf::from(backup_path);
    backup::delete_backup(&path).map_err(|e| e.to_string())
}

// ============================================================================
// Keychain Commands
// ============================================================================

/// Test if Keychain is accessible
#[tauri::command]
pub fn test_keychain_access() -> Result<bool, String> {
    // Try to access keychain by checking if a dummy secret exists
    Ok(keychain::secret_exists("test.dummy"))
}

// ============================================================================
// File Picker Commands
// ============================================================================

/// Open file picker dialog and return selected path
#[tauri::command]
pub async fn pick_settings_file() -> Result<String, String> {
    use tauri::api::dialog::FileDialogBuilder;

    // This is a placeholder - actual implementation would use Tauri's dialog API
    // In real implementation, you'd use:
    // let path = dialog::blocking::FileDialogBuilder::new()
    //     .add_filter("JSON", &["json"])
    //     .pick_file();

    Err("Not implemented - use Tauri dialog API".to_string())
}

// ============================================================================
// Data Transfer Objects
// ============================================================================

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct TokenValidation {
    pub valid: bool,
    pub username: Option<String>,
    pub scopes: Option<Vec<String>>,
    pub error: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct RepoValidation {
    pub exists: bool,
    pub has_issues: bool,
    pub has_wiki: bool,
    pub default_branch: Option<String>,
    pub is_private: bool,
    pub error: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct PathValidation {
    pub exists: bool,
    pub is_directory: bool,
    pub is_file: bool,
    pub is_writable: bool,
    pub absolute_path: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BackupInfoDto {
    pub path: String,
    pub filename: String,
    pub created_at: u64, // Unix timestamp
    pub size: u64,
    pub size_human: String,
}
