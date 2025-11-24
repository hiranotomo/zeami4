# Issue #15: GitHub API Integration Research & Implementation Guide

## 目的

Zeamiプロジェクトにおける GitHub API 統合のための包括的な調査と実装ガイド。Issue #7で定義されたIssue CRUD操作、PR作成、ワークフロー監視の実装に向けた技術的な基盤を提供する。

---

## 📊 Executive Summary

### 推奨アプローチ
- **Primary**: `octocrab` v0.38+ (高レベル型安全API)
- **Secondary**: `gh CLI` (スクリプトとインタラクティブ操作)
- **Authentication**: Personal Access Token (macOS Keychainで管理)
- **Caching**: ETag対応でレート制限を最適化
- **Advanced**: GraphQL API (複雑なクエリ用)

---

## 1. octocrab Library Analysis

### 1.1 Overview

**octocrab** は GitHub API用のモダンで拡張可能なRustクライアント。2つのAPI層を提供：
- 高レベル型安全セマンティックAPI
- 低レベルHTTP API（拡張用）

### 1.2 API Coverage Matrix

#### ✅ 完全サポート機能

| カテゴリ | モジュール | 主要機能 |
|---------|----------|---------|
| **Issues** | `issues` | CRUD、コメント、ラベル、アサイン、リアクション、タイムライン |
| **Pull Requests** | `pulls` | CRUD、レビュー、マージ、diff/patch、ファイル一覧、コメント |
| **Repositories** | `repos` | リポジトリ管理、フォーク、リリース、イベント |
| **Commits** | `commits` | コミット情報、履歴 |
| **Actions** | `actions` | ワークフロー実行、アーティファクト、セルフホストランナー |
| **Workflows** | `workflows` | ワークフロー管理、ディスパッチ |
| **Users** | `current`, `users` | ユーザー情報、認証ユーザー |
| **Organizations** | `orgs` | 組織管理 |
| **Teams** | `teams` | チーム操作 |
| **Search** | `search` | リポジトリ、コード検索 |
| **Gists** | `gists` | Gist管理 |
| **Checks** | `checks` | Check Runs/Suites |
| **Apps** | `apps` | GitHub Apps統合 |
| **Events** | `events`, `activity` | イベント監視、アクティビティ |
| **Projects** | `projects` | プロジェクトボード（v1のみ） |

#### ⚠️ 制限付きサポート

| 機能 | 状態 | 回避策 |
|-----|------|--------|
| **Projects v2** | GraphQL経由のみ | カスタムGraphQLクエリが必要 |
| **条件付きリクエスト** | 一部のエンドポイントのみ | `Etagged<T>`型を使用 |
| **HTTP Caching** | 限定的 | リポジトリイベントなど特定エンドポイントでETag対応 |

#### 🔧 Raw HTTP経由でサポート

octocrabは拡張可能な設計により、型付けされていない機能にもアクセス可能：

```rust
// Raw HTTP GET
let data: serde_json::Value = octocrab.get("/repos/owner/repo/topics", None::<&()>).await?;

// Raw HTTP POST
let response = octocrab.post("/repos/owner/repo/issues", Some(&payload)).await?;

// カスタムエンドポイント
let response = octocrab._get("https://api.github.com/custom-endpoint").await?;
```

### 1.3 Issue Operations - 詳細

#### IssueHandler メソッド

```rust
use octocrab::{Octocrab, params};

let octocrab = Octocrab::builder()
    .personal_token("ghp_xxxxx")
    .build()?;

// Issue取得
let issue = octocrab.issues("owner", "repo").get(42).await?;

// Issue作成
let new_issue = octocrab.issues("owner", "repo")
    .create("Issue title")
    .body("Issue description...")
    .milestone(1)
    .labels(vec!["bug".to_string(), "high-priority".to_string()])
    .assignees(vec!["username".to_string()])
    .send()
    .await?;

// Issue更新
octocrab.issues("owner", "repo")
    .update(42)
    .title("Updated title")
    .state(params::State::Closed)
    .send()
    .await?;

// Issue一覧（ページネーション対応）
let mut page = octocrab.issues("owner", "repo")
    .list()
    .state(params::State::Open)
    .creator("username")
    .labels(&["bug", "enhancement"])
    .sort(params::issues::Sort::Created)
    .direction(params::Direction::Descending)
    .per_page(50)
    .send()
    .await?;

loop {
    for issue in &page {
        println!("#{}: {}", issue.number, issue.title);
    }

    page = match octocrab.get_page(&page.next).await? {
        Some(next_page) => next_page,
        None => break,
    }
}

// コメント追加
let comment = octocrab.issues("owner", "repo")
    .create_comment(42, "This is a comment")
    .await?;

// ラベル管理
octocrab.issues("owner", "repo")
    .add_labels(42, &["needs-review", "documentation"])
    .await?;

// リアクション追加
octocrab.issues("owner", "repo")
    .create_reaction(42, octocrab::models::reactions::ReactionContent::PlusOne)
    .await?;
```

### 1.4 Pull Request Operations - 詳細

#### PullRequestHandler メソッド

```rust
// PR取得
let pr = octocrab.pulls("owner", "repo").get(123).await?;

// PR作成
let new_pr = octocrab.pulls("owner", "repo")
    .create("Feature: Add new functionality", "feature-branch", "main")
    .body("## Summary\n\nThis PR adds...")
    .send()
    .await?;

// PR一覧
let prs = octocrab.pulls("owner", "repo")
    .list()
    .state(params::State::Open)
    .head("username:branch-name")
    .base("main")
    .sort(params::pulls::Sort::Updated)
    .direction(params::Direction::Descending)
    .per_page(100)
    .send()
    .await?;

// PRマージチェック
let is_merged = octocrab.pulls("owner", "repo").is_merged(123).await?;

// PRマージ
octocrab.pulls("owner", "repo")
    .merge(123)
    .title("Merge pull request #123")
    .method(octocrab::params::pulls::MergeMethod::Squash)
    .send()
    .await?;

// レビュー取得
let reviews = octocrab.pulls("owner", "repo")
    .list_reviews(123)
    .await?;

// レビューリクエスト
octocrab.pulls("owner", "repo")
    .request_reviews(123, vec!["reviewer1", "reviewer2"], vec!["team-name"])
    .await?;

// 変更ファイル一覧
let files = octocrab.pulls("owner", "repo").list_files(123).await?;

// Diff取得
let diff = octocrab.pulls("owner", "repo").get_diff(123).await?;
```

### 1.5 Workflows & Actions

