use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Event filter for ignoring unwanted file system events
#[derive(Debug, Clone)]
pub struct EventFilter {
    /// Rules for filtering events
    rules: Vec<FilterRule>,

    /// Whether to log filtered events (for debugging)
    log_filtered: bool,
}

impl EventFilter {
    /// Create a new event filter with default rules
    pub fn new() -> Self {
        Self {
            rules: Self::default_rules(),
            log_filtered: false,
        }
    }

    /// Create filter with custom rules
    pub fn with_rules(rules: Vec<FilterRule>) -> Self {
        Self {
            rules,
            log_filtered: false,
        }
    }

    /// Enable logging of filtered events
    pub fn log_filtered(mut self, log: bool) -> Self {
        self.log_filtered = log;
        self
    }

    /// Check if a path should be watched (not filtered)
    pub fn should_watch(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();

        for rule in &self.rules {
            if rule.matches(&path_str) {
                if self.log_filtered {
                    eprintln!("[Filter] Ignoring: {} (rule: {:?})", path_str, rule.kind);
                }
                return false;
            }
        }

        true
    }

    /// Default filtering rules
    fn default_rules() -> Vec<FilterRule> {
        vec![
            // Build artifacts
            FilterRule::contains("node_modules", FilterKind::BuildArtifact),
            FilterRule::contains("/target/", FilterKind::BuildArtifact),
            FilterRule::contains("/dist/", FilterKind::BuildArtifact),
            FilterRule::contains("/build/", FilterKind::BuildArtifact),
            FilterRule::contains("/.next/", FilterKind::BuildArtifact),
            FilterRule::contains("/out/", FilterKind::BuildArtifact),
            // Temporary files
            FilterRule::extension("tmp", FilterKind::TemporaryFile),
            FilterRule::extension("temp", FilterKind::TemporaryFile),
            FilterRule::extension("swp", FilterKind::TemporaryFile),
            FilterRule::extension("swo", FilterKind::TemporaryFile),
            FilterRule::starts_with("~", FilterKind::TemporaryFile),
            FilterRule::starts_with(".", FilterKind::Hidden).exceptions(vec![
                ".claude",
                ".git",
                ".env",
                ".gitignore",
                ".github",
            ]),
            // Lock files (generated)
            FilterRule::ends_with("package-lock.json", FilterKind::LockFile),
            FilterRule::ends_with("yarn.lock", FilterKind::LockFile),
            FilterRule::ends_with("pnpm-lock.yaml", FilterKind::LockFile),
            FilterRule::ends_with("Cargo.lock", FilterKind::LockFile),
            // IDE files
            FilterRule::contains("/.idea/", FilterKind::IDE),
            FilterRule::contains("/.vscode/", FilterKind::IDE),
            FilterRule::contains("/.vs/", FilterKind::IDE),
            FilterRule::extension("iml", FilterKind::IDE),
            // OS files
            FilterRule::ends_with(".DS_Store", FilterKind::OSFile),
            FilterRule::ends_with("Thumbs.db", FilterKind::OSFile),
            FilterRule::ends_with("desktop.ini", FilterKind::OSFile),
            // Git internals (except refs and HEAD)
            FilterRule::contains("/.git/objects/", FilterKind::GitInternal),
            FilterRule::contains("/.git/logs/", FilterKind::GitInternal),
            // Log files
            FilterRule::extension("log", FilterKind::LogFile),
            // Test reports
            FilterRule::contains("/test-results/", FilterKind::TestArtifact),
            FilterRule::contains("/playwright-report/", FilterKind::TestArtifact),
            FilterRule::contains("/coverage/", FilterKind::TestArtifact),
        ]
    }

    /// Add a custom rule
    pub fn add_rule(&mut self, rule: FilterRule) {
        self.rules.push(rule);
    }

    /// Clear all rules
    pub fn clear_rules(&mut self) {
        self.rules.clear();
    }

    /// Get statistics about filtering
    pub fn stats(&self) -> FilterStats {
        let mut stats = FilterStats::default();
        for rule in &self.rules {
            match rule.kind {
                FilterKind::BuildArtifact => stats.build_artifact_rules += 1,
                FilterKind::TemporaryFile => stats.temp_file_rules += 1,
                FilterKind::LockFile => stats.lock_file_rules += 1,
                FilterKind::IDE => stats.ide_rules += 1,
                FilterKind::OSFile => stats.os_file_rules += 1,
                FilterKind::GitInternal => stats.git_internal_rules += 1,
                FilterKind::LogFile => stats.log_file_rules += 1,
                FilterKind::TestArtifact => stats.test_artifact_rules += 1,
                FilterKind::Hidden => stats.hidden_rules += 1,
                FilterKind::Custom => stats.custom_rules += 1,
            }
        }
        stats
    }
}

impl Default for EventFilter {
    fn default() -> Self {
        Self::new()
    }
}

/// A single filter rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterRule {
    /// Type of filter
    pub kind: FilterKind,

    /// Pattern to match
    pub pattern: String,

    /// Match type
    pub match_type: MatchType,

    /// Exceptions to this rule
    pub exceptions: Vec<String>,
}

impl FilterRule {
    /// Create a rule that matches if path contains pattern
    pub fn contains(pattern: impl Into<String>, kind: FilterKind) -> Self {
        Self {
            kind,
            pattern: pattern.into(),
            match_type: MatchType::Contains,
            exceptions: vec![],
        }
    }

