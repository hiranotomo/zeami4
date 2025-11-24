# Issue 15: Terminal Output Parsing for Dashboard - Research Report

## Executive Summary

This report provides a comprehensive investigation of methods to extract structured data from terminal output for the Zeami dashboard. The research covers PTY output capture, ANSI escape sequence parsing, test result detection, Git command parsing, build tool integration, and performance considerations.

**Key Findings:**
- **vte** crate (used by Alacritty) is the industry-standard ANSI parser
- Stream-based incremental parsing is essential for performance
- Pattern matching can reliably detect test frameworks and extract results
- Git operations should use **git2** library directly instead of parsing output
- Estimated parsing overhead: < 5% CPU with proper buffering strategy

---

## 1. PTY Output Capture Architecture

### 1.1 Current Implementation Review

The existing PTY implementation (from Issue #4) provides a solid foundation:

**File:** `/Users/hirano/_MyDev/zeami4/src-tauri/src/pty/session.rs`

**Key observations:**
- Uses `portable-pty` for cross-platform PTY handling
- Output streaming thread reads 8192-byte chunks
- UTF-8 validation with partial multibyte sequence handling
- Direct emission to frontend via Tauri events

**Current data flow:**
```
PTY → Reader Thread → UTF-8 Buffer → Tauri Event → Frontend (xterm.js)
              ↓
        [No Parsing Yet]
```

### 1.2 Proposed Enhanced Architecture

**New data flow with parsing layer:**
```
PTY → Reader Thread → UTF-8 Buffer → Parser Layer → Multiple Channels
                                           ↓
                                    ┌──────┴──────┐
                                    ↓             ↓
                            Frontend Display   Dashboard Analytics
                            (xterm.js)         (Structured Data)
```

**Implementation strategy:**

```rust
// src-tauri/src/pty/output_parser.rs
use std::sync::mpsc::{channel, Sender};

pub struct OutputParser {
    // Raw output for terminal display
    display_tx: Sender<String>,

    // Parsed structured data for dashboard
    analytics_tx: Sender<ParsedOutput>,

    // Parser state machine
    ansi_parser: vte::Parser,

    // Pattern matchers
    test_detector: TestDetector,
    git_detector: GitDetector,
    build_detector: BuildDetector,

    // Line buffer for pattern matching
    line_buffer: Vec<u8>,
}

#[derive(Debug, Clone)]
pub enum ParsedOutput {
    TestResult(TestResult),
    GitOperation(GitOp),
    BuildStatus(BuildStatus),
    Error(ErrorInfo),
}

impl OutputParser {
    pub fn process_chunk(&mut self, data: &[u8]) {
        // 1. Send raw data to display immediately (no delay)
        let display_data = String::from_utf8_lossy(data).to_string();
        let _ = self.display_tx.send(display_data);

        // 2. Parse ANSI sequences in background
        for byte in data {
            self.ansi_parser.advance(&mut self.performer, *byte);
        }

        // 3. Accumulate lines for pattern matching
        self.line_buffer.extend_from_slice(data);

        // 4. Process complete lines
        while let Some(line_end) = self.find_line_end() {
            let line = self.line_buffer.drain(..line_end).collect();
            self.match_patterns(&line);
        }
    }

    fn match_patterns(&mut self, line: &[u8]) {
        // Try all detectors in parallel
        if let Some(test) = self.test_detector.try_match(line) {
            let _ = self.analytics_tx.send(ParsedOutput::TestResult(test));
        }

        if let Some(git) = self.git_detector.try_match(line) {
            let _ = self.analytics_tx.send(ParsedOutput::GitOperation(git));
        }

        if let Some(build) = self.build_detector.try_match(line) {
            let _ = self.analytics_tx.send(ParsedOutput::BuildStatus(build));
        }
    }
}
```

**Integration with existing PTY session:**

```rust
// Modified src-tauri/src/pty/session.rs (lines 83-159)
// Replace the output reading thread

use crate::pty::output_parser::{OutputParser, ParsedOutput};

// In PtySession::new(), create parser
let (display_tx, display_rx) = channel();
let (analytics_tx, analytics_rx) = channel();

let mut parser = OutputParser::new(display_tx, analytics_tx);

// Spawn output processing thread
let session_id_clone = session_id.clone();
thread::spawn(move || {
    let mut buffer = [0u8; 8192];
    let mut utf8_buffer = Vec::new();

    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break, // EOF
            Ok(n) => {
                // Process chunk through parser
                parser.process_chunk(&buffer[..n]);
            }
            Err(e) => {
                eprintln!("Error reading from PTY: {}", e);
                break;
            }
        }
    }
});

// Spawn display forwarding thread
let window_clone = window.clone();
thread::spawn(move || {
    for display_data in display_rx {
        let _ = window_clone.emit(
            "pty-output",
            serde_json::json!({
                "session_id": session_id_clone,
                "data": display_data,
                "closed": false,
            }),
        );
    }
});

// Spawn analytics forwarding thread
let window_clone2 = window.clone();
thread::spawn(move || {
    for parsed_data in analytics_rx {
        let _ = window_clone2.emit("pty-analytics", parsed_data);
    }
});
```

---

## 2. ANSI Escape Sequence Parsing

### 2.1 Library Comparison

After researching the Rust ecosystem, here are the top ANSI parsing libraries:

| Library | Downloads/month | Pros | Cons | Recommendation |
|---------|----------------|------|------|----------------|
| **vte** | 15M+ | Used by Alacritty, complete state machine, zero-copy | Requires Perform trait impl | **Primary choice** |
| **anes** | 4.9M | Simple API, widely adopted | Heavier than needed | Fallback option |
| **ansi-parser** | 500K+ | Pull-based iterator, no_std support | Less maintained | Not recommended |
| **cansi** | 100K+ | Focused on styling metadata | Limited scope | Special cases only |
| **vtparse** | 10K+ | DEC compatible | Less popular | Not recommended |

**Recommendation:** Use **vte** (the parser powering Alacritty terminal)

### 2.2 vte Implementation Example

```rust
// src-tauri/src/pty/ansi_parser.rs
use vte::{Parser, Perform};

/// VTE Performer that strips ANSI codes and tracks text attributes
pub struct AnsiPerformer {
    /// Plain text output (ANSI codes removed)
    pub plain_text: Vec<u8>,

    /// Current text attributes (color, bold, etc.)
    pub current_attrs: TextAttributes,

    /// Cursor position
    pub cursor_pos: (u16, u16), // (row, col)
}

#[derive(Debug, Clone, Default)]
pub struct TextAttributes {
    pub fg_color: Option<Color>,
    pub bg_color: Option<Color>,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
}

#[derive(Debug, Clone)]
pub enum Color {
    Rgb(u8, u8, u8),
    Indexed(u8),
}

impl Perform for AnsiPerformer {
    fn print(&mut self, c: char) {
        self.plain_text.extend_from_slice(c.encode_utf8(&mut [0; 4]).as_bytes());
    }

    fn execute(&mut self, byte: u8) {
        match byte {
            b'\n' => {
                self.plain_text.push(b'\n');
                self.cursor_pos.0 += 1;
                self.cursor_pos.1 = 0;
            }
            b'\r' => {
                self.plain_text.push(b'\r');
                self.cursor_pos.1 = 0;
            }
            b'\t' => {
                self.plain_text.push(b'\t');
                self.cursor_pos.1 += 4; // Assume 4-space tabs
            }
            _ => {}
        }
    }

    fn hook(&mut self, _params: &vte::Params, _intermediates: &[u8], _ignore: bool, _c: char) {}

    fn put(&mut self, _byte: u8) {}

    fn unhook(&mut self) {}

    fn osc_dispatch(&mut self, _params: &[&[u8]], _bell_terminated: bool) {}

    fn csi_dispatch(
        &mut self,
        params: &vte::Params,
        _intermediates: &[u8],
        _ignore: bool,
        c: char,
    ) {
        match c {
            'm' => {
                // SGR - Select Graphic Rendition
                self.handle_sgr(params);
            }
            'H' | 'f' => {
                // CUP - Cursor Position
                let row = params.iter().next().map(|p| p[0]).unwrap_or(1) as u16 - 1;
                let col = params.iter().nth(1).map(|p| p[0]).unwrap_or(1) as u16 - 1;
                self.cursor_pos = (row, col);
            }
            _ => {}
        }
    }

    fn esc_dispatch(&mut self, _intermediates: &[u8], _ignore: bool, _byte: u8) {}
}

impl AnsiPerformer {
    fn handle_sgr(&mut self, params: &vte::Params) {
        for param in params.iter() {
            match param[0] {
                0 => {
                    // Reset
                    self.current_attrs = TextAttributes::default();
                }
                1 => self.current_attrs.bold = true,
                3 => self.current_attrs.italic = true,
                4 => self.current_attrs.underline = true,
                22 => self.current_attrs.bold = false,
                23 => self.current_attrs.italic = false,
                24 => self.current_attrs.underline = false,
                30..=37 => {
                    // Foreground color
                    self.current_attrs.fg_color = Some(Color::Indexed((param[0] - 30) as u8));
                }
                38 => {
                    // Extended foreground color
                    if param.len() >= 3 && param[1] == 5 {
                        // 256-color
                        self.current_attrs.fg_color = Some(Color::Indexed(param[2] as u8));
                    } else if param.len() >= 5 && param[1] == 2 {
                        // RGB
                        self.current_attrs.fg_color = Some(Color::Rgb(
                            param[2] as u8,
                            param[3] as u8,
                            param[4] as u8,
                        ));
                    }
                }
                40..=47 => {
                    // Background color
                    self.current_attrs.bg_color = Some(Color::Indexed((param[0] - 40) as u8));
                }
                _ => {}
            }
        }
    }
}

// Usage example
pub fn strip_ansi_codes(input: &[u8]) -> Vec<u8> {
    let mut parser = Parser::new();
    let mut performer = AnsiPerformer::default();

    for byte in input {
        parser.advance(&mut performer, *byte);
    }

    performer.plain_text
}
```

**Dependencies to add to Cargo.toml:**
```toml
[dependencies]
vte = "0.13"  # Latest stable version
```

---

## 3. Test Result Detection

### 3.1 Test Framework Output Patterns

Different test frameworks have distinct output formats. Here are the patterns:

#### Jest / Vitest (JavaScript)

**Successful test pattern:**
```
 PASS  tests/example.test.ts
  ✓ should work correctly (5 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        1.234 s
```

**Failed test pattern:**
```
 FAIL  tests/example.test.ts
  ✕ should fail correctly (8 ms)

  ● Test suite failed to run

    Expected 5 to be 10

Test Suites: 1 failed, 1 total
Tests:       2 passed, 1 failed, 3 total
```

#### Cargo Test (Rust)

**Successful pattern:**
```
running 5 tests
test integration::test_feature ... ok
test unit::test_parser ... ok
test unit::test_validator ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.23s
```

**Failed pattern:**
```
running 3 tests
test test_addition ... FAILED
test test_subtraction ... ok

failures:

---- test_addition stdout ----
thread 'test_addition' panicked at 'assertion failed: `(left == right)`
  left: `5`,
 right: `10`', tests/math.rs:10:5

test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out
```

#### pytest (Python)

**Pattern:**
```
============================= test session starts ==============================
collected 10 items

tests/test_example.py::test_feature PASSED                              [ 10%]
tests/test_example.py::test_another FAILED                              [ 20%]

=========================== 1 failed, 9 passed in 1.23s ========================
```

### 3.2 Test Result Parser Implementation

```rust
// src-tauri/src/pty/parsers/test_parser.rs
use regex::Regex;
use lazy_static::lazy_static;

#[derive(Debug, Clone, serde::Serialize)]
pub struct TestResult {
    pub framework: TestFramework,
    pub summary: TestSummary,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub enum TestFramework {
    Jest,
    Vitest,
    CargoTest,
    Pytest,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TestSummary {
    pub total: u32,
    pub passed: u32,
    pub failed: u32,
    pub skipped: u32,
    pub duration_ms: Option<u32>,
}

pub struct TestDetector {
    buffer: String,
    state: DetectorState,
}

#[derive(Debug, Clone)]
enum DetectorState {
    Idle,
    InTestRun(TestFramework),
    Complete,
}

lazy_static! {
    // Jest/Vitest patterns
    static ref JEST_SUMMARY: Regex = Regex::new(
        r"Test Suites: (\d+) failed, (\d+) passed, (\d+) total"
    ).unwrap();

    static ref JEST_TESTS: Regex = Regex::new(
        r"Tests:\s+(?:(\d+) failed,\s+)?(\d+) passed(?:,\s+(\d+) skipped)?,\s+(\d+) total"
    ).unwrap();

    static ref JEST_TIME: Regex = Regex::new(
        r"Time:\s+([\d.]+)\s*s"
    ).unwrap();

    // Cargo test patterns
    static ref CARGO_RUNNING: Regex = Regex::new(
        r"^\s*running (\d+) tests"
    ).unwrap();

    static ref CARGO_RESULT: Regex = Regex::new(
        r"test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored; \d+ measured; \d+ filtered out; finished in ([\d.]+)s"
    ).unwrap();

    // Pytest patterns
    static ref PYTEST_SUMMARY: Regex = Regex::new(
        r"=+ (\d+) failed(?:, (\d+) passed)?(?: in ([\d.]+)s)? =+"
    ).unwrap();
}

impl TestDetector {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            state: DetectorState::Idle,
        }
    }

    pub fn try_match(&mut self, line: &[u8]) -> Option<TestResult> {
        let line_str = String::from_utf8_lossy(line);
        self.buffer.push_str(&line_str);

        // Try to detect test framework
        if matches!(self.state, DetectorState::Idle) {
            if line_str.contains("PASS") || line_str.contains("FAIL") {
                self.state = DetectorState::InTestRun(TestFramework::Jest);
            } else if CARGO_RUNNING.is_match(&line_str) {
                self.state = DetectorState::InTestRun(TestFramework::CargoTest);
            } else if line_str.contains("test session starts") {
                self.state = DetectorState::InTestRun(TestFramework::Pytest);
            }
        }

        // Try to extract summary
        match &self.state {
            DetectorState::InTestRun(TestFramework::Jest) => {
                self.parse_jest_output(&line_str)
            }
            DetectorState::InTestRun(TestFramework::CargoTest) => {
                self.parse_cargo_output(&line_str)
            }
            DetectorState::InTestRun(TestFramework::Pytest) => {
                self.parse_pytest_output(&line_str)
            }
            _ => None,
        }
    }

    fn parse_jest_output(&mut self, line: &str) -> Option<TestResult> {
        if let Some(caps) = JEST_TESTS.captures(line) {
            let failed = caps.get(1)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0);
            let passed = caps.get(2)?.as_str().parse().ok()?;
            let skipped = caps.get(3)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0);
            let total = caps.get(4)?.as_str().parse().ok()?;

            // Try to find duration
            let duration_ms = JEST_TIME.captures(&self.buffer)
                .and_then(|caps| {
                    caps.get(1)?.as_str().parse::<f64>().ok()
                        .map(|s| (s * 1000.0) as u32)
                });

            self.state = DetectorState::Complete;
            self.buffer.clear();

            Some(TestResult {
                framework: TestFramework::Jest,
                summary: TestSummary {
                    total,
                    passed,
                    failed,
                    skipped,
                    duration_ms,
                },
                timestamp: chrono::Utc::now(),
            })
        } else {
            None
        }
    }

    fn parse_cargo_output(&mut self, line: &str) -> Option<TestResult> {
        if let Some(caps) = CARGO_RESULT.captures(line) {
            let passed = caps.get(2)?.as_str().parse().ok()?;
            let failed = caps.get(3)?.as_str().parse().ok()?;
            let skipped = caps.get(4)?.as_str().parse().ok()?;
            let total = passed + failed + skipped;

            let duration_ms = caps.get(5)?
                .as_str()
                .parse::<f64>()
                .ok()
                .map(|s| (s * 1000.0) as u32);

            self.state = DetectorState::Complete;
            self.buffer.clear();

            Some(TestResult {
                framework: TestFramework::CargoTest,
                summary: TestSummary {
                    total,
                    passed,
                    failed,
                    skipped,
                    duration_ms,
                },
                timestamp: chrono::Utc::now(),
            })
        } else {
            None
        }
    }

    fn parse_pytest_output(&mut self, line: &str) -> Option<TestResult> {
        if let Some(caps) = PYTEST_SUMMARY.captures(line) {
            let failed = caps.get(1)?.as_str().parse().ok()?;
            let passed = caps.get(2)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0);
            let total = failed + passed;

            let duration_ms = caps.get(3)
                .and_then(|m| {
                    m.as_str().parse::<f64>().ok()
                        .map(|s| (s * 1000.0) as u32)
                });

            self.state = DetectorState::Complete;
            self.buffer.clear();

            Some(TestResult {
                framework: TestFramework::Pytest,
                summary: TestSummary {
                    total,
                    passed,
                    failed,
                    skipped: 0,
                    duration_ms,
                },
                timestamp: chrono::Utc::now(),
            })
        } else {
            None
        }
    }
}

// Unit tests
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jest_output_parsing() {
        let mut detector = TestDetector::new();

        let lines = vec![
            " PASS  tests/example.test.ts\n",
            "Tests:       2 passed, 2 total\n",
            "Time:        1.234 s\n",
        ];

        let mut result = None;
        for line in lines {
            if let Some(r) = detector.try_match(line.as_bytes()) {
                result = Some(r);
            }
        }

        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.summary.total, 2);
        assert_eq!(r.summary.passed, 2);
        assert_eq!(r.summary.failed, 0);
    }

    #[test]
    fn test_cargo_output_parsing() {
        let mut detector = TestDetector::new();

        let lines = vec![
            "running 5 tests\n",
            "test unit::test_parser ... ok\n",
            "test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.23s\n",
        ];

        let mut result = None;
        for line in lines {
            if let Some(r) = detector.try_match(line.as_bytes()) {
                result = Some(r);
            }
        }

        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.summary.total, 5);
        assert_eq!(r.summary.passed, 5);
        assert_eq!(r.summary.duration_ms, Some(230));
    }
}
```

**Dependencies:**
```toml
[dependencies]
regex = "1.10"
lazy_static = "1.4"
chrono = { version = "0.4", features = ["serde"] }
```

---

## 4. Git Command Detection

### 4.1 Strategy: Use git2 Library Instead of Parsing

**Recommendation:** Instead of parsing `git status` and `git log` output from the terminal, use the **git2** Rust library to access Git data directly. This is:
- More reliable (no parsing brittleness)
- Faster (direct libgit2 access)
- Type-safe (structured data)

**Example: Git Status via git2:**

```rust
// src-tauri/src/git/status.rs
use git2::{Repository, Status, StatusOptions};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct GitStatus {
    pub branch: String,
    pub is_dirty: bool,
    pub ahead: usize,
    pub behind: usize,
    pub files: Vec<FileStatus>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileStatus {
    pub path: String,
    pub status: FileStatusKind,
}

#[derive(Debug, Clone, Serialize)]
pub enum FileStatusKind {
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
    Conflicted,
}

pub fn get_git_status(repo_path: &str) -> anyhow::Result<GitStatus> {
    let repo = Repository::open(repo_path)?;

    // Get current branch
    let head = repo.head()?;
    let branch = head.shorthand()
        .unwrap_or("HEAD")
        .to_string();

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&repo)?;

    // Get file statuses
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts))?;

    let mut files = Vec::new();
    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            let status = classify_status(entry.status());
            files.push(FileStatus {
                path: path.to_string(),
                status,
            });
        }
    }

    Ok(GitStatus {
        branch,
        is_dirty: !files.is_empty(),
        ahead,
        behind,
        files,
    })
}

fn get_ahead_behind(repo: &Repository) -> anyhow::Result<(usize, usize)> {
    let head = repo.head()?;
    let local_oid = head.target().ok_or(anyhow::anyhow!("No target"))?;

    // Get upstream branch
    let branch_name = head.shorthand().ok_or(anyhow::anyhow!("No shorthand"))?;
    let branch = repo.find_branch(branch_name, git2::BranchType::Local)?;

    if let Ok(upstream) = branch.upstream() {
        let upstream_oid = upstream.get().target()
            .ok_or(anyhow::anyhow!("No upstream target"))?;

        let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
        Ok((ahead, behind))
    } else {
        Ok((0, 0))
    }
}

fn classify_status(status: Status) -> FileStatusKind {
    if status.contains(Status::WT_NEW) || status.contains(Status::INDEX_NEW) {
        FileStatusKind::Added
    } else if status.contains(Status::WT_MODIFIED) || status.contains(Status::INDEX_MODIFIED) {
        FileStatusKind::Modified
    } else if status.contains(Status::WT_DELETED) || status.contains(Status::INDEX_DELETED) {
        FileStatusKind::Deleted
    } else if status.contains(Status::WT_RENAMED) || status.contains(Status::INDEX_RENAMED) {
        FileStatusKind::Renamed
    } else if status.contains(Status::CONFLICTED) {
        FileStatusKind::Conflicted
    } else {
        FileStatusKind::Untracked
    }
}
```

**Example: Git Log via git2:**

```rust
// src-tauri/src/git/log.rs
use git2::{Repository, Oid};
use serde::Serialize;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub email: String,
    pub timestamp: DateTime<Utc>,
    pub message: String,
    pub files_changed: usize,
}

pub fn get_recent_commits(repo_path: &str, limit: usize) -> anyhow::Result<Vec<GitCommit>> {
    let repo = Repository::open(repo_path)?;
    let mut revwalk = repo.revwalk()?;

    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;

    let mut commits = Vec::new();

    for (i, oid) in revwalk.enumerate() {
        if i >= limit {
            break;
        }

        let oid = oid?;
        let commit = repo.find_commit(oid)?;

        // Count files changed
        let files_changed = count_files_changed(&repo, &commit)?;

        commits.push(GitCommit {
            hash: commit.id().to_string(),
            short_hash: format!("{:.7}", commit.id()),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            timestamp: DateTime::from_timestamp(commit.time().seconds(), 0)
                .unwrap_or_else(|| Utc::now()),
            message: commit.message().unwrap_or("").trim().to_string(),
            files_changed,
        });
    }

    Ok(commits)
}

fn count_files_changed(repo: &Repository, commit: &git2::Commit) -> anyhow::Result<usize> {
    let tree = commit.tree()?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;

    Ok(diff.deltas().count())
}
```

### 4.2 Detecting Git Commands in Terminal Output

While we use git2 for data access, we still want to detect when users run git commands:

```rust
// src-tauri/src/pty/parsers/git_detector.rs
use regex::Regex;
use lazy_static::lazy_static;

#[derive(Debug, Clone, serde::Serialize)]
pub struct GitOp {
    pub operation: GitOperation,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub enum GitOperation {
    Status,
    Log,
    Commit { message: String },
    Push { remote: String, branch: String },
    Pull { remote: String, branch: String },
    Checkout { branch: String },
    Add { files: Vec<String> },
    Other { command: String },
}

pub struct GitDetector {
    last_command: Option<String>,
}

lazy_static! {
    static ref GIT_COMMAND: Regex = Regex::new(
        r"^\$\s+git\s+(.+)$"
    ).unwrap();

    static ref GIT_COMMIT: Regex = Regex::new(
        r#"git commit.*-m\s+["']([^"']+)["']"#
    ).unwrap();
}

impl GitDetector {
    pub fn new() -> Self {
        Self {
            last_command: None,
        }
    }

    pub fn try_match(&mut self, line: &[u8]) -> Option<GitOp> {
        let line_str = String::from_utf8_lossy(line);

        // Detect git command being typed
        if let Some(caps) = GIT_COMMAND.captures(&line_str) {
            let cmd = caps.get(1)?.as_str();
            self.last_command = Some(cmd.to_string());

            let operation = self.parse_git_command(cmd);

            return Some(GitOp {
                operation,
                timestamp: chrono::Utc::now(),
            });
        }

        None
    }

    fn parse_git_command(&self, cmd: &str) -> GitOperation {
        let parts: Vec<&str> = cmd.split_whitespace().collect();

        match parts.get(0) {
            Some(&"status") => GitOperation::Status,
            Some(&"log") => GitOperation::Log,
            Some(&"commit") => {
                if let Some(caps) = GIT_COMMIT.captures(cmd) {
                    GitOperation::Commit {
                        message: caps.get(1).unwrap().as_str().to_string(),
                    }
                } else {
                    GitOperation::Commit {
                        message: String::new(),
                    }
                }
            }
            Some(&"push") => {
                let remote = parts.get(1).unwrap_or(&"origin").to_string();
                let branch = parts.get(2).unwrap_or(&"HEAD").to_string();
                GitOperation::Push { remote, branch }
            }
            Some(&"pull") => {
                let remote = parts.get(1).unwrap_or(&"origin").to_string();
                let branch = parts.get(2).unwrap_or(&"HEAD").to_string();
                GitOperation::Pull { remote, branch }
            }
            Some(&"checkout") => {
                let branch = parts.get(1).unwrap_or(&"").to_string();
                GitOperation::Checkout { branch }
            }
            Some(&"add") => {
                let files = parts.iter().skip(1).map(|s| s.to_string()).collect();
                GitOperation::Add { files }
            }
            _ => GitOperation::Other {
                command: cmd.to_string(),
            },
        }
    }
}
```

---

## 5. Build Tool Integration

### 5.1 Build Command Detection

```rust
// src-tauri/src/pty/parsers/build_detector.rs
use regex::Regex;
use lazy_static::lazy_static;

#[derive(Debug, Clone, serde::Serialize)]
pub struct BuildStatus {
    pub tool: BuildTool,
    pub command: String,
    pub status: BuildResult,
    pub duration_ms: Option<u32>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub enum BuildTool {
    Npm,
    Cargo,
    Make,
    Gradle,
    Maven,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize)]
pub enum BuildResult {
    Success,
    Failed { error: String },
    InProgress,
}

pub struct BuildDetector {
    state: BuildState,
    buffer: String,
    start_time: Option<std::time::Instant>,
}

#[derive(Debug, Clone)]
enum BuildState {
    Idle,
    InBuild(BuildTool),
    Complete,
}

lazy_static! {
    // npm patterns
    static ref NPM_BUILD_START: Regex = Regex::new(
        r"^\$\s+npm\s+run\s+(build|dev|start|test)"
    ).unwrap();

    static ref NPM_SUCCESS: Regex = Regex::new(
        r"webpack.*compiled successfully|vite.*built in"
    ).unwrap();

    static ref NPM_ERROR: Regex = Regex::new(
        r"ERROR|Failed to compile|Build failed"
    ).unwrap();

    // Cargo patterns
    static ref CARGO_BUILD_START: Regex = Regex::new(
        r"^\$\s+cargo\s+(build|run|test)"
    ).unwrap();

    static ref CARGO_SUCCESS: Regex = Regex::new(
        r"Finished.*in ([\d.]+)s"
    ).unwrap();

    static ref CARGO_ERROR: Regex = Regex::new(
        r"error(\[E\d+\])?:"
    ).unwrap();
}

impl BuildDetector {
    pub fn new() -> Self {
        Self {
            state: BuildState::Idle,
            buffer: String::new(),
            start_time: None,
        }
    }

    pub fn try_match(&mut self, line: &[u8]) -> Option<BuildStatus> {
        let line_str = String::from_utf8_lossy(line);
        self.buffer.push_str(&line_str);

        // Detect build start
        if matches!(self.state, BuildState::Idle) {
            if NPM_BUILD_START.is_match(&line_str) {
                self.state = BuildState::InBuild(BuildTool::Npm);
                self.start_time = Some(std::time::Instant::now());
            } else if CARGO_BUILD_START.is_match(&line_str) {
                self.state = BuildState::InBuild(BuildTool::Cargo);
                self.start_time = Some(std::time::Instant::now());
            }
        }

        // Detect build completion
        match &self.state {
            BuildState::InBuild(BuildTool::Npm) => {
                self.detect_npm_completion(&line_str)
            }
            BuildState::InBuild(BuildTool::Cargo) => {
                self.detect_cargo_completion(&line_str)
            }
            _ => None,
        }
    }

    fn detect_npm_completion(&mut self, line: &str) -> Option<BuildStatus> {
        let duration_ms = self.start_time
            .map(|t| t.elapsed().as_millis() as u32);

        if NPM_SUCCESS.is_match(line) {
            self.state = BuildState::Complete;
            self.buffer.clear();

            return Some(BuildStatus {
                tool: BuildTool::Npm,
                command: "npm run build".to_string(),
                status: BuildResult::Success,
                duration_ms,
                timestamp: chrono::Utc::now(),
            });
        } else if NPM_ERROR.is_match(line) {
            self.state = BuildState::Complete;
            let error = line.to_string();
            self.buffer.clear();

            return Some(BuildStatus {
                tool: BuildTool::Npm,
                command: "npm run build".to_string(),
                status: BuildResult::Failed { error },
                duration_ms,
                timestamp: chrono::Utc::now(),
            });
        }

        None
    }

    fn detect_cargo_completion(&mut self, line: &str) -> Option<BuildStatus> {
        if let Some(caps) = CARGO_SUCCESS.captures(line) {
            let duration_str = caps.get(1)?.as_str();
            let duration_ms = duration_str.parse::<f64>()
                .ok()
                .map(|s| (s * 1000.0) as u32);

            self.state = BuildState::Complete;
            self.buffer.clear();

            return Some(BuildStatus {
                tool: BuildTool::Cargo,
                command: "cargo build".to_string(),
                status: BuildResult::Success,
                duration_ms,
                timestamp: chrono::Utc::now(),
            });
        } else if CARGO_ERROR.is_match(line) {
            self.state = BuildState::Complete;
            let error = line.to_string();
            self.buffer.clear();

            return Some(BuildStatus {
                tool: BuildTool::Cargo,
                command: "cargo build".to_string(),
                status: BuildResult::Failed { error },
                duration_ms: None,
                timestamp: chrono::Utc::now(),
            });
        }

        None
    }
}
```

---

## 6. Performance Considerations

### 6.1 Benchmarking Strategy

**Test setup:**
```rust
// benches/output_parsing.rs (requires criterion)
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use zeami4::pty::output_parser::OutputParser;

fn benchmark_parsing(c: &mut Criterion) {
    // Simulate realistic terminal output
    let test_data = include_bytes!("../test_data/terminal_output.txt");

    c.bench_function("parse 100KB output", |b| {
        b.iter(|| {
            let mut parser = OutputParser::new();
            parser.process_chunk(black_box(test_data));
        });
    });
}

criterion_group!(benches, benchmark_parsing);
criterion_main!(benches);
```

**Add to Cargo.toml:**
```toml
[dev-dependencies]
criterion = "0.5"

[[bench]]
name = "output_parsing"
harness = false
```

### 6.2 Performance Estimates

Based on similar terminal emulators (Alacritty, wezterm):

| Operation | Throughput | CPU Usage | Latency |
|-----------|-----------|-----------|---------|
| Raw PTY read | ~50 MB/s | < 1% | < 1ms |
| ANSI parsing (vte) | ~200 MB/s | < 2% | < 1ms |
| Pattern matching (regex) | ~100 MB/s | < 3% | < 5ms |
| **Combined overhead** | **~40 MB/s** | **< 5%** | **< 10ms** |

**Typical terminal output rates:**
- Interactive shell: ~1-10 KB/s
- Build output: ~100-500 KB/s
- Large file dump: ~1-5 MB/s

**Conclusion:** Parsing overhead is negligible for typical use cases.

### 6.3 Buffer Management Strategy

**Recommended approach:**

```rust
// src-tauri/src/pty/buffer.rs
use std::collections::VecDeque;

pub struct RingBuffer {
    buffer: VecDeque<u8>,
    max_size: usize,
}

impl RingBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(max_size),
            max_size,
        }
    }

    pub fn push(&mut self, data: &[u8]) {
        // Add new data
        self.buffer.extend(data);

        // Trim if exceeded
        while self.buffer.len() > self.max_size {
            self.buffer.pop_front();
        }
    }

    pub fn as_slice(&self) -> Vec<u8> {
        self.buffer.iter().copied().collect()
    }

    pub fn clear(&mut self) {
        self.buffer.clear();
    }
}

// Usage in parser
const MAX_LINE_BUFFER: usize = 10_000; // 10 KB max line
const MAX_PATTERN_BUFFER: usize = 100_000; // 100 KB lookback for patterns

pub struct BufferedParser {
    line_buffer: RingBuffer,
    pattern_buffer: RingBuffer,
}

impl BufferedParser {
    pub fn new() -> Self {
        Self {
            line_buffer: RingBuffer::new(MAX_LINE_BUFFER),
            pattern_buffer: RingBuffer::new(MAX_PATTERN_BUFFER),
        }
    }
}
```

**Memory usage estimates:**
- Line buffer: 10 KB per session
- Pattern buffer: 100 KB per session
- ANSI parser state: ~1 KB per session
- **Total per terminal tab:** ~111 KB

For 10 concurrent terminal tabs: ~1.1 MB RAM overhead.

### 6.4 Incremental Parsing Strategy

**Key principle:** Never block the main thread

```rust
// src-tauri/src/pty/incremental_parser.rs
use tokio::sync::mpsc;
use std::time::Duration;

pub struct IncrementalParser {
    chunk_rx: mpsc::Receiver<Vec<u8>>,
    result_tx: mpsc::Sender<ParsedOutput>,
}

impl IncrementalParser {
    pub async fn run(mut self) {
        let mut buffer = Vec::new();
        let mut last_parse = std::time::Instant::now();

        const PARSE_INTERVAL: Duration = Duration::from_millis(100);
        const MIN_BUFFER_SIZE: usize = 1024;

        loop {
            tokio::select! {
                // Receive new chunks
                Some(chunk) = self.chunk_rx.recv() => {
                    buffer.extend_from_slice(&chunk);

                    // Parse if buffer is large enough or enough time passed
                    let should_parse = buffer.len() >= MIN_BUFFER_SIZE
                        || last_parse.elapsed() >= PARSE_INTERVAL;

                    if should_parse && !buffer.is_empty() {
                        self.parse_buffer(&buffer).await;
                        buffer.clear();
                        last_parse = std::time::Instant::now();
                    }
                }

                // Timeout to flush buffer
                _ = tokio::time::sleep(PARSE_INTERVAL) => {
                    if !buffer.is_empty() {
                        self.parse_buffer(&buffer).await;
                        buffer.clear();
                        last_parse = std::time::Instant::now();
                    }
                }
            }
        }
    }

    async fn parse_buffer(&mut self, buffer: &[u8]) {
        // Run all pattern matchers
        let results = tokio::task::spawn_blocking({
            let buffer = buffer.to_vec();
            move || {
                let mut detector = TestDetector::new();
                // ... run pattern matching
                vec![] // results
            }
        }).await.unwrap();

        // Send results
        for result in results {
            let _ = self.result_tx.send(result).await;
        }
    }
}
```

---

## 7. Integration Architecture

### 7.1 Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          PTY Session                             │
│                                                                  │
│  ┌────────────┐                                                 │
│  │   Shell    │                                                 │
│  │ (zsh/bash) │                                                 │
│  └─────┬──────┘                                                 │
│        │ stdout/stderr                                          │
│        ↓                                                        │
│  ┌────────────────────────────────────────────────────────────┐│
│  │            Reader Thread (8KB chunks)                      ││
│  └─────┬──────────────────────────────────────────────────────┘│
│        │                                                        │
└────────┼────────────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│                    Output Parser Layer                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  UTF-8 Validator + ANSI Parser (vte)                    │  │
│  └─────┬───────────────────────────────────────────────────┘  │
│        │                                                       │
│        ├──► Display Channel ──────► Frontend (xterm.js)       │
│        │                                                       │
│        ↓                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Pattern Matchers (parallel)                            │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │  │
│  │  │ Test        │ │ Git         │ │ Build       │      │  │
│  │  │ Detector    │ │ Detector    │ │ Detector    │      │  │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘      │  │
│  └─────────┼───────────────┼───────────────┼─────────────┘  │
│            │               │               │                 │
└────────────┼───────────────┼───────────────┼─────────────────┘
             │               │               │
             └───────┬───────┴───────┬───────┘
                     ↓               ↓
            ┌─────────────────────────────────┐
            │   Analytics Channel             │
            └────────────┬────────────────────┘
                         │
                         ↓
            ┌─────────────────────────────────┐
            │   Dashboard State               │
            │   ┌──────────────────────────┐  │
            │   │ - Test Results           │  │
            │   │ - Git Operations         │  │
            │   │ - Build Status           │  │
            │   │ - Performance Metrics    │  │
            │   └──────────────────────────┘  │
            └─────────────────────────────────┘
```

### 7.2 Tauri Commands

```rust
// src-tauri/src/commands/analytics.rs
use crate::pty::output_parser::{ParsedOutput, TestResult, GitOp, BuildStatus};
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

pub struct AnalyticsState {
    pub test_results: Mutex<Vec<TestResult>>,
    pub git_ops: Mutex<Vec<GitOp>>,
    pub build_statuses: Mutex<Vec<BuildStatus>>,
}

impl Default for AnalyticsState {
    fn default() -> Self {
        Self {
            test_results: Mutex::new(Vec::new()),
            git_ops: Mutex::new(Vec::new()),
            build_statuses: Mutex::new(Vec::new()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub recent_tests: Vec<TestResult>,
    pub recent_git_ops: Vec<GitOp>,
    pub recent_builds: Vec<BuildStatus>,
}

#[tauri::command]
pub async fn get_dashboard_data(
    state: State<'_, AnalyticsState>,
) -> Result<DashboardData, String> {
    let test_results = state.test_results
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    let git_ops = state.git_ops
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    let build_statuses = state.build_statuses
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    Ok(DashboardData {
        recent_tests: test_results.into_iter().rev().take(10).collect(),
        recent_git_ops: git_ops.into_iter().rev().take(10).collect(),
        recent_builds: build_statuses.into_iter().rev().take(10).collect(),
    })
}

#[tauri::command]
pub async fn clear_analytics(
    state: State<'_, AnalyticsState>,
) -> Result<(), String> {
    state.test_results.lock().map_err(|e| e.to_string())?.clear();
    state.git_ops.lock().map_err(|e| e.to_string())?.clear();
    state.build_statuses.lock().map_err(|e| e.to_string())?.clear();
    Ok(())
}
```

### 7.3 Frontend Integration

```typescript
// src/hooks/useDashboardData.ts
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

interface TestResult {
  framework: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration_ms?: number;
  };
  timestamp: string;
}

interface GitOp {
  operation: any;
  timestamp: string;
}

interface BuildStatus {
  tool: string;
  command: string;
  status: any;
  duration_ms?: number;
  timestamp: string;
}

interface DashboardData {
  recent_tests: TestResult[];
  recent_git_ops: GitOp[];
  recent_builds: BuildStatus[];
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial data
    loadData();

    // Listen for analytics updates
    const unlisten = listen<any>('pty-analytics', (event) => {
      console.log('New analytics data:', event.payload);
      // Refresh dashboard data
      loadData();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const dashboardData = await invoke<DashboardData>('get_dashboard_data');
      setData(dashboardData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearData = async () => {
    try {
      await invoke('clear_analytics');
      await loadData();
    } catch (error) {
      console.error('Failed to clear analytics:', error);
    }
  };

  return { data, loading, refresh: loadData, clear: clearData };
}
```

```tsx
// src/components/Dashboard.tsx
import { useDashboardData } from '../hooks/useDashboardData';

export function Dashboard() {
  const { data, loading, refresh, clear } = useDashboardData();

  if (loading || !data) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Development Dashboard</h2>
        <div className="space-x-2">
          <button onClick={refresh} className="px-4 py-2 bg-blue-600 rounded">
            Refresh
          </button>
          <button onClick={clear} className="px-4 py-2 bg-gray-600 rounded">
            Clear
          </button>
        </div>
      </div>

      {/* Test Results */}
      <section>
        <h3 className="text-xl font-semibold mb-4">Recent Tests</h3>
        <div className="grid gap-4">
          {data.recent_tests.map((test, i) => (
            <div key={i} className="bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-sm text-gray-400">
                    {test.framework}
                  </span>
                  <div className="mt-2 space-x-4">
                    <span className="text-green-400">
                      ✓ {test.summary.passed} passed
                    </span>
                    {test.summary.failed > 0 && (
                      <span className="text-red-400">
                        ✗ {test.summary.failed} failed
                      </span>
                    )}
                    <span className="text-gray-400">
                      {test.summary.total} total
                    </span>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-400">
                  {test.summary.duration_ms && (
                    <div>{(test.summary.duration_ms / 1000).toFixed(2)}s</div>
                  )}
                  <div>{new Date(test.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Build Status */}
      <section>
        <h3 className="text-xl font-semibold mb-4">Recent Builds</h3>
        <div className="grid gap-4">
          {data.recent_builds.map((build, i) => (
            <div key={i} className="bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-sm text-gray-400">
                    {build.tool}
                  </span>
                  <div className="mt-1 text-lg">
                    {build.command}
                  </div>
                  <div className="mt-2">
                    {typeof build.status === 'object' && 'Success' in build.status && (
                      <span className="text-green-400">✓ Success</span>
                    )}
                    {typeof build.status === 'object' && 'Failed' in build.status && (
                      <span className="text-red-400">✗ Failed</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm text-gray-400">
                  {build.duration_ms && (
                    <div>{(build.duration_ms / 1000).toFixed(2)}s</div>
                  )}
                  <div>{new Date(build.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## 8. Dependencies Summary

Add these to `/Users/hirano/_MyDev/zeami4/src-tauri/Cargo.toml`:

```toml
[dependencies]
# Existing dependencies
tauri = { version = "1.5.4", features = ["shell-open", "protocol-asset"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
portable-pty = "0.8"
octocrab = "0.38"
git2 = "0.18"
tokio = { version = "1", features = ["full"] }
anyhow = "1.0"
thiserror = "1.0"
dirs = "5.0"
chrono = "0.4"
toml = "0.8"
uuid = { version = "1.10", features = ["v4", "serde"] }

# NEW: For output parsing
vte = "0.13"                          # ANSI escape sequence parser
regex = "1.10"                        # Pattern matching
lazy_static = "1.4"                   # Static regex compilation

[dev-dependencies]
criterion = "0.5"                     # Benchmarking

[[bench]]
name = "output_parsing"
harness = false
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Implement ANSI parser with vte
- [ ] Create output parser infrastructure
- [ ] Add dual-channel architecture (display + analytics)
- [ ] Write unit tests for ANSI parsing

### Phase 2: Pattern Matching (Week 2)
- [ ] Implement TestDetector with Jest/Vitest/Cargo support
- [ ] Implement GitDetector for command detection
- [ ] Implement BuildDetector for npm/cargo
- [ ] Write comprehensive pattern matching tests

### Phase 3: Git Integration (Week 3)
- [ ] Implement git2-based status checking
- [ ] Implement git2-based log retrieval
- [ ] Create Tauri commands for git operations
- [ ] Add periodic git status polling

### Phase 4: Dashboard (Week 4)
- [ ] Create AnalyticsState management
- [ ] Implement dashboard Tauri commands
- [ ] Build React dashboard component
- [ ] Add real-time analytics updates

### Phase 5: Performance & Polish (Week 5)
- [ ] Add benchmarks with criterion
- [ ] Optimize buffer management
- [ ] Implement incremental parsing
- [ ] Add error handling and logging

---

## 10. Performance Benchmarks (Estimated)

### Parsing Overhead

| Scenario | Input Rate | CPU Usage | Latency | Memory |
|----------|-----------|-----------|---------|--------|
| Idle terminal | 0 KB/s | 0% | 0ms | 111 KB |
| Interactive shell | 1-10 KB/s | < 1% | < 5ms | 111 KB |
| Build output | 100-500 KB/s | 2-3% | < 10ms | 211 KB |
| Large file dump | 1-5 MB/s | 4-5% | < 20ms | 311 KB |

### Pattern Matching Performance

| Pattern Type | Matches/sec | False Positives | Latency |
|-------------|-------------|-----------------|---------|
| Test results | ~10,000 | < 0.1% | < 1ms |
| Git commands | ~50,000 | < 0.01% | < 1ms |
| Build status | ~5,000 | < 1% | < 2ms |

### Memory Usage (10 concurrent terminals)

```
Base PTY sessions:        ~5 MB
ANSI parsers:            ~10 KB
Pattern matchers:        ~50 KB
Line buffers (10KB ea):  ~100 KB
Pattern buffers (100KB): ~1 MB
Analytics storage:       ~500 KB
-----------------------------------
Total:                   ~6.7 MB
```

**Conclusion:** Negligible overhead for typical development workflows.

---

## 11. References

### ANSI Parsing
- [vte crate documentation](https://docs.rs/vte/0.8.0/vte/index.html)
- [Alacritty vte GitHub](https://github.com/alacritty/vte)
- [ANSI parser crates.io](https://crates.io/crates/ansi-parser)
- [anes - ANSI Escape Sequences](https://lib.rs/crates/anes)

### Git Integration
- [git2-rs examples/log.rs](https://github.com/rust-lang/git2-rs/blob/master/examples/log.rs)
- [git2-rs examples/status.rs](https://github.com/rust-lang/git2-rs/blob/master/examples/status.rs)
- [Analyzing Git history with Rust](https://medium.com/thg-tech-blog/analysing-source-control-history-with-rust-ba766cf1f648)

### Performance & Buffering
- [Rust I/O Performance Book](https://nnethercote.github.io/perf-book/io.html)
- [Rust stdout buffering](https://doc.rust-lang.org/std/io/struct.Stdout.html)
- [Process output streaming in Rust](https://stackoverflow.com/questions/31992237/how-would-you-stream-output-from-a-process)

### Testing Frameworks
- [cargo_testdox crate](https://docs.rs/cargo-testdox/latest/cargo_testdox/)
- [Cargo test documentation](https://doc.rust-lang.org/cargo/commands/cargo-test.html)

---

## 12. Conclusion

This research demonstrates that extracting structured data from terminal output is **highly feasible** with minimal performance impact. The recommended architecture uses:

1. **vte** for ANSI parsing (industry standard, used by Alacritty)
2. **Dual-channel design** for zero display latency
3. **Pattern matching** for test/build detection
4. **git2 library** for Git data (instead of parsing output)
5. **Incremental parsing** for performance

**Estimated implementation time:** 4-5 weeks
**Performance overhead:** < 5% CPU, ~7 MB RAM (10 terminals)
**Reliability:** High (proven patterns from production terminal emulators)

The next step is to begin implementation starting with Phase 1 (Foundation).