```rust
// ワークフロー一覧
let workflows = octocrab.workflows("owner", "repo").list().await?;

// ワークフロー実行履歴
let runs = octocrab.actions().list_workflow_runs("owner", "repo").send().await?;

// ワークフローディスパッチ（手動実行）
octocrab.actions()
    .create_workflow_dispatch("owner", "repo", "workflow.yml", "main")
    .send()
    .await?;

// アーティファクト一覧
let artifacts = octocrab.actions()
    .list_workflow_run_artifacts("owner", "repo", run_id)
    .send()
    .await?;
```

### 1.6 Missing Features & Workarounds

#### Projects v2 API

Projects v2は REST APIではなく **GraphQL API** を使用する必要がある：

```rust
// Projects v2 - GraphQL経由
let query = r#"
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    projectsV2(first: 10) {
      nodes {
        id
        title
        number
      }
    }
  }
}
"#;

let variables = serde_json::json!({
    "owner": "owner",
    "repo": "repo"
});

let response: serde_json::Value = octocrab.graphql(&serde_json::json!({
    "query": query,
    "variables": variables
})).await?;
```

---

## 2. Authentication Methods

### 2.1 認証方式の比較

| 方式 | レート制限 | 用途 | セキュリティ | 実装難易度 |
|-----|----------|-----|------------|-----------|
| **Personal Access Token (PAT)** | 5,000 req/hour | 個人利用、開発ツール | 中（トークン管理が必要） | ⭐ 簡単 |
| **OAuth Apps** | 5,000 req/hour (15,000 for Enterprise) | 多ユーザーアプリ | 高（ユーザー認証フロー） | ⭐⭐ 中程度 |
| **GitHub Apps** | 5,000+ req/hour (最大15,000) | プロダクション、Bot | 最高（短命トークン） | ⭐⭐⭐ 複雑 |
| **GITHUB_TOKEN (Actions)** | 1,000 req/hour/repo | CI/CD | 高（自動管理） | ⭐ 簡単 |

### 2.2 Zeamiでの推奨: Personal Access Token

#### 理由
1. **シンプル**: 実装が容易で、すぐに開発開始可能
2. **十分なレート制限**: 5,000 req/hour は通常の開発用途に十分
3. **細かい権限制御**: スコープで必要な権限のみ付与可能
4. **ローカル開発向き**: 個人ツールとして最適

#### 必要なスコープ

```
repo           # リポジトリへのフルアクセス（必須）
workflow       # GitHub Actionsワークフローへのアクセス
read:org       # 組織情報の読み取り（オプション）
read:user      # ユーザー情報の読み取り
```

#### octocrabでの認証実装

```rust
use octocrab::Octocrab;

// 基本的な認証
let octocrab = Octocrab::builder()
    .personal_token("ghp_your_token_here")
    .build()?;

// 環境変数から読み込み
let token = std::env::var("GITHUB_TOKEN")
    .expect("GITHUB_TOKEN not set");

let octocrab = Octocrab::builder()
    .personal_token(token)
    .build()?;

// グローバルインスタンス設定
octocrab::initialise(Octocrab::builder().personal_token(token));
let instance = octocrab::instance();
```

### 2.3 macOS Keychain Integration

#### セキュリティベストプラクティス

1. **トークンをコードに含めない**
2. **環境変数ではなくmacOS Keychainに保存**
3. **アプリケーション終了時にメモリをクリア**
4. **必要最小限のスコープのみ付与**

#### Rust実装: keyring crate

**Cargo.toml:**
```toml
[dependencies]
keyring = { version = "3", features = ["apple-native"] }
```

**実装例:**
```rust
use keyring::Entry;
use anyhow::Result;

const SERVICE_NAME: &str = "com.zeami.github";
const USERNAME: &str = "default";

/// GitHub tokenをmacOS Keychainに保存
pub fn save_github_token(token: &str) -> Result<()> {
    let entry = Entry::new(SERVICE_NAME, USERNAME)?;
    entry.set_password(token)?;
    Ok(())
}

/// macOS KeychainからGitHub tokenを取得
pub fn get_github_token() -> Result<String> {
    let entry = Entry::new(SERVICE_NAME, USERNAME)?;
    let token = entry.get_password()?;
    Ok(token)
}

/// GitHub tokenを削除
pub fn delete_github_token() -> Result<()> {
    let entry = Entry::new(SERVICE_NAME, USERNAME)?;
    entry.delete_credential()?;
    Ok(())
}

/// Octocrabインスタンスを認証情報付きで作成
pub fn create_authenticated_octocrab() -> Result<Octocrab> {
    let token = get_github_token()?;

    let octocrab = Octocrab::builder()
        .personal_token(token)
        .build()?;

    Ok(octocrab)
}
```

#### 初回セットアップフロー

```rust
use inquire::Password;

pub fn setup_github_auth() -> Result<()> {
    println!("GitHub Personal Access Token Setup");
    println!("Create token at: https://github.com/settings/tokens");
    println!("Required scopes: repo, workflow");
    println!();

    let token = Password::new("Enter your GitHub token:")
        .with_display_toggle_enabled()
        .prompt()?;

    // トークンの検証
    let octocrab = Octocrab::builder()
        .personal_token(&token)
        .build()?;

    let user = octocrab.current().user().await?;
    println!("✓ Authenticated as: {}", user.login);

    // macOS Keychainに保存
    save_github_token(&token)?;
    println!("✓ Token saved to macOS Keychain");

    Ok(())
}
```

---

## 3. Rate Limit Strategy

### 3.1 GitHub APIレート制限

| 認証タイプ | プライマリ制限 | セカンダリ制限 |
|-----------|--------------|--------------|
| 未認証 | 60 req/hour | N/A |
| PAT認証 | 5,000 req/hour | 変更系: 1秒に1リクエスト |
| GitHub Apps | 5,000-15,000 req/hour | 変更系: 1秒に1リクエスト |
| GITHUB_TOKEN | 1,000 req/hour/repo | 変更系: 1秒に1リクエスト |

**セカンダリレート制限**: POST, PATCH, PUT, DELETE操作は1秒間隔を推奨

### 3.2 レート制限の監視

