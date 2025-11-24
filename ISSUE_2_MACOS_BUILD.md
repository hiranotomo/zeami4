# Issue #2: macOSネイティブバイナリのビルドと基本動作の実現

## 🎯 目的

ZeamiをmacOS上で実際に使える本番品質のネイティブアプリケーションとしてビルドし、Issue #1で定義された設計方針に基づいて基本的なコマンドを実装する。

## 📋 前提条件

- Issue #1の設計方針を理解していること
- Rust 1.70以降がインストール済み
- GitHub Personal Access Token取得済み
- macOS Ventura (13.x) 以降

## 🎬 実装スコープ

### Phase 1: ビルド環境の整備

#### 1.1 Cargo.toml最適化

```toml
[profile.release]
opt-level = "z"        # サイズ最適化
lto = true             # Link Time Optimization
codegen-units = 1      # 最適化優先
strip = true           # デバッグシンボル削除
panic = "abort"        # パニック時即終了（サイズ削減）

[profile.dev]
opt-level = 0
debug = true

[profile.dev.package."*"]
opt-level = 2          # 依存関係は最適化（コンパイル高速化）
```

**参考:** [Cargo Profile Best Practices](https://doc.rust-lang.org/cargo/reference/profiles.html)

#### 1.2 クロスコンパイル設定

```toml
# .cargo/config.toml
[target.x86_64-apple-darwin]
rustflags = ["-C", "link-arg=-mmacosx-version-min=13.0"]

[target.aarch64-apple-darwin]
rustflags = ["-C", "link-arg=-mmacosx-version-min=13.0"]
```

### Phase 2: 基本コマンドの実装

#### 2.1 `zeami init` - 初期設定

**機能要件:**

```rust
// src/cli/commands/init.rs

use anyhow::{Context, Result};
use inquire::{Password, Text, Confirm};
use crate::config::{Config, GitHubConfig};

pub async fn run() -> Result<()> {
    println!("🚀 Initializing zeami configuration...\n");

    // 1. GitHubリポジトリ入力
    let repo = Text::new("GitHub repository (owner/repo):")
        .with_help_message("Example: octocat/hello-world")
        .with_validator(|input: &str| {
            if input.split('/').count() == 2 {
                Ok(())
            } else {
                Err("Format must be 'owner/repo'".into())
            }
        })
        .prompt()?;

    // 2. Personal Access Token入力
    let token = Password::new("GitHub Personal Access Token:")
        .with_help_message("Generate at: https://github.com/settings/tokens")
        .with_display_mode(inquire::PasswordDisplayMode::Masked)
        .prompt()?;

    // 3. GitHub API接続テスト
    println!("\n🔍 Verifying GitHub credentials...");

    let octocrab = octocrab::Octocrab::builder()
        .personal_token(token.clone())
        .build()?;

    let (owner, repo_name) = repo.split_once('/')
        .context("Invalid repository format")?;

    // リポジトリアクセス確認
    octocrab
        .repos(owner, repo_name)
        .get()
        .await
        .context("Failed to access repository. Check your token and repo name.")?;

    println!("✓ GitHub credentials verified");

    // 4. 設定保存
    let config = Config::new(repo.clone(), token);
    config.save()?;

    println!("\n✅ Configuration saved to {}", config.path()?.display());
    println!("   Repository: {}", repo);
    println!("\n🎉 You're all set! Try 'zeami status' to get started.");

    Ok(())
}
```

**技術ポイント:**
- **バリデーション:** inquireのvalidatorで入力チェック
- **セキュリティ:** トークンをマスク表示
- **UX:** GitHub API接続テストで即座にフィードバック
- **エラーハンドリング:** anyhow::Contextで明確なエラーメッセージ

**参考:** [inquire Examples](https://docs.rs/inquire/latest/inquire/)

#### 2.2 `zeami status` - 現状確認

**機能要件:**

```rust
// src/cli/commands/status.rs

use anyhow::Result;
use crate::{config::Config, git::Repository, state::State};

pub async fn run() -> Result<()> {
    let config = Config::load()?;
    let repo = Repository::open(".")?;
    let state = State::load()?;

    // 1. Git情報取得
    let branch = repo.current_branch()?;
    let head = repo.head_commit()?;

    // 2. Issue紐付け確認
    let linked_issue = state.get_issue_for_branch(&branch);

    // 3. ステータス表示
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("📍 Current Status");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Repository: {}", config.github.repository);
    println!("Branch: {}", branch);

    if let Some(issue_num) = linked_issue {
        println!("Issue: #{}", issue_num);
    } else {
        println!("Issue: (none) - use 'zeami dev start' to link");
    }

    println!("Last commit: {}", head.summary());
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    Ok(())
}
```

**実装詳細:**

```rust
// src/git/repository.rs

use git2::{Repository as GitRepository, Commit};
use anyhow::{Context, Result};

pub struct Repository {
    repo: GitRepository,
}

impl Repository {
    pub fn open(path: &str) -> Result<Self> {
        let repo = GitRepository::open(path)
            .context("Not a git repository")?;
        Ok(Self { repo })
    }

    pub fn current_branch(&self) -> Result<String> {
        let head = self.repo.head()?;
        let branch = head
            .shorthand()
            .context("Failed to get branch name")?
            .to_string();
        Ok(branch)
    }

    pub fn head_commit(&self) -> Result<CommitInfo> {
        let head = self.repo.head()?;
        let commit = head.peel_to_commit()?;

        Ok(CommitInfo {
            hash: commit.id().to_string()[..7].to_string(),
            summary: commit.summary().unwrap_or("").to_string(),
        })
    }
}

pub struct CommitInfo {
    pub hash: String,
    pub summary: String,
}

impl CommitInfo {
    pub fn summary(&self) -> String {
        format!("{} {}", self.hash, self.summary)
    }
}
```

**参考:** [git2-rs Documentation](https://docs.rs/git2/latest/git2/)

#### 2.3 `zeami issue list` - Issue一覧表示

**機能要件:**

```rust
// src/cli/commands/issue.rs

use anyhow::Result;
use crate::{config::Config, github::GitHubClient};

pub async fn list() -> Result<()> {
    let config = Config::load()?;
    let client = GitHubClient::new(&config)?;

    println!("📋 Fetching issues from {}...\n", config.github.repository);

    let issues = client.list_issues().await?;

    if issues.is_empty() {
        println!("No issues found.");
        return Ok(());
    }

    // シンプルなリスト表示
    for issue in issues {
        let state_icon = match issue.state.as_str() {
            "open" => "🟢",
            "closed" => "🔴",
            _ => "⚪",
        };

        println!(
            "{} #{:<4} {}",
            state_icon,
            issue.number,
            issue.title
        );
    }

    println!("\nUse 'zeami dev start' to begin working on an issue.");

    Ok(())
}
```

**GitHub API実装:**

```rust
// src/github/client.rs

use octocrab::{Octocrab, models::issues::Issue};
use anyhow::{Context, Result};
use crate::config::Config;

pub struct GitHubClient {
    octocrab: Octocrab,
    owner: String,
    repo: String,
}

impl GitHubClient {
    pub fn new(config: &Config) -> Result<Self> {
        let octocrab = Octocrab::builder()
            .personal_token(config.github.token.clone())
            .build()?;

        let (owner, repo) = config.github.repository
            .split_once('/')
            .context("Invalid repository format")?;

        Ok(Self {
            octocrab,
            owner: owner.to_string(),
            repo: repo.to_string(),
        })
    }

    pub async fn list_issues(&self) -> Result<Vec<IssueInfo>> {
        let issues = self.octocrab
            .issues(&self.owner, &self.repo)
            .list()
            .state(octocrab::params::State::Open)
            .send()
            .await
            .context("Failed to fetch issues")?;

        Ok(issues.into_iter().map(Into::into).collect())
    }
}

#[derive(Debug)]
pub struct IssueInfo {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub body: Option<String>,
}

impl From<Issue> for IssueInfo {
    fn from(issue: Issue) -> Self {
        Self {
            number: issue.number,
            title: issue.title,
            state: issue.state.to_string(),
            body: issue.body,
        }
    }
}
```

**参考:**
- [octocrab Examples](https://github.com/XAMPPRocky/octocrab/tree/main/examples)
- [GitHub REST API](https://docs.github.com/en/rest/issues/issues)

### Phase 3: 設定管理の実装

#### 3.1 XDG Base Directory準拠

```rust
// src/config/mod.rs

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub github: GitHubConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubConfig {
    pub repository: String,
    pub token: String,
}

impl Config {
    pub fn new(repository: String, token: String) -> Self {
        Self {
            github: GitHubConfig { repository, token },
        }
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_path()?;

        if !path.exists() {
            anyhow::bail!(
                "Configuration not found. Run 'zeami init' first.\nExpected: {}",
                path.display()
            );
        }

        let content = std::fs::read_to_string(&path)
            .with_context(|| format!("Failed to read config from {:?}", path))?;

        let config: Config = toml::from_str(&content)
            .context("Invalid configuration format")?;

        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .context("Failed to create config directory")?;
        }

        let content = toml::to_string_pretty(self)
            .context("Failed to serialize config")?;

        std::fs::write(&path, content)
            .with_context(|| format!("Failed to write config to {:?}", path))?;

        Ok(())
    }

    pub fn config_path() -> Result<PathBuf> {
        let config_dir = dirs::config_dir()
            .context("Could not find config directory")?;

        Ok(config_dir.join("zeami").join("config.toml"))
    }

    pub fn path(&self) -> Result<PathBuf> {
        Self::config_path()
    }
}
```

**ディレクトリ構造:**
```
macOS:
  ~/.config/zeami/config.toml
  ~/.local/share/zeami/state.json

Linux:
  $XDG_CONFIG_HOME/zeami/config.toml
  $XDG_DATA_HOME/zeami/state.json
```

**参考:** [XDG Base Directory Spec](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)

### Phase 4: インストールとデプロイ

#### 4.1 ビルド手順

```bash
# リリースビルド
$ cargo build --release

# バイナリサイズ確認
$ ls -lh target/release/zeami
-rwxr-xr-x  1 user  staff   3.2M Nov 24 zeami

# ストリッピング（さらにサイズ削減）
$ strip target/release/zeami
$ ls -lh target/release/zeami
-rwxr-xr-x  1 user  staff   2.1M Nov 24 zeami
```

#### 4.2 インストール方法

**方法1: cargo install**
```bash
$ cargo install --path .
$ which zeami
/Users/username/.cargo/bin/zeami
```

**方法2: 手動コピー**
```bash
$ cp target/release/zeami /usr/local/bin/
$ zeami --version
zeami 0.1.0
```

**方法3: Homebrew（将来）**
```bash
$ brew tap hiranotomo/zeami
$ brew install zeami
```

### Phase 5: テスト戦略

#### 5.1 統合テスト

```rust
// tests/cli_tests.rs

use assert_cmd::Command;
use predicates::prelude::*;

#[test]
fn test_version() {
    let mut cmd = Command::cargo_bin("zeami").unwrap();
    cmd.arg("--version")
        .assert()
        .success()
        .stdout(predicate::str::contains("zeami"));
}

#[test]
fn test_help() {
    let mut cmd = Command::cargo_bin("zeami").unwrap();
    cmd.arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("GitHub issue-driven development tool"));
}

#[test]
fn test_status_without_config() {
    let mut cmd = Command::cargo_bin("zeami").unwrap();
    cmd.arg("status")
        .assert()
        .failure()
        .stderr(predicate::str::contains("Run 'zeami init' first"));
}
```

**参考:** [assert_cmd Documentation](https://docs.rs/assert_cmd/latest/assert_cmd/)

#### 5.2 GitHub API モックテスト

```rust
// tests/github_api_tests.rs

use wiremock::{MockServer, Mock, ResponseTemplate};
use wiremock::matchers::{method, path};

#[tokio::test]
async fn test_list_issues() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/repos/owner/repo/issues"))
        .respond_with(ResponseTemplate::new(200).set_body_json(vec![
            serde_json::json!({
                "number": 1,
                "title": "Test Issue",
                "state": "open",
            })
        ]))
        .mount(&mock_server)
        .await;

    // テスト実行
}
```

## 📊 成功基準（Definition of Done）

### 機能チェックリスト

- [ ] **zeami init**
  - [ ] リポジトリ入力バリデーション
  - [ ] トークンマスク表示
  - [ ] GitHub API接続確認
  - [ ] 設定ファイル保存（~/.config/zeami/）
  - [ ] エラー時の明確なメッセージ

- [ ] **zeami status**
  - [ ] Gitリポジトリ検出
  - [ ] 現在のブランチ表示
  - [ ] 最新コミット情報表示
  - [ ] Issue紐付け表示（未実装時は適切なメッセージ）

- [ ] **zeami issue list**
  - [ ] GitHub Issueの取得
  - [ ] open/closedフィルタリング
  - [ ] 見やすい一覧表示
  - [ ] エラーハンドリング（ネットワークエラー等）

### 品質チェックリスト

- [ ] **ビルド**
  - [ ] `cargo build --release` 成功
  - [ ] バイナリサイズ < 5MB
  - [ ] 起動時間 < 100ms（`time zeami --version`）

- [ ] **Linting**
  - [ ] `cargo clippy` 警告ゼロ
  - [ ] `cargo fmt -- --check` パス
  - [ ] `cargo check` エラーゼロ

- [ ] **テスト**
  - [ ] `cargo test` すべてパス
  - [ ] 統合テストカバレッジ > 70%

- [ ] **互換性**
  - [ ] macOS Ventura (13.x) 動作確認
  - [ ] macOS Sonoma (14.x) 動作確認
  - [ ] Terminal.app 動作確認
  - [ ] iTerm2 動作確認

- [ ] **ドキュメント**
  - [ ] README.md更新（インストール手順）
  - [ ] コマンドヘルプメッセージ完備
  - [ ] examples/ディレクトリにサンプルコード

### 動作確認シナリオ

```bash
# 1. インストール
$ cargo install --path .

# 2. 初期設定
$ zeami init
🚀 Initializing zeami configuration...
GitHub repository (owner/repo): hiranotomo/zeami4
GitHub Personal Access Token: ****
🔍 Verifying GitHub credentials...
✓ GitHub credentials verified
✅ Configuration saved to /Users/username/.config/zeami/config.toml

# 3. 状態確認
$ zeami status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Current Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Repository: hiranotomo/zeami4
Branch: master
Issue: (none) - use 'zeami dev start' to link
Last commit: 0b8c935 chore: Setup auto-development system
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 4. Issue一覧
$ zeami issue list
📋 Fetching issues from hiranotomo/zeami4...

🟢 #1   Zeami: GitHub Issue駆動開発ツールの設計と実装方針
🟢 #2   macOSネイティブバイナリのビルドと基本動作

Use 'zeami dev start' to begin working on an issue.
```

## 🚧 既知の制約・今後の拡張

### 今回実装しないもの

- [ ] TUIインタラクティブモード（Phase 2以降）
- [ ] `zeami dev start/sync/complete`（Issue #3）
- [ ] Claude Code統合（Issue #4）
- [ ] Windows/Linux対応（Issue #5）

### 技術的負債

- トークンを平文で保存（将来：keychainへ）
- エラーメッセージの国際化（将来：i18n対応）
- オフライン動作（将来：キャッシュ機構）

## 📚 参考資料

### 実装参考
- [GitHub CLI Source Code](https://github.com/cli/cli)
- [gitui Source Code](https://github.com/gitui-org/gitui)

### ベストプラクティス
- [Rust CLI Recommendations](https://rust-cli-recommendations.sunshowers.io/)
- [The Cargo Book](https://doc.rust-lang.org/cargo/)

### API/Library
- [octocrab Examples](https://github.com/XAMPPRocky/octocrab/tree/main/examples)
- [git2-rs Examples](https://github.com/rust-lang/git2-rs/tree/master/examples)
- [inquire Documentation](https://docs.rs/inquire/latest/inquire/)

## 🔗 関連Issue

- #1 - Zeami設計と実装方針（前提）
- #3 - 開発ワークフロー実装（次）
