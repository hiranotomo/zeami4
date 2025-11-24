use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

/// Configuration for the file watcher service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchConfig {
    /// List of targets to watch
    pub targets: Vec<WatchTarget>,

    /// Debounce delay in milliseconds
    pub debounce_ms: u64,

    /// Whether to use recursive watching
    pub recursive: bool,

    /// Maximum number of events to buffer
    pub event_buffer_size: usize,

    /// Enable verbose logging
    pub verbose: bool,
}

impl Default for WatchConfig {
    fn default() -> Self {
        Self {
            targets: vec![
                WatchTarget::claude_dir(),
                WatchTarget::src_dir(),
                WatchTarget::config_files(),
            ],
            debounce_ms: 100,
            recursive: true,
            event_buffer_size: 1000,
            verbose: false,
        }
    }
}

impl WatchConfig {
    /// Create a new configuration with custom settings
    pub fn new(targets: Vec<WatchTarget>, debounce_ms: u64) -> Self {
        Self {
            targets,
            debounce_ms,
            ..Default::default()
        }
    }

    /// Get debounce duration
    pub fn debounce_duration(&self) -> Duration {
        Duration::from_millis(self.debounce_ms)
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<(), String> {
        if self.targets.is_empty() {
            return Err("At least one watch target must be specified".to_string());
        }

        if self.debounce_ms == 0 {
            return Err("Debounce delay must be greater than 0".to_string());
        }

        if self.debounce_ms > 10000 {
            return Err("Debounce delay should not exceed 10 seconds".to_string());
        }

        Ok(())
    }
}

/// Represents a directory or file to watch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchTarget {
    /// Path to watch (relative to project root)
    pub path: PathBuf,

    /// Description of what this target is for
    pub description: String,

    /// Whether to watch recursively
    pub recursive: bool,

    /// Priority level (higher = more important)
    pub priority: u8,
}

impl WatchTarget {
    /// Create a new watch target
    pub fn new(path: impl Into<PathBuf>, description: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            description: description.into(),
            recursive: true,
            priority: 5,
        }
    }

    /// Set recursion mode
    pub fn recursive(mut self, recursive: bool) -> Self {
        self.recursive = recursive;
        self
    }

    /// Set priority
    pub fn priority(mut self, priority: u8) -> Self {
        self.priority = priority;
        self
    }

    /// Create target for .claude directory (Claude Code state)
    pub fn claude_dir() -> Self {
        Self::new(".claude", "Claude Code configuration and state")
            .recursive(true)
            .priority(10)
    }

    /// Create target for src directory (source code changes)
    pub fn src_dir() -> Self {
        Self::new("src", "Source code for test re-runs")
            .recursive(true)
            .priority(8)
    }

    /// Create target for .git directory (commit detection)
    pub fn git_dir() -> Self {
        Self::new(".git/refs/heads", "Git commit detection")
            .recursive(true)
            .priority(7)
    }

    /// Create target for config files
    pub fn config_files() -> Self {
        Self::new(".", "Configuration files")
            .recursive(false)
            .priority(6)
    }

    /// Resolve path relative to project root
    pub fn resolve_path(&self, project_root: &std::path::Path) -> PathBuf {
        project_root.join(&self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = WatchConfig::default();
        assert_eq!(config.debounce_ms, 100);
        assert!(config.recursive);
        assert_eq!(config.targets.len(), 3);
    }

    #[test]
    fn test_config_validation() {
        let mut config = WatchConfig::default();
        assert!(config.validate().is_ok());

        config.targets.clear();
        assert!(config.validate().is_err());

        config.targets.push(WatchTarget::claude_dir());
        config.debounce_ms = 0;
        assert!(config.validate().is_err());

        config.debounce_ms = 15000;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_watch_target_creation() {
        let target = WatchTarget::claude_dir();
        assert_eq!(target.path, PathBuf::from(".claude"));
        assert_eq!(target.priority, 10);
        assert!(target.recursive);
    }

    #[test]
    fn test_path_resolution() {
        let target = WatchTarget::src_dir();
        let root = std::path::Path::new("/Users/test/project");
        let resolved = target.resolve_path(root);
        assert_eq!(resolved, root.join("src"));
    }
}