```rust
use octocrab::Octocrab;

/// レート制限情報を取得
pub async fn check_rate_limit(octocrab: &Octocrab) -> Result<()> {
    let rate_limit = octocrab.ratelimit().get().await?;

    println!("Rate Limit Status:");
    println!("  Core API:");
    println!("    Limit: {}", rate_limit.resources.core.limit);
    println!("    Remaining: {}", rate_limit.resources.core.remaining);
    println!("    Reset: {:?}", rate_limit.resources.core.reset);

    println!("  Search API:");
    println!("    Limit: {}", rate_limit.resources.search.limit);
    println!("    Remaining: {}", rate_limit.resources.search.remaining);

    Ok(())
}

/// レート制限を確認し、必要なら待機
pub async fn ensure_rate_limit(octocrab: &Octocrab, min_remaining: u32) -> Result<()> {
    let rate_limit = octocrab.ratelimit().get().await?;

    if rate_limit.resources.core.remaining < min_remaining {
        let wait_time = rate_limit.resources.core.reset
            .duration_since(std::time::UNIX_EPOCH)?;

        println!("Rate limit low. Waiting {} seconds...", wait_time.as_secs());
        tokio::time::sleep(wait_time).await;
    }

    Ok(())
}
```

### 3.3 キャッシング戦略

#### ETagベースのキャッシング

GitHub APIは条件付きリクエストをサポート。ETagを使用することで、304 Not Modified応答はレート制限にカウントされない。

```rust
use octocrab::models::events::{Event, Etagged};
use octocrab::Page;

/// ETagを使用した効率的なポーリング
pub async fn poll_repository_events(
    octocrab: &Octocrab,
    owner: &str,
    repo: &str,
) -> Result<()> {
    let mut etag: Option<String> = None;

    loop {
        let mut builder = octocrab.repos(owner, repo).events();

        // ETagがあれば設定
        if let Some(ref tag) = etag {
            builder = builder.etag(tag.clone());
        }

        let response: Etagged<Page<Event>> = builder.send().await?;

        // 新しいデータがある場合
        if let Some(page) = response.value {
            for event in page.items {
                println!("New event: {:?}", event.r#type);
                // イベント処理...
            }
        } else {
            println!("No new events (304 Not Modified - doesn't count against rate limit)");
        }

        // ETagを保存
        etag = response.etag;

        // 次のチェックまで待機
        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
    }
}
```

#### ローカルキャッシング実装

```rust
use std::collections::HashMap;
use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};

#[derive(Clone)]
pub struct CachedResponse<T> {
    data: T,
    cached_at: Instant,
    etag: Option<String>,
}

pub struct ApiCache<T> {
    cache: HashMap<String, CachedResponse<T>>,
    ttl: Duration,
}

impl<T: Clone> ApiCache<T> {
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            cache: HashMap::new(),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    pub fn get(&self, key: &str) -> Option<&CachedResponse<T>> {
        self.cache.get(key).and_then(|cached| {
            if cached.cached_at.elapsed() < self.ttl {
                Some(cached)
            } else {
                None
            }
        })
    }

    pub fn set(&mut self, key: String, data: T, etag: Option<String>) {
        self.cache.insert(key, CachedResponse {
            data,
            cached_at: Instant::now(),
            etag,
        });
    }
}

// 使用例
use tokio::sync::Mutex;
use std::sync::Arc;

pub struct GitHubClient {
    octocrab: Octocrab,
    issue_cache: Arc<Mutex<ApiCache<octocrab::models::issues::Issue>>>,
}

impl GitHubClient {
    pub fn new(token: String) -> Result<Self> {
        Ok(Self {
            octocrab: Octocrab::builder().personal_token(token).build()?,
            issue_cache: Arc::new(Mutex::new(ApiCache::new(300))), // 5分キャッシュ
        })
    }

    pub async fn get_issue_cached(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
    ) -> Result<octocrab::models::issues::Issue> {
        let cache_key = format!("{}/{}/issues/{}", owner, repo, number);

        // キャッシュチェック
        {
            let cache = self.issue_cache.lock().await;
            if let Some(cached) = cache.get(&cache_key) {
                return Ok(cached.data.clone());
            }
        }

        // APIリクエスト
        let issue = self.octocrab.issues(owner, repo).get(number).await?;

        // キャッシュに保存
        {
            let mut cache = self.issue_cache.lock().await;
            cache.set(cache_key, issue.clone(), None);
        }

        Ok(issue)
    }
}
```

### 3.4 エラーハンドリング

```rust
use octocrab::Error as OctocrabError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitHubApiError {
    #[error("Rate limit exceeded. Reset at: {reset_at:?}")]
    RateLimitExceeded { reset_at: std::time::SystemTime },

    #[error("GitHub API error: {0}")]
    ApiError(#[from] OctocrabError),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Authentication failed")]
    AuthenticationError,
}

pub async fn handle_api_request<F, T, Fut>(
    octocrab: &Octocrab,
    request: F,
) -> Result<T, GitHubApiError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = octocrab::Result<T>>,
{
    match request().await {
        Ok(result) => Ok(result),
        Err(OctocrabError::GitHub { source, .. }) => {
            // GitHubエラーの詳細チェック
            if let Some(status) = source.status_code {
                match status.as_u16() {
                    403 => {
                        // レート制限チェック
                        let rate_limit = octocrab.ratelimit().get().await?;
                        if rate_limit.resources.core.remaining == 0 {
                            return Err(GitHubApiError::RateLimitExceeded {
                                reset_at: std::time::UNIX_EPOCH +
                                    std::time::Duration::from_secs(
                                        rate_limit.resources.core.reset.timestamp() as u64
                                    ),
                            });
                        }
                    }
                    401 => return Err(GitHubApiError::AuthenticationError),
                    _ => {}
                }
            }
            Err(GitHubApiError::ApiError(OctocrabError::GitHub { source, backtrace: std::backtrace::Backtrace::disabled() }))
        }
        Err(e) => Err(GitHubApiError::ApiError(e)),
    }
}
```

---

## 4. gh CLI Integration

### 4.1 octocrab vs gh CLI 比較

| 観点 | octocrab | gh CLI |
|-----|----------|---------|
| **型安全性** | ✅ コンパイル時チェック | ❌ 実行時エラー |
| **パフォーマンス** | ✅ 直接API呼び出し | ⚠️ プロセス起動オーバーヘッド |
| **認証管理** | 手動（Keychain統合可） | ✅ 自動管理 |
| **インタラクティブ** | ❌ プログラマティックのみ | ✅ 対話型プロンプト |
| **学習曲線** | ⚠️ API知識必要 | ✅ 簡単 |
| **エラーハンドリング** | ✅ 細かい制御 | ⚠️ 終了コード解析が必要 |
| **カスタマイズ** | ✅ 完全な制御 | ⚠️ gh apiで拡張可能 |
| **WebhookSupport** | ✅ ネイティブ | ❌ なし |
| **GitHub Actions統合** | 可能 | ✅ プリインストール |

