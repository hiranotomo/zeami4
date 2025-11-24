/**
 * Configuration Migration
 *
 * Handles schema version migrations for settings.
 */

use anyhow::{Context, Result};
use serde_json::Value;

use super::CURRENT_SCHEMA_VERSION;
use super::backup;

/// Migrate configuration from old schema version to current
pub fn migrate_config(old_version: u32, config: &mut Value) -> Result<()> {
    if old_version >= CURRENT_SCHEMA_VERSION {
        // No migration needed
        return Ok(());
    }

    // Create backup before migration
    let backup_name = format!("pre-migration-v{}-to-v{}", old_version, CURRENT_SCHEMA_VERSION);
    backup::create_backup(&backup_name)?;

    // Apply migrations sequentially
    let mut current_version = old_version;

    while current_version < CURRENT_SCHEMA_VERSION {
        match current_version {
            0 => {
                migrate_v0_to_v1(config)?;
                current_version = 1;
            }
            // Future migrations will go here
            // 1 => {
            //     migrate_v1_to_v2(config)?;
            //     current_version = 2;
            // }
            _ => {
                anyhow::bail!("Unsupported schema version: {}", current_version);
            }
        }
    }

    Ok(())
}

/// Migrate from v0 (no schema) to v1 (first schema)
fn migrate_v0_to_v1(config: &mut Value) -> Result<()> {
    // V0 to V1 migration example:
    // - Add new fields with defaults
    // - Rename fields
    // - Transform data structures

    // Example: Add new UI settings if they don't exist
    if config.get("ui").is_none() {
        config["ui"] = serde_json::json!({
            "theme": "dark",
            "accent_color": "#3b82f6",
            "sidebar_position": "left",
            "sidebar_width": 300,
            "compact_mode": false,
            "show_notifications": true,
            "notification_sound": false,
            "notification_position": "top-right",
            "show_welcome_screen": true,
            "confirm_before_quit": false,
            "language": "en",
        });
    }

    // Example: Rename old field to new field
    if let Some(github) = config.get_mut("github") {
        // Rename "repo" to "repository" if old field exists
        if let Some(repo) = github.get("repo").cloned() {
            github["repository"] = repo;
            github.as_object_mut().unwrap().remove("repo");
        }
    }

    Ok(())
}

/// Detect schema version from config file
pub fn detect_schema_version(config: &Value) -> u32 {
    config
        .get("metadata")
        .and_then(|m| m.get("schema_version"))
        .and_then(|v| v.as_u64())
        .map(|v| v as u32)
        .unwrap_or(0) // Default to v0 if no version found
}

/// Validate that migration was successful
pub fn validate_migrated_config(config: &Value) -> Result<()> {
    // Basic validation checks

    // Check that all required top-level keys exist
    let required_keys = ["github", "git", "terminal", "ui", "workflow", "claude", "test"];
    for key in &required_keys {
        if config.get(key).is_none() {
            anyhow::bail!("Missing required settings category: {}", key);
        }
    }

    // Check metadata
    if config.get("metadata").is_none() {
        anyhow::bail!("Missing metadata");
    }

    let metadata = config.get("metadata").unwrap();
    let schema_version = metadata
        .get("schema_version")
        .and_then(|v| v.as_u64())
        .context("Missing or invalid schema_version")?;

    if schema_version != CURRENT_SCHEMA_VERSION as u64 {
        anyhow::bail!(
            "Schema version mismatch: expected {}, got {}",
            CURRENT_SCHEMA_VERSION,
            schema_version
        );
    }

    Ok(())
}

// ============================================================================
// Migration History
// ============================================================================

/// Get migration history description
pub fn get_migration_description(from_version: u32, to_version: u32) -> String {
    if from_version == to_version {
        return "No migration needed".to_string();
    }

    let mut descriptions = Vec::new();

    for version in from_version..to_version {
        let desc = match version {
            0 => "v0 → v1: Added UI settings, renamed GitHub 'repo' to 'repository'",
            // Future migrations:
            // 1 => "v1 → v2: Added Claude settings, reorganized workflow settings",
            _ => "Unknown migration",
        };
        descriptions.push(desc);
    }

    descriptions.join("\n")
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_detect_schema_version() {
        let config = json!({
            "metadata": {
                "schema_version": 1
            }
        });

        assert_eq!(detect_schema_version(&config), 1);
    }

    #[test]
    fn test_detect_schema_version_missing() {
        let config = json!({});
        assert_eq!(detect_schema_version(&config), 0);
    }

    #[test]
    fn test_migrate_v0_to_v1() {
        let mut config = json!({
            "github": {
                "repo": "owner/repo"
            }
        });

        migrate_v0_to_v1(&mut config).unwrap();

        // Check that repo was renamed to repository
        assert!(config["github"]["repository"].is_string());
        assert_eq!(config["github"]["repository"], "owner/repo");
        assert!(config["github"].get("repo").is_none());

        // Check that UI settings were added
        assert!(config["ui"].is_object());
        assert_eq!(config["ui"]["theme"], "dark");
    }

    #[test]
    fn test_validate_migrated_config() {
        let valid_config = json!({
            "version": "1.0.0",
            "settings": {
                "github": {},
                "git": {},
                "terminal": {},
                "ui": {},
                "workflow": {},
                "claude": {},
                "test": {}
            },
            "metadata": {
                "schema_version": 1,
                "last_modified": "2025-11-24T12:00:00Z",
                "created_at": "2025-11-24T12:00:00Z"
            }
        });

        assert!(validate_migrated_config(&valid_config["settings"]).is_err()); // Missing metadata at settings level

        let valid_config = json!({
            "github": {},
            "git": {},
            "terminal": {},
            "ui": {},
            "workflow": {},
            "claude": {},
            "test": {},
            "metadata": {
                "schema_version": 1,
                "last_modified": "2025-11-24T12:00:00Z"
            }
        });

        validate_migrated_config(&valid_config).unwrap();
    }

    #[test]
    fn test_get_migration_description() {
        let desc = get_migration_description(0, 1);
        assert!(desc.contains("v0 → v1"));
        assert!(desc.contains("UI settings"));
    }
}
