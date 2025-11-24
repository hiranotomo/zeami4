/**
 * Configuration Backup
 *
 * Handles backup and restore of settings.
 */

use anyhow::{Context, Result};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

use super::storage::{get_config_dir, get_config_file_path};

const BACKUP_DIR: &str = "backups";
const MAX_BACKUPS: usize = 5;

/// Get the backup directory path (~/.zeami/backups)
pub fn get_backup_dir() -> Result<PathBuf> {
    Ok(get_config_dir()?.join(BACKUP_DIR))
}

/// Ensure backup directory exists
pub fn ensure_backup_dir() -> Result<PathBuf> {
    let backup_dir = get_backup_dir()?;

    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).context("Failed to create backup directory")?;
    }

    Ok(backup_dir)
}

/// Create a backup of the current config file
pub fn create_backup(name: &str) -> Result<PathBuf> {
    let config_path = get_config_file_path()?;

    if !config_path.exists() {
        anyhow::bail!("Config file does not exist, cannot create backup");
    }

    // Ensure backup directory exists
    let backup_dir = ensure_backup_dir()?;

    // Generate backup filename with timestamp
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S");
    let backup_filename = format!("config-{}-{}.json", name, timestamp);
    let backup_path = backup_dir.join(&backup_filename);

    // Copy config file to backup
    fs::copy(&config_path, &backup_path)
        .with_context(|| format!("Failed to create backup: {:?}", backup_path))?;

    // Clean up old backups
    cleanup_old_backups()?;

    Ok(backup_path)
}

/// Create an automatic backup (before saving new settings)
pub fn create_auto_backup() -> Result<PathBuf> {
    create_backup("auto")
}

/// List all backups (sorted by creation time, newest first)
pub fn list_backups() -> Result<Vec<BackupInfo>> {
    let backup_dir = get_backup_dir()?;

    if !backup_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();

    for entry in fs::read_dir(&backup_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            let metadata = fs::metadata(&path)?;
            let modified = metadata.modified()?;

            backups.push(BackupInfo {
                path: path.clone(),
                filename: path
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .to_string(),
                created_at: modified,
                size: metadata.len(),
            });
        }
    }

    // Sort by creation time (newest first)
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

/// Restore settings from a backup
pub fn restore_backup(backup_path: &PathBuf) -> Result<()> {
    let config_path = get_config_file_path()?;

    // Create a backup of current config before restoring
    if config_path.exists() {
        create_backup("pre-restore")?;
    }

    // Copy backup to config location
    fs::copy(backup_path, &config_path)
        .with_context(|| format!("Failed to restore backup: {:?}", backup_path))?;

    Ok(())
}

/// Delete old backups, keeping only the most recent MAX_BACKUPS
fn cleanup_old_backups() -> Result<()> {
    let backups = list_backups()?;

    if backups.len() <= MAX_BACKUPS {
        return Ok(());
    }

    // Delete backups beyond MAX_BACKUPS
    for backup in backups.iter().skip(MAX_BACKUPS) {
        fs::remove_file(&backup.path)
            .with_context(|| format!("Failed to delete old backup: {:?}", backup.path))?;
    }

    Ok(())
}

/// Delete a specific backup
pub fn delete_backup(backup_path: &PathBuf) -> Result<()> {
    fs::remove_file(backup_path)
        .with_context(|| format!("Failed to delete backup: {:?}", backup_path))?;
    Ok(())
}

/// Delete all backups
pub fn delete_all_backups() -> Result<()> {
    let backup_dir = get_backup_dir()?;

    if backup_dir.exists() {
        fs::remove_dir_all(&backup_dir).context("Failed to delete backup directory")?;
    }

    Ok(())
}

// ============================================================================
// Backup Info
// ============================================================================

#[derive(Debug, Clone)]
pub struct BackupInfo {
    pub path: PathBuf,
    pub filename: String,
    pub created_at: std::time::SystemTime,
    pub size: u64,
}

impl BackupInfo {
    pub fn size_human_readable(&self) -> String {
        let size = self.size as f64;
        if size < 1024.0 {
            format!("{} B", size)
        } else if size < 1024.0 * 1024.0 {
            format!("{:.2} KB", size / 1024.0)
        } else {
            format!("{:.2} MB", size / (1024.0 * 1024.0))
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_create_and_list_backups() {
        // Ensure config exists
        let config_path = get_config_file_path().unwrap();
        if !config_path.exists() {
            fs::write(&config_path, "{}").unwrap();
        }

        // Create a backup
        let backup1 = create_backup("test1").unwrap();
        assert!(backup1.exists());

        // Wait a bit to ensure different timestamps
        thread::sleep(Duration::from_millis(100));

        // Create another backup
        let backup2 = create_backup("test2").unwrap();
        assert!(backup2.exists());

        // List backups
        let backups = list_backups().unwrap();
        assert!(backups.len() >= 2);

        // Most recent should be first
        assert!(backups[0].filename.contains("test2"));

        // Clean up
        delete_all_backups().ok();
    }

    #[test]
    fn test_restore_backup() {
        // Create config with content
        let config_path = get_config_file_path().unwrap();
        fs::write(&config_path, r#"{"test": "original"}"#).unwrap();

        // Create backup
        let backup_path = create_backup("restore-test").unwrap();

        // Modify config
        fs::write(&config_path, r#"{"test": "modified"}"#).unwrap();

        // Restore backup
        restore_backup(&backup_path).unwrap();

        // Verify restoration
        let contents = fs::read_to_string(&config_path).unwrap();
        assert!(contents.contains("original"));

        // Clean up
        delete_all_backups().ok();
    }

    #[test]
    fn test_cleanup_old_backups() {
        // Create more than MAX_BACKUPS
        for i in 0..MAX_BACKUPS + 2 {
            create_backup(&format!("cleanup-test-{}", i)).unwrap();
            thread::sleep(Duration::from_millis(100));
        }

        // List backups
        let backups = list_backups().unwrap();

        // Should only have MAX_BACKUPS
        assert_eq!(backups.len(), MAX_BACKUPS);

        // Clean up
        delete_all_backups().ok();
    }
}