### 4.2 使い分けガイドライン

#### octocrabを使用すべき場合

1. **アプリケーション本体**: Zeamiのコア機能
2. **長時間実行プロセス**: Webhook受信、ポーリング
3. **型安全性が重要**: Issue/PR管理ロジック
4. **パフォーマンス重視**: 大量のAPIリクエスト
5. **細かいエラーハンドリング**: レート制限管理、リトライロジック

```rust
// octocrabの使用例: Issue作成（型安全）
pub async fn create_issue_safe(
    client: &Octocrab,
    owner: &str,
    repo: &str,
    title: &str,
    body: &str,
) -> Result<octocrab::models::issues::Issue> {
    let issue = client.issues(owner, repo)
        .create(title)
        .body(body)
        .labels(vec!["automated".to_string()])
        .send()
        .await?;

    Ok(issue)
}
```

#### gh CLIを使用すべき場合

1. **スクリプト**: 初期セットアップ、マイグレーション
2. **手動操作**: デバッグ、一時的なタスク
3. **GitHub Actions**: ワークフロー内での操作
4. **プロトタイピング**: 素早い動作確認
5. **インタラクティブ操作**: ユーザー入力が必要な場合

```rust
use std::process::Command;

// gh CLIの使用例: インタラクティブPR作成
pub fn create_pr_interactive(branch: &str) -> Result<()> {
    let output = Command::new("gh")
        .args(&["pr", "create", "--head", branch, "--fill"])
        .status()?;

    if !output.success() {
        anyhow::bail!("Failed to create PR");
    }

    Ok(())
}

// gh api: カスタムエンドポイント
pub fn gh_api_custom(endpoint: &str) -> Result<serde_json::Value> {
    let output = Command::new("gh")
        .args(&["api", endpoint, "--jq", "."])
        .output()?;

    if !output.status.success() {
        anyhow::bail!("gh api failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)?;
    Ok(json)
}
```

### 4.3 ハイブリッドアプローチ

```rust
use tokio::process::Command as AsyncCommand;

pub struct HybridGitHubClient {
    octocrab: Octocrab,
}

impl HybridGitHubClient {
    pub fn new(token: String) -> Result<Self> {
        Ok(Self {
            octocrab: Octocrab::builder().personal_token(token).build()?,
        })
    }

    /// octocrab: プログラマティックなIssue作成
    pub async fn create_issue(
        &self,
        owner: &str,
        repo: &str,
        title: &str,
        body: &str,
    ) -> Result<u64> {
        let issue = self.octocrab.issues(owner, repo)
            .create(title)
            .body(body)
            .send()
            .await?;

        Ok(issue.number)
    }

    /// gh CLI: インタラクティブなPR作成（ブラウザでの編集を許可）
    pub async fn create_pr_interactive(&self) -> Result<()> {
        let status = AsyncCommand::new("gh")
            .args(&["pr", "create", "--web"])
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("Failed to create PR interactively");
        }

        Ok(())
    }

    /// gh CLI: JSON出力をパース
    pub async fn get_pr_checks(&self, pr_number: u64) -> Result<Vec<String>> {
        let output = AsyncCommand::new("gh")
            .args(&[
                "pr", "checks", &pr_number.to_string(),
                "--json", "name,conclusion",
            ])
            .output()
            .await?;

        if !output.status.success() {
            anyhow::bail!("Failed to get PR checks");
        }

        let checks: Vec<serde_json::Value> = serde_json::from_slice(&output.stdout)?;
        let names: Vec<String> = checks.iter()
            .filter_map(|c| c["name"].as_str().map(String::from))
            .collect();

        Ok(names)
    }
}
```

---

## 5. Advanced Features

### 5.1 Webhooks vs Polling

#### 比較表

| 観点 | Webhooks | Polling |
|-----|----------|---------|
| **リアルタイム性** | ✅ 即座（秒未満） | ⚠️ ポーリング間隔次第（数秒〜数分） |
| **効率性** | ✅ イベント駆動、無駄なリクエストなし | ❌ 98.5%が無駄（Zapier調査） |
| **レート制限** | ✅ 消費しない | ❌ 各ポーリングが消費 |
| **実装難易度** | ⚠️ サーバー必要 | ✅ 簡単 |
| **ローカル開発** | ⚠️ ngrok等が必要 | ✅ そのまま動作 |
| **信頼性** | ⚠️ 再送メカニズム必要 | ✅ 定期実行で確実 |
| **インフラコスト** | ⚠️ サーバー維持費 | ✅ クライアントのみ |

#### Zeamiでの推奨: フェーズ別アプローチ

**Phase 1 - MVP（Polling）**
- ローカル開発向き
- 実装が簡単
- ETag使用でレート制限を最適化

**Phase 2 - Production（Webhooks）**
- リアルタイム更新
- 効率的
- Tauriアプリでローカルサーバー起動

### 5.2 Polling実装例

```rust
use octocrab::models::events::{Event, Etagged};
use tokio::time::{interval, Duration};

pub struct GitHubPoller {
    octocrab: Octocrab,
    owner: String,
    repo: String,
    interval_secs: u64,
}

impl GitHubPoller {
    pub fn new(octocrab: Octocrab, owner: String, repo: String) -> Self {
        Self {
            octocrab,
            owner,
            repo,
            interval_secs: 30, // 30秒ごと
        }
    }

    /// リポジトリイベントをポーリング（ETag対応）
    pub async fn poll_events<F>(&self, mut handler: F) -> Result<()>
    where
        F: FnMut(&Event) -> Result<()>,
    {
        let mut etag: Option<String> = None;
        let mut interval = interval(Duration::from_secs(self.interval_secs));

        loop {
            interval.tick().await;

            let mut builder = self.octocrab
                .repos(&self.owner, &self.repo)
                .events();

            if let Some(ref tag) = etag {
                builder = builder.etag(tag.clone());
            }

            match builder.send().await {
                Ok(response) => {
                    if let Some(page) = response.value {
                        for event in page.items {
                            handler(&event)?;
                        }
                    }
                    etag = response.etag;
                }
                Err(e) => {
                    eprintln!("Polling error: {}", e);
                    // エラーハンドリング（リトライロジック等）
                }
            }
        }
    }

    /// PR更新をポーリング
    pub async fn watch_pr_updates<F>(&self, pr_number: u64, mut on_update: F) -> Result<()>
    where
        F: FnMut(&octocrab::models::pulls::PullRequest) -> Result<()>,
    {
        let mut last_updated: Option<chrono::DateTime<chrono::Utc>> = None;
        let mut interval = interval(Duration::from_secs(self.interval_secs));

        loop {
            interval.tick().await;

            let pr = self.octocrab
                .pulls(&self.owner, &self.repo)
                .get(pr_number)
                .await?;

            // 更新があったかチェック
            if last_updated.is_none() || pr.updated_at > last_updated.unwrap() {
                on_update(&pr)?;
                last_updated = Some(pr.updated_at.unwrap());
            }
        }
    }
}

// 使用例
pub async fn monitor_repository() -> Result<()> {
    let octocrab = create_authenticated_octocrab()?;
    let poller = GitHubPoller::new(
        octocrab,
        "owner".to_string(),
        "repo".to_string(),
    );

    poller.poll_events(|event| {
        println!("Event: {:?} - {}", event.r#type, event.id);
        Ok(())
    }).await?;

    Ok(())
}
```

