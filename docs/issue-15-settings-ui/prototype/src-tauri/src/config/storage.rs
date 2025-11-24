/**
 * Settings Storage
 *
 * Handles reading/writing settings to disk and coordinating with Keychain.
 */

use anyhow::{Context, Result};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

use super::keychain;
use super::{
    ConfigFile, ConfigMetadata, Settings, CURRENT_SCHEMA_VERSION, CONFIG_DIR, CONFIG_FILE,
};

/// Get the config directory path (~/.zeami)
pub fn get_config_dir() -> Result<PathBuf> {
    let home_dir = dirs::home_dir().context("Could not find home directory")?;
    Ok(home_dir.join(CONFIG_DIR))
}

/// Get the config file path (~/.zeami/config.json)
pub fn get_config_file_path() -> Result<PathBuf> {
    Ok(get_config_dir()?.join(CONFIG_FILE))
}

/// Ensure config directory exists with proper permissions
pub fn ensure_config_dir() -> Result<PathBuf> {
    let config_dir = get_config_dir()?;

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).context("Failed to create config directory")?;

        // Set directory permissions to 0700 (user read/write/execute only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = fs::metadata(&config_dir)?;
            let mut permissions = metadata.permissions();
            permissions.set_mode(0o700);
            fs::set_permissions(&config_dir, permissions)?;
        }
    }

    Ok(config_dir)
}

/// Load settings from disk and Keychain
pub fn load_settings() -> Result<Settings> {
    let config_path = get_config_file_path()?;

    // If config file doesn't exist, return defaults
    if !config_path.exists() {
        return Ok(Settings::default());
    }

    // Read config file
    let contents = fs::read_to_string(&config_path)
        .with_context(|| format!("Failed to read config file: {:?}", config_path))?;

    // Parse JSON
    let config_file: ConfigFile = serde_json::from_str(&contents)
        .context("Failed to parse config file as JSON")?;

    // Load settings
    let mut settings = config_file.settings;

    // Load secrets from Keychain
    if let Ok(github_token) = keychain::retrieve_github_token() {
        settings.github.token = github_token;
    }

    if let Ok(claude_api_key) = keychain::retrieve_claude_api_key() {
        settings.claude.api_key = claude_api_key;
    }

    Ok(settings)
}

/// Save settings to disk and Keychain
pub fn save_settings(settings: &Settings) -> Result<()> {
    // Ensure config directory exists
    ensure_config_dir()?;

    // Store secrets in Keychain
    if !settings.github.token.is_empty() {
        keychain::store_github_token(&settings.github.token)
            .context("Failed to store GitHub token in Keychain")?;
    }

    if !settings.claude.api_key.is_empty() {
        keychain::store_claude_api_key(&settings.claude.api_key)
            .context("Failed to store Claude API key in Keychain")?;
    }

    // Create config file (without secrets)
    let config_file = ConfigFile {
        version: "1.0.0".to_string(),
        settings: settings.clone(),
        metadata: ConfigMetadata {
            schema_version: CURRENT_SCHEMA_VERSION,
            last_modified: Utc::now(),
            created_at: Utc::now(), // TODO: preserve original created_at
        },
    };

    // Serialize to JSON (pretty-printed for readability)
    let json = serde_json::to_string_pretty(&config_file)
        .context("Failed to serialize settings to JSON")?;

    // Write to file
    let config_path = get_config_file_path()?;
    fs::write(&config_path, json)
        .with_context(|| format!("Failed to write config file: {:?}", config_path))?;

    // Set file permissions to 0600 (user read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = fs::metadata(&config_path)?;
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o600);
        fs::set_permissions(&config_path, permissions)?;
    }

    Ok(())
}

/// Reset settings to defaults
pub fn reset_settings() -> Result<Settings> {
    let defaults = Settings::default();
    save_settings(&defaults)?;
    Ok(defaults)
}

/// Export settings to a file (excluding secrets by default)
pub fn export_settings(settings: &Settings, path: &str, include_secrets: bool) -> Result<()> {
    let mut export_settings = settings.clone();

    // Remove secrets unless explicitly included
    if !include_secrets {
        export_settings.github.token = String::new();
        export_settings.claude.api_key = String::new();
    }

    let export_data = serde_json::json!({
        "zeami_settings_export": true,
        "version": "1.0.0",
        "exported_at": Utc::now(),
        "settings": export_settings,
        "secrets_included": include_secrets,
    });

    let json = serde_json::to_string_pretty(&export_data)
        .context("Failed to serialize export data")?;

    // Expand ~ in path
    let path = shellexpand::tilde(path);
    let export_path = PathBuf::from(path.as_ref());

    fs::write(&export_path, json)
        .with_context(|| format!("Failed to write export file: {:?}", export_path))?;

    Ok(())
}

/// Import settings from a file
pub fn import_settings(path: &str) -> Result<Settings> {
    // Expand ~ in path
    let path = shellexpand::tilde(path);
    let import_path = PathBuf::from(path.as_ref());

    // Read import file
    let contents = fs::read_to_string(&import_path)
        .with_context(|| format!("Failed to read import file: {:?}", import_path))?;

    // Parse JSON
    let import_data: serde_json::Value = serde_json::from_str(&contents)
        .context("Failed to parse import file as JSON")?;

    // Verify it's a Zeami settings export
    if !import_data["zeami_settings_export"].as_bool().unwrap_or(false) {
        anyhow::bail!("File is not a valid Zeami settings export");
    }

    // Extract settings
    let settings: Settings = serde_json::from_value(import_data["settings"].clone())
        .context("Failed to parse settings from import file")?;

    // Validate settings (basic validation)
    // TODO: Add comprehensive validation using the Zod schema

    Ok(settings)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_config_dir() {
        let config_dir = get_config_dir().unwrap();
        assert!(config_dir.ends_with(".zeami"));
    }

    #[test]
    fn test_save_and_load_settings() {
        let mut settings = Settings::default();
        settings.github.repository = "test/repo".to_string();
        settings.github.token = "ghp_test_token".to_string();

        // Save settings
        save_settings(&settings).unwrap();

        // Load settings
        let loaded = load_settings().unwrap();

        // Verify (excluding token which is in Keychain)
        assert_eq!(loaded.github.repository, "test/repo");
        assert_eq!(loaded.github.token, "ghp_test_token");

        // Clean up
        keychain::delete_github_token().ok();
    }

    #[test]
    fn test_export_settings() {
        let settings = Settings::default();
        let temp_path = "/tmp/zeami_test_export.json";

        // Export settings
        export_settings(&settings, temp_path, false).unwrap();

        // Verify file exists
        assert!(PathBuf::from(temp_path).exists());

        // Clean up
        fs::remove_file(temp_path).ok();
    }

    #[test]
    fn test_import_settings() {
        let settings = Settings::default();
        let temp_path = "/tmp/zeami_test_import.json";

        // Export first
        export_settings(&settings, temp_path, false).unwrap();

        // Import
        let imported = import_settings(temp_path).unwrap();

        // Verify
        assert_eq!(imported.github.default_branch, settings.github.default_branch);

        // Clean up
        fs::remove_file(temp_path).ok();
    }
}