    /// Create a rule that matches file extension
    pub fn extension(ext: impl Into<String>, kind: FilterKind) -> Self {
        let ext = ext.into();
        Self {
            kind,
            pattern: if ext.starts_with('.') {
                ext
            } else {
                format!(".{}", ext)
            },
            match_type: MatchType::Extension,
            exceptions: vec![],
        }
    }

    /// Create a rule that matches if path starts with pattern
    pub fn starts_with(pattern: impl Into<String>, kind: FilterKind) -> Self {
        Self {
            kind,
            pattern: pattern.into(),
            match_type: MatchType::StartsWith,
            exceptions: vec![],
        }
    }

    /// Create a rule that matches if path ends with pattern
    pub fn ends_with(pattern: impl Into<String>, kind: FilterKind) -> Self {
        Self {
            kind,
            pattern: pattern.into(),
            match_type: MatchType::EndsWith,
            exceptions: vec![],
        }
    }

    /// Add exceptions to this rule
    pub fn exceptions(mut self, exceptions: Vec<&str>) -> Self {
        self.exceptions = exceptions.iter().map(|s| s.to_string()).collect();
        self
    }

    /// Check if this rule matches a path
    fn matches(&self, path: &str) -> bool {
        // Check exceptions first
        for exception in &self.exceptions {
            if path.contains(exception) {
                return false;
            }
        }

        match self.match_type {
            MatchType::Contains => path.contains(&self.pattern),
            MatchType::Extension => path.ends_with(&self.pattern),
            MatchType::StartsWith => {
                let filename = Path::new(path)
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or("");
                filename.starts_with(&self.pattern)
            }
            MatchType::EndsWith => path.ends_with(&self.pattern),
            MatchType::Regex => {
                // Simple regex support could be added here
                false
            }
        }
    }
}

/// Type of filter rule
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FilterKind {
    BuildArtifact,
    TemporaryFile,
    LockFile,
    IDE,
    OSFile,
    GitInternal,
    LogFile,
    TestArtifact,
    Hidden,
    Custom,
}

/// How to match the pattern
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum MatchType {
    Contains,
    Extension,
    StartsWith,
    EndsWith,
    Regex,
}

/// Statistics about filter rules
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct FilterStats {
    pub build_artifact_rules: usize,
    pub temp_file_rules: usize,
    pub lock_file_rules: usize,
    pub ide_rules: usize,
    pub os_file_rules: usize,
    pub git_internal_rules: usize,
    pub log_file_rules: usize,
    pub test_artifact_rules: usize,
    pub hidden_rules: usize,
    pub custom_rules: usize,
}

impl FilterStats {
    pub fn total(&self) -> usize {
        self.build_artifact_rules
            + self.temp_file_rules
            + self.lock_file_rules
            + self.ide_rules
            + self.os_file_rules
            + self.git_internal_rules
            + self.log_file_rules
            + self.test_artifact_rules
            + self.hidden_rules
            + self.custom_rules
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_node_modules() {
        let filter = EventFilter::new();
        assert!(!filter.should_watch(Path::new("/project/node_modules/pkg/index.js")));
        assert!(filter.should_watch(Path::new("/project/src/index.js")));
    }

    #[test]
    fn test_filter_build_artifacts() {
        let filter = EventFilter::new();
        assert!(!filter.should_watch(Path::new("/project/target/debug/app")));
        assert!(!filter.should_watch(Path::new("/project/dist/bundle.js")));
        assert!(filter.should_watch(Path::new("/project/src/main.rs")));
    }

    #[test]
    fn test_filter_temporary_files() {
        let filter = EventFilter::new();
        assert!(!filter.should_watch(Path::new("/project/file.tmp")));
        assert!(!filter.should_watch(Path::new("/project/.file.swp")));
        assert!(filter.should_watch(Path::new("/project/file.txt")));
    }

    #[test]
    fn test_filter_hidden_with_exceptions() {
        let filter = EventFilter::new();
        // Should watch .claude (exception)
        assert!(filter.should_watch(Path::new("/project/.claude/settings.json")));
        // Should watch .git (exception)
        assert!(filter.should_watch(Path::new("/project/.git/HEAD")));
        // Should NOT watch other hidden files
        assert!(!filter.should_watch(Path::new("/project/.random_hidden")));
    }

    #[test]
    fn test_filter_ide_files() {
        let filter = EventFilter::new();
        assert!(!filter.should_watch(Path::new("/project/.idea/workspace.xml")));
        assert!(!filter.should_watch(Path::new("/project/.vscode/settings.json")));
        assert!(filter.should_watch(Path::new("/project/src/main.rs")));
    }

    #[test]
    fn test_filter_stats() {
        let filter = EventFilter::new();
        let stats = filter.stats();
        assert!(stats.total() > 0);
        assert!(stats.build_artifact_rules > 0);
        assert!(stats.temp_file_rules > 0);
    }

    #[test]
    fn test_custom_rule() {
        let mut filter = EventFilter::new();
        filter.add_rule(FilterRule::contains("/custom/", FilterKind::Custom));
        assert!(!filter.should_watch(Path::new("/project/custom/file.txt")));
    }

    #[test]
    fn test_git_filtering() {
        let filter = EventFilter::new();
        // Should NOT watch git objects
        assert!(!filter.should_watch(Path::new("/.git/objects/ab/cdef123")));
        // Should watch git refs (for commit detection)
        assert!(filter.should_watch(Path::new("/.git/refs/heads/main")));
        assert!(filter.should_watch(Path::new("/.git/HEAD")));
    }
}