### 5.3 Webhook実装例

```rust
use octocrab::models::webhook_events::{WebhookEvent, WebhookEventPayload};
use axum::{
    Router,
    routing::post,
    extract::Json,
    http::{HeaderMap, StatusCode},
};

pub struct WebhookServer {
    secret: String,
}

impl WebhookServer {
    pub fn new(secret: String) -> Self {
        Self { secret }
    }

    /// Webhookサーバーを起動
    pub async fn start(self) -> Result<()> {
        let app = Router::new()
            .route("/webhook", post(handle_webhook));

        let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await?;
        println!("Webhook server listening on http://127.0.0.1:3000");

        axum::serve(listener, app).await?;
        Ok(())
    }
}

async fn handle_webhook(
    headers: HeaderMap,
    body: String,
) -> Result<StatusCode, StatusCode> {
    // GitHub署名の検証
    let signature = headers
        .get("X-Hub-Signature-256")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // イベントタイプ取得
    let event_type = headers
        .get("X-GitHub-Event")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::BAD_REQUEST)?;

    // イベント処理
    match event_type {
        "issues" => handle_issue_event(&body).await?,
        "pull_request" => handle_pr_event(&body).await?,
        "workflow_run" => handle_workflow_event(&body).await?,
        _ => {
            println!("Unhandled event type: {}", event_type);
        }
    }

    Ok(StatusCode::OK)
}

async fn handle_issue_event(body: &str) -> Result<(), StatusCode> {
    let event: serde_json::Value = serde_json::from_str(body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let action = event["action"].as_str().unwrap_or("unknown");
    let issue_number = event["issue"]["number"].as_u64().unwrap_or(0);

    println!("Issue #{} - Action: {}", issue_number, action);

    // Issueイベント処理ロジック

    Ok(())
}

async fn handle_pr_event(body: &str) -> Result<(), StatusCode> {
    // PR イベント処理
    Ok(())
}

async fn handle_workflow_event(body: &str) -> Result<(), StatusCode> {
    // Workflow イベント処理
    Ok(())
}
```

### 5.4 GraphQL API

#### REST vs GraphQL

| 特徴 | REST API | GraphQL API |
|-----|----------|-------------|
| **データ取得** | 複数エンドポイント | 単一エンドポイント |
| **Over-fetching** | ⚠️ 余分なデータも取得 | ✅ 必要なフィールドのみ |
| **パフォーマンス** | ⚠️ 複数リクエスト必要 | ✅ 1リクエストで完結 |
| **型安全性** | ⚠️ スキーマ更新必要 | ✅ イントロスペクション |
| **学習曲線** | ✅ HTTP/RESTの知識 | ⚠️ GraphQLクエリ言語 |
| **キャッシング** | ✅ HTTP標準 | ⚠️ 複雑 |

#### GraphQL使用が推奨されるケース

1. **Projects v2 API**: REST非対応、GraphQL必須
2. **複雑なデータ取得**: 関連データを一度に取得
3. **大量データ**: 2100リポジトリを8秒で取得（RESTは50リポジトリで30秒）
4. **レート制限節約**: 11リクエスト → 1リクエストに削減

#### octocrabでのGraphQL実装

```rust
use octocrab::Octocrab;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct IssueWithComments {
    repository: Repository,
}

#[derive(Debug, Deserialize)]
struct Repository {
    issue: Issue,
}

#[derive(Debug, Deserialize)]
struct Issue {
    title: String,
    body: Option<String>,
    comments: CommentConnection,
}

#[derive(Debug, Deserialize)]
struct CommentConnection {
    nodes: Vec<Comment>,
}

#[derive(Debug, Deserialize)]
struct Comment {
    author: Author,
    body: String,
}

#[derive(Debug, Deserialize)]
struct Author {
    login: String,
}

/// GraphQLでIssueとコメントを一度に取得
pub async fn get_issue_with_comments(
    octocrab: &Octocrab,
    owner: &str,
    repo: &str,
    issue_number: u64,
) -> Result<IssueWithComments> {
    let query = r#"
        query($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) {
                issue(number: $number) {
                    title
                    body
                    comments(first: 100) {
                        nodes {
                            author {
                                login
                            }
                            body
                        }
                    }
                }
            }
        }
    "#;

    let variables = serde_json::json!({
        "owner": owner,
        "repo": repo,
        "number": issue_number
    });

    let response: IssueWithComments = octocrab.graphql(&serde_json::json!({
        "query": query,
        "variables": variables
    })).await?;

    Ok(response)
}

/// Projects v2 API（GraphQL必須）
#[derive(Debug, Deserialize)]
struct ProjectsV2Response {
    repository: RepoWithProjects,
}

#[derive(Debug, Deserialize)]
struct RepoWithProjects {
    #[serde(rename = "projectsV2")]
    projects_v2: ProjectConnection,
}

#[derive(Debug, Deserialize)]
struct ProjectConnection {
    nodes: Vec<Project>,
}

#[derive(Debug, Deserialize)]
struct Project {
    id: String,
    title: String,
    number: u64,
}

pub async fn list_projects_v2(
    octocrab: &Octocrab,
    owner: &str,
    repo: &str,
) -> Result<Vec<Project>> {
    let query = r#"
        query($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) {
                projectsV2(first: 20) {
                    nodes {
                        id
                        title
                        number
                    }
                }
            }
        }
    "#;

    let variables = serde_json::json!({
        "owner": owner,
        "repo": repo
    });

    let response: ProjectsV2Response = octocrab.graphql(&serde_json::json!({
        "query": query,
        "variables": variables
    })).await?;

    Ok(response.repository.projects_v2.nodes)
}

/// GraphQL Mutations: Issueへのコメント追加
pub async fn add_comment_graphql(
    octocrab: &Octocrab,
    issue_id: &str,
    comment_body: &str,
) -> Result<String> {
    let mutation = r#"
        mutation($subjectId: ID!, $body: String!) {
            addComment(input: {subjectId: $subjectId, body: $body}) {
                commentEdge {
                    node {
                        id
                    }
                }
            }
        }
    "#;

    let variables = serde_json::json!({
        "subjectId": issue_id,
        "body": comment_body
    });

    let response: serde_json::Value = octocrab.graphql(&serde_json::json!({
        "query": mutation,
        "variables": variables
    })).await?;

    let comment_id = response["data"]["addComment"]["commentEdge"]["node"]["id"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(comment_id)
}
```

