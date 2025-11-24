/// Integration tests for the file watcher module
///
/// These tests validate the behavior of the watcher system
/// including configuration, filtering, and event processing.

#[cfg(test)]
mod integration {
    use super::super::*;
    use std::path::PathBuf;

    #[test]
    fn test_config_validation() {
        let config = WatchConfig::default();
        assert!(config.validate().is_ok());

        let invalid = WatchConfig {
            targets: vec![],
            ..Default::default()
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_watch_target_priorities() {
        let claude = WatchTarget::claude_dir();
        let src = WatchTarget::src_dir();
        let git = WatchTarget::git_dir();

        assert!(claude.priority > src.priority);
        assert!(src.priority > git.priority);
    }

    #[test]
    fn test_event_classification() {
        use events::WatchEventKind;
        use std::path::Path;

        let cases = vec![
            ("/.claude/settings.json", WatchEventKind::ClaudeStateChanged),
            ("/.git/refs/heads/main", WatchEventKind::GitCommit),
            ("/src/main.rs", WatchEventKind::SourceChanged),
            ("/config.toml", WatchEventKind::ConfigChanged),
        ];

        for (path, expected) in cases {
            let result = WatchEventKind::classify_by_path(
                WatchEventKind::Modified,
                Path::new(path),
            );
            assert_eq!(result, expected, "Failed for path: {}", path);
        }
    }

    #[test]
    fn test_filter_comprehensive() {
        let filter = EventFilter::new();

        // Should filter
        let should_filter = vec![
            "/project/node_modules/pkg/index.js",
            "/project/target/debug/app",
            "/project/dist/bundle.js",
            "/project/.idea/workspace.xml",
            "/project/.DS_Store",
            "/project/file.tmp",
            "/project/.git/objects/abc123",
            "/project/Cargo.lock",
            "/project/test-results/report.json",
        ];

        for path in should_filter {
            assert!(
                !filter.should_watch(std::path::Path::new(path)),
                "Should have filtered: {}",
                path
            );
        }

        // Should watch
        let should_watch = vec![
            "/project/src/main.rs",
            "/project/.claude/settings.json",
            "/project/.git/refs/heads/main",
            "/project/README.md",
            "/project/package.json",
        ];

        for path in should_watch {
            assert!(
                filter.should_watch(std::path::Path::new(path)),
                "Should have watched: {}",
                path
            );
        }
    }

    #[test]
    fn test_event_priority_splitting() {
        use events::{WatchEvent, WatchEventBatch, WatchEventKind};

        let events = vec![
            WatchEvent::new(
                WatchEventKind::ClaudeStateChanged,
                vec![PathBuf::from("/.claude/state.json")],
                "claude",
            ),
            WatchEvent::new(
                WatchEventKind::Modified,
                vec![PathBuf::from("/src/main.rs")],
                "src",
            ),
            WatchEvent::new(
                WatchEventKind::GitCommit,
                vec![PathBuf::from("/.git/refs/heads/main")],
                "git",
            ),
            WatchEvent::new(
                WatchEventKind::Modified,
                vec![PathBuf::from("/README.md")],
                "project",
            ),
        ];

        let batch = WatchEventBatch::new(events);
        let (high, normal) = batch.split_by_priority();

        assert_eq!(high.len(), 2);
        assert_eq!(normal.len(), 2);

        // Verify high priority events
        assert!(high.iter().all(|e| e.is_high_priority()));
        assert!(normal.iter().all(|e| !e.is_high_priority()));
    }

    #[test]
    fn test_stats_calculation() {
        use service::WatcherStatsSnapshot;

        let snapshot = WatcherStatsSnapshot {
            raw_events: 1000,
            processed_events: 400,
            filtered_events: 600,
            events_emitted: 350,
            errors: 5,
        };

        // 600 out of 1000 = 60%
        assert_eq!(snapshot.filter_efficiency(), 60.0);

        // 350 out of 400 = 87.5%
        assert_eq!(snapshot.throughput(), 87.5);
    }
}

/// Performance tests for benchmarking
#[cfg(test)]
mod performance {
    use super::super::*;
    use std::path::PathBuf;

    #[test]
    fn bench_filter_performance() {
        let filter = EventFilter::new();
        let test_paths: Vec<PathBuf> = (0..10000)
            .map(|i| PathBuf::from(format!("/project/src/file_{}.rs", i)))
            .collect();

        let start = std::time::Instant::now();
        for path in &test_paths {
            filter.should_watch(path);
        }
        let elapsed = start.elapsed();

        println!("Filtered {} paths in {:?}", test_paths.len(), elapsed);
        println!("Average: {:?} per path", elapsed / test_paths.len() as u32);

        // Should be very fast (< 1ms for 10k paths)
        assert!(elapsed.as_millis() < 100);
    }

    #[test]
    fn bench_event_classification() {
        use events::WatchEventKind;
        use std::path::Path;

        let test_paths = vec![
            "/.claude/settings.json",
            "/.git/refs/heads/main",
            "/src/main.rs",
            "/config.toml",
            "/README.md",
        ];

        let iterations = 10000;
        let start = std::time::Instant::now();

        for _ in 0..iterations {
            for path in &test_paths {
                WatchEventKind::classify_by_path(
                    WatchEventKind::Modified,
                    Path::new(path),
                );
            }
        }

        let elapsed = start.elapsed();
        let total = iterations * test_paths.len();

        println!(
            "Classified {} events in {:?}",
            total,
            elapsed
        );
        println!(
            "Average: {:?} per event",
            elapsed / total as u32
        );

        // Should be extremely fast
        assert!(elapsed.as_millis() < 100);
    }
}
