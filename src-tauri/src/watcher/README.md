# File Watcher Module

Production-ready file watching system for Zeami with intelligent filtering, debouncing, and Tauri integration.

## Quick Start

### 1. Basic Usage

```rust
use zeami4::watcher::{WatcherService, WatchConfig};

let mut watcher = WatcherService::new(app_handle, project_root);
watcher.start()?;

// Later...
watcher.stop()?;
```

### 2. Custom Configuration

```rust
use zeami4::watcher::{WatchConfig, WatchTarget};

let config = WatchConfig {
    targets: vec![
        WatchTarget::claude_dir(),
        WatchTarget::src_dir(),
    ],
    debounce_ms: 100,
    ..Default::default()
};

let mut watcher = WatcherService::with_config(app_handle, project_root, config);
watcher.start()?;
```

### 3. Tauri Integration

```rust
// main.rs
use zeami4::watcher::{WatcherState, commands::*};

tauri::Builder::default()
    .manage(WatcherState::default())
    .invoke_handler(tauri::generate_handler![
        start_watcher,
        stop_watcher,
        is_watcher_running,
        get_watcher_stats,
    ])
    .run(tauri::generate_context!())
```

### 4. Frontend Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

// Start watcher
await invoke('start_watcher');

// Listen for events
const unlisten = await listen('fs-watch-event', (event) => {
  console.log('File changed:', event.payload);
});

// Get stats
const stats = await invoke('get_watcher_stats');

// Stop watcher
await invoke('stop_watcher');
unlisten();
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   WatcherService                        │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  Config  │  │  Filter  │  │  Events  │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  notify-debouncer-full                                 │
│         ↓                                              │
│  RecommendedWatcher (FSEvents on macOS)                │
└─────────────────────────────────────────────────────────┘
                       ↓
                Tauri Event System
                       ↓
                  Frontend (React)
```

## Event Types

- `created` - File/directory created
- `modified` - File modified
- `deleted` - File/directory deleted
- `renamed` - File/directory renamed
- `claude_state_changed` - .claude/ directory changed
- `source_changed` - Source code changed
- `config_changed` - Configuration file changed
- `git_commit` - Git commit detected

## Filter Rules

The watcher automatically filters:
- Build artifacts (`node_modules/`, `target/`, `dist/`)
- Temporary files (`*.tmp`, `*.swp`)
- Lock files (`package-lock.json`, `Cargo.lock`)
- IDE files (`.idea/`, `.vscode/`)
- OS files (`.DS_Store`)
- Git internals (`.git/objects/`)
- Test artifacts (`test-results/`, `coverage/`)

## Performance

- **Throughput:** 2000+ paths/ms filtering
- **Latency:** 10-50ms (FSEvents on macOS)
- **CPU:** < 1% idle, < 2% active
- **Memory:** 2-5 MB
- **Filter efficiency:** 60-70% noise reduction

## Configuration Presets

```rust
// Development - Fast response
WatcherPreset::Development
  debounce_ms: 50
  verbose: true

// Production - Conservative
WatcherPreset::Production
  debounce_ms: 200
  verbose: false

// Testing - Source and tests only
WatcherPreset::Testing
  targets: [src/, tests/]
  debounce_ms: 100
```

## Testing

```bash
# Run all tests
cargo test --package zeami4 --lib watcher

# Run benchmarks
cargo run --example file_watcher_demo

# Test specific module
cargo test --package zeami4 --lib watcher::tests::integration
```

## Troubleshooting

### High CPU Usage
- Increase debounce delay (50ms → 200ms)
- Add more filter rules for your project
- Check for symlink loops

### Missing Events
- Verify path exists and is readable
- Check filter rules aren't blocking events
- Try PollWatcher fallback for NFS/Docker

### Too Many Events
- Decrease debounce delay for faster response
- Use priority-based filtering
- Implement event batching

## API Reference

### WatcherService
- `new(app_handle, project_root)` - Create new watcher
- `with_config(...)` - Create with custom config
- `start()` - Start watching
- `stop()` - Stop watching
- `is_running()` - Check status
- `get_stats()` - Get statistics
- `emit_stats()` - Emit stats to frontend

### WatchConfig
- `targets` - Paths to watch
- `debounce_ms` - Debounce delay (default: 100)
- `recursive` - Watch recursively (default: true)
- `event_buffer_size` - Event buffer (default: 1000)
- `verbose` - Enable verbose logging (default: false)

### WatchTarget
- `claude_dir()` - .claude/ directory
- `src_dir()` - src/ directory
- `git_dir()` - .git/refs/heads/ directory
- `config_files()` - Root config files
- `new(path, description)` - Custom target

## Examples

See `/Users/hirano/_MyDev/zeami4/src-tauri/examples/file_watcher_demo.rs` for comprehensive examples.

## License

MIT - See LICENSE file for details