### 5.5 GitHub Actions Integration

```rust
use octocrab::Octocrab;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct WorkflowDispatchInputs {
    pub issue_number: String,
    pub action: String,
}

/// GitHub Actionsワークフローを手動実行
pub async fn trigger_workflow(
    octocrab: &Octocrab,
    owner: &str,
    repo: &str,
    workflow_id: &str,
    branch: &str,
    inputs: WorkflowDispatchInputs,
) -> Result<()> {
    octocrab.actions()
        .create_workflow_dispatch(owner, repo, workflow_id, branch)
        .inputs(inputs)
        .send()
        .await?;

    println!("Workflow dispatched successfully");
    Ok(())
}

/// ワークフロー実行状態を監視
pub async fn monitor_workflow_run(
    octocrab: &Octocrab,
    owner: &str,
    repo: &str,
    run_id: u64,
) -> Result<String> {
    use tokio::time::{sleep, Duration};

    loop {
        let run = octocrab.actions()
            .get_workflow_run(owner, repo, run_id)
            .await?;

        match run.status.as_str() {
            "completed" => {
                return Ok(run.conclusion.unwrap_or_else(|| "unknown".to_string()));
            }
            "queued" | "in_progress" => {
                println!("Workflow status: {}", run.status);
                sleep(Duration::from_secs(10)).await;
            }
            _ => {
                anyhow::bail!("Unexpected workflow status: {}", run.status);
            }
        }
    }
}

/// PRのチェック状態を取得
pub async fn get_pr_check_status(
    octocrab: &Octocrab,
    owner: &str,
    repo: &str,
    pr_number: u64,
) -> Result<bool> {
    let pr = octocrab.pulls(owner, repo).get(pr_number).await?;
    let sha = pr.head.sha;

    // Check Runs取得
    let check_runs = octocrab.checks(owner, repo)
        .list_check_runs_for_git_ref(&sha)
        .send()
        .await?;

    // 全てのチェックが成功しているか
    let all_passed = check_runs.check_runs.iter().all(|run| {
        run.conclusion.as_deref() == Some("success")
    });

    Ok(all_passed)
}
```

---

## 6. Recommended Architecture for Zeami

### 6.1 レイヤード アーキテクチャ

```
┌─────────────────────────────────────────┐
│         Tauri Frontend (React)          │
│  - Terminal UI (xterm.js)               │
│  - Issue List View                      │
│  - Workflow Status Display              │
└─────────────────┬───────────────────────┘
                  │ IPC Commands
┌─────────────────▼───────────────────────┐
│      Tauri Backend (Rust)               │
│  ┌──────────────────────────────────┐   │
│  │   GitHub Service Layer            │   │
│  │  - GitHubClient (octocrab)        │   │
│  │  - Rate Limit Manager             │   │
│  │  - Cache Manager                  │   │
│  └──────────────┬───────────────────┘   │
│                 │                        │
│  ┌──────────────▼───────────────────┐   │
│  │   Domain Logic                    │   │
│  │  - Issue Manager                  │   │
│  │  - PR Manager                     │   │
│  │  - Workflow Monitor               │   │
│  └──────────────┬───────────────────┘   │
│                 │                        │
│  ┌──────────────▼───────────────────┐   │
│  │   Infrastructure                  │   │
│  │  - Auth Manager (Keychain)        │   │
│  │  - Config Manager                 │   │
│  │  - PTY Manager                    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 6.2 ディレクトリ構造

```
src-tauri/
├── src/
│   ├── main.rs                    # Tauri entry point
│   ├── commands/                  # Tauri IPC commands
│   │   ├── mod.rs
│   │   ├── github_commands.rs     # GitHub API操作
│   │   ├── issue_commands.rs      # Issue操作
│   │   └── workflow_commands.rs   # Workflow操作
│   ├── github/                    # GitHub API層
│   │   ├── mod.rs
│   │   ├── client.rs              # GitHubClient wrapper
│   │   ├── issues.rs              # Issue操作
│   │   ├── pulls.rs               # PR操作
│   │   ├── workflows.rs           # Workflow操作
│   │   ├── cache.rs               # キャッシング
│   │   └── rate_limit.rs          # レート制限管理
│   ├── domain/                    # ビジネスロジック
│   │   ├── mod.rs
│   │   ├── issue_manager.rs
│   │   ├── pr_manager.rs
│   │   └── workflow_monitor.rs
│   ├── infrastructure/            # インフラ層
│   │   ├── mod.rs
│   │   ├── auth.rs                # 認証（Keychain）
│   │   ├── config.rs              # 設定管理
│   │   └── storage.rs             # ローカルストレージ
│   ├── pty/                       # PTY関連
│   │   └── ...
│   └── error.rs                   # エラー型定義
└── Cargo.toml
```

### 6.3 サンプル実装

#### `src-tauri/src/github/client.rs`

```rust
use octocrab::Octocrab;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct GitHubClient {
    octocrab: Octocrab,
    cache: Arc<RwLock<ApiCache>>,
    rate_limiter: Arc<RwLock<RateLimiter>>,
}

impl GitHubClient {
    pub async fn new() -> Result<Self> {
        let token = crate::infrastructure::auth::get_github_token()?;

        let octocrab = Octocrab::builder()
            .personal_token(token)
            .build()?;

        Ok(Self {
            octocrab,
            cache: Arc::new(RwLock::new(ApiCache::new())),
            rate_limiter: Arc::new(RwLock::new(RateLimiter::new())),
        })
    }

    pub fn octocrab(&self) -> &Octocrab {
        &self.octocrab
    }

    pub async fn check_rate_limit(&self) -> Result<RateLimitInfo> {
        self.rate_limiter.read().await.check(&self.octocrab).await
    }
}
```

#### `src-tauri/src/github/issues.rs`

```rust
use super::client::GitHubClient;
use octocrab::models::issues::Issue;

pub struct IssueService {
    client: Arc<GitHubClient>,
}

impl IssueService {
    pub fn new(client: Arc<GitHubClient>) -> Self {
        Self { client }
    }

    pub async fn create_issue(
        &self,
        owner: &str,
        repo: &str,
        title: &str,
        body: &str,
        labels: Vec<String>,
    ) -> Result<Issue> {
        // レート制限チェック
        self.client.check_rate_limit().await?;

        let issue = self.client.octocrab()
            .issues(owner, repo)
            .create(title)
            .body(body)
            .labels(labels)
            .send()
            .await?;

        Ok(issue)
    }

    pub async fn list_issues(
        &self,
        owner: &str,
        repo: &str,
        state: octocrab::params::State,
    ) -> Result<Vec<Issue>> {
        // キャッシュチェック
        let cache_key = format!("issues:{}:{}:{:?}", owner, repo, state);

        if let Some(cached) = self.client.cache.read().await.get(&cache_key) {
            return Ok(cached);
        }

        // API呼び出し
        let page = self.client.octocrab()
            .issues(owner, repo)
            .list()
            .state(state)
            .per_page(100)
            .send()
            .await?;

        let issues: Vec<Issue> = page.items;

        // キャッシュ保存
        self.client.cache.write().await.set(cache_key, issues.clone(), 300);

        Ok(issues)
    }
}
```

#### `src-tauri/src/commands/issue_commands.rs`

```rust
use tauri::State;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateIssueRequest {
    pub owner: String,
    pub repo: String,
    pub title: String,
    pub body: String,
    pub labels: Vec<String>,
}

#[tauri::command]
pub async fn create_github_issue(
    request: CreateIssueRequest,
    github_client: State<'_, Arc<GitHubClient>>,
) -> Result<u64, String> {
    let issue_service = IssueService::new(github_client.inner().clone());

    let issue = issue_service.create_issue(
        &request.owner,
        &request.repo,
        &request.title,
        &request.body,
        request.labels,
    ).await.map_err(|e| e.to_string())?;

    Ok(issue.number)
}

#[tauri::command]
pub async fn list_github_issues(
    owner: String,
    repo: String,
    github_client: State<'_, Arc<GitHubClient>>,
) -> Result<Vec<IssueDto>, String> {
    let issue_service = IssueService::new(github_client.inner().clone());

    let issues = issue_service.list_issues(
        &owner,
        &repo,
        octocrab::params::State::Open,
    ).await.map_err(|e| e.to_string())?;

    let dtos: Vec<IssueDto> = issues.into_iter()
        .map(IssueDto::from)
        .collect();

    Ok(dtos)
}

#[derive(Debug, Serialize)]
pub struct IssueDto {
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub labels: Vec<String>,
}

impl From<octocrab::models::issues::Issue> for IssueDto {
    fn from(issue: octocrab::models::issues::Issue) -> Self {
        Self {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state.to_string(),
            labels: issue.labels.into_iter()
                .map(|l| l.name)
                .collect(),
        }
    }
}
```

---

## 7. Implementation Roadmap for Issue #7

### Phase 1: 基本的なIssue操作（Week 1-2）

#### 実装内容
- [x] 認証システム（macOS Keychain統合）
- [x] GitHubClient基盤
- [x] Issue CRUD操作
  - [ ] Issue作成
  - [ ] Issue一覧取得
  - [ ] Issue詳細取得
  - [ ] Issue更新
- [x] 基本的なエラーハンドリング

#### コードサンプル
```rust
// Issue #7要件: Issue作成
pub async fn create_issue_from_template(
    client: &GitHubClient,
    owner: &str,
    repo: &str,
    title: &str,
    template: &IssueTemplate,
) -> Result<u64> {
    let body = template.render()?;

    let issue = client.octocrab()
        .issues(owner, repo)
        .create(title)
        .body(&body)
        .labels(template.labels.clone())
        .send()
        .await?;

    println!("Created issue #{}: {}", issue.number, issue.title);
    Ok(issue.number)
}
```

### Phase 2: PR操作とワークフロー監視（Week 3-4）

#### 実装内容
- [ ] PR作成
- [ ] PR一覧・詳細取得
- [ ] ワークフロー実行監視
- [ ] Check Runs状態確認
- [ ] レート制限管理

#### コードサンプル
```rust
// Issue #7要件: PR作成とワークフロー監視
pub async fn create_pr_and_monitor(
    client: &GitHubClient,
    owner: &str,
    repo: &str,
    title: &str,
    head: &str,
    base: &str,
) -> Result<()> {
    // PR作成
    let pr = client.octocrab()
        .pulls(owner, repo)
        .create(title, head, base)
        .body("Auto-generated PR from Zeami")
        .send()
        .await?;

    println!("Created PR #{}", pr.number);

    // ワークフロー監視
    loop {
        let checks_passed = crate::github::workflows::get_pr_check_status(
            client,
            owner,
            repo,
            pr.number,
        ).await?;

        if checks_passed {
            println!("All checks passed!");
            break;
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
    }

    Ok(())
}
```

### Phase 3: 高度な機能（Week 5-6）

#### 実装内容
- [ ] GraphQL API（Projects v2）
- [ ] ETag キャッシング
- [ ] Webhook受信（オプション）
- [ ] gh CLI統合

---

## 8. Sample Code Collection

### 8.1 完全なGitHubClient実装

```rust
// src-tauri/src/github/mod.rs
pub mod client;
pub mod issues;
pub mod pulls;
pub mod workflows;
pub mod cache;
pub mod rate_limit;

pub use client::GitHubClient;
pub use issues::IssueService;
pub use pulls::PullRequestService;
pub use workflows::WorkflowService;
```

```rust
// src-tauri/src/github/client.rs
use octocrab::Octocrab;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;

pub struct GitHubClient {
    octocrab: Octocrab,
    owner: String,
    repo: String,
    cache: Arc<RwLock<super::cache::ApiCache>>,
    rate_limiter: Arc<RwLock<super::rate_limit::RateLimiter>>,
}

impl GitHubClient {
    pub async fn new(owner: String, repo: String) -> Result<Self> {
        let token = crate::infrastructure::auth::get_github_token()?;

        let octocrab = Octocrab::builder()
            .personal_token(token)
            .build()?;

        Ok(Self {
            octocrab,
            owner,
            repo,
            cache: Arc::new(RwLock::new(super::cache::ApiCache::new())),
            rate_limiter: Arc::new(RwLock::new(super::rate_limit::RateLimiter::new())),
        })
    }

    pub fn octocrab(&self) -> &Octocrab {
        &self.octocrab
    }

    pub fn owner(&self) -> &str {
        &self.owner
    }

    pub fn repo(&self) -> &str {
        &self.repo
    }

    pub async fn ensure_rate_limit(&self) -> Result<()> {
        self.rate_limiter.write().await.ensure_available(&self.octocrab).await
    }
}
```

### 8.2 Tauri統合

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod github;
mod infrastructure;
mod domain;
mod error;

use std::sync::Arc;
use github::GitHubClient;

#[tokio::main]
async fn main() {
    // GitHubClient初期化
    let github_client = Arc::new(
        GitHubClient::new("owner".to_string(), "repo".to_string())
            .await
            .expect("Failed to initialize GitHub client")
    );

    tauri::Builder::default()
        .manage(github_client)
        .invoke_handler(tauri::generate_handler![
            commands::github_commands::get_rate_limit,
            commands::issue_commands::create_github_issue,
            commands::issue_commands::list_github_issues,
            commands::issue_commands::get_github_issue,
            commands::pr_commands::create_pull_request,
            commands::pr_commands::list_pull_requests,
            commands::workflow_commands::list_workflows,
            commands::workflow_commands::monitor_workflow_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 8.3 React Frontend統合

```typescript
// src/hooks/useGitHub.ts
import { invoke } from '@tauri-apps/api/tauri';

export interface Issue {
  number: number;
  title: string;
  body?: string;
  state: string;
  labels: string[];
}

export const useGitHub = () => {
  const createIssue = async (
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[]
  ): Promise<number> => {
    return await invoke('create_github_issue', {
      request: { owner, repo, title, body, labels }
    });
  };

  const listIssues = async (
    owner: string,
    repo: string
  ): Promise<Issue[]> => {
    return await invoke('list_github_issues', { owner, repo });
  };

  const getRateLimit = async () => {
    return await invoke('get_rate_limit');
  };

  return {
    createIssue,
    listIssues,
    getRateLimit,
  };
};
```

---

## 9. Testing Strategy

### 9.1 ユニットテスト

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use mockito::{mock, server_url};

    #[tokio::test]
    async fn test_create_issue() {
        let _m = mock("POST", "/repos/owner/repo/issues")
            .with_status(201)
            .with_header("content-type", "application/json")
            .with_body(r#"{"number": 42, "title": "Test Issue"}"#)
            .create();

        let octocrab = Octocrab::builder()
            .base_uri(&server_url())
            .unwrap()
            .build()
            .unwrap();

        let issue = octocrab.issues("owner", "repo")
            .create("Test Issue")
            .send()
            .await
            .unwrap();

        assert_eq!(issue.number, 42);
        assert_eq!(issue.title, "Test Issue");
    }
}
```

### 9.2 統合テスト

```rust
#[tokio::test]
#[ignore] // 実際のAPIを呼ぶため、手動実行のみ
async fn test_real_api_issue_creation() {
    let token = std::env::var("GITHUB_TOKEN").unwrap();
    let octocrab = Octocrab::builder()
        .personal_token(token)
        .build()
        .unwrap();

    let issue = octocrab.issues("test-owner", "test-repo")
        .create("Test Issue from Integration Test")
        .body("This is a test")
        .labels(vec!["test".to_string()])
        .send()
        .await
        .unwrap();

    assert!(issue.number > 0);

    // クリーンアップ: Issueをクローズ
    octocrab.issues("test-owner", "test-repo")
        .update(issue.number)
        .state(octocrab::params::State::Closed)
        .send()
        .await
        .unwrap();
}
```

---

## 10. Comparison Table: octocrab vs gh CLI

| 機能 | octocrab | gh CLI | 推奨 |
|-----|----------|---------|------|
| **Issue作成** | ✅ 型安全 | ✅ シンプル | octocrab |
| **Issue一覧** | ✅ ページネーション対応 | ✅ JSON出力 | octocrab |
| **PR作成** | ✅ プログラマティック | ✅ インタラクティブ | 用途次第 |
| **PRマージ** | ✅ 細かい制御 | ✅ 簡単 | octocrab |
| **ワークフロー実行** | ✅ ディスパッチAPI | ✅ gh workflow run | octocrab |
| **Webhook受信** | ✅ ネイティブサポート | ❌ 非対応 | octocrab |
| **認証管理** | 手動実装必要 | ✅ 自動管理 | gh CLI |
| **GraphQL** | ✅ 直接サポート | ✅ gh api graphql | octocrab |
| **エラーハンドリング** | ✅ Result型 | ⚠️ 終了コード | octocrab |
| **パフォーマンス** | ✅ 高速 | ⚠️ プロセス起動 | octocrab |

---

## References

### Official Documentation
- [octocrab - Rust](https://docs.rs/octocrab)
- [GitHub - XAMPPRocky/octocrab](https://github.com/XAMPPRocky/octocrab)
- [Rate limits for the REST API - GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [Best practices for using the REST API - GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [Comparing GitHub's REST API and GraphQL API - GitHub Docs](https://docs.github.com/en/rest/about-the-rest-api/comparing-githubs-rest-api-and-graphql-api)

### Libraries & Tools
- [keyring - Rust](https://docs.rs/keyring/latest/keyring/)
- [GitHub - open-source-cooperative/keyring-rs](https://github.com/hwchen/keyring-rs)
- [gh CLI - GitHub CLI](https://cli.github.com/manual/gh_api)

### Articles & Guides
- [Using the GitHub API in Rust. With Octocrab crate - Medium](https://medium.com/@dmbtechdev/using-the-github-api-in-rust-9b2e50dccb2f)
- [Scripting with GitHub CLI - The GitHub Blog](https://github.blog/engineering/engineering-principles/scripting-with-github-cli/)
- [A Developer's Guide: Managing Rate Limits for the GitHub API - Lunar.dev](https://www.lunar.dev/post/a-developers-guide-managing-rate-limits-for-the-github-api)
- [Polling vs. Webhooks: Getting Data in Real-Time - DEV Community](https://dev.to/raksbisht/polling-vs-webhooks-getting-data-in-real-time-543n)

---

## Next Steps

1. **認証システム実装**: macOS Keychain統合を最優先で実装
2. **基本的なIssue操作**: CRUD機能の実装
3. **レート制限管理**: 適切なキャッシングとリトライロジック
4. **PR操作**: 作成、一覧、マージ機能
5. **ワークフロー監視**: GitHub Actions統合

このドキュメントをベースに、Issue #7の実装を進めてください。
