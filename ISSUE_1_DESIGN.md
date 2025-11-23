# Issue #1: Zeami - GitHub Issue駆動開発ツールの設計と実装方針

## 🎯 プロジェクトの目的

Claude Codeを使った開発ワークフローを支援する、Issue駆動開発（IDD: Issue-Driven Development）を徹底したRust製ターミナルツールの構築。

### コアバリュー

1. **Issue First** - すべての開発作業が必ずGitHub Issueに紐づく
2. **Context Aware** - Claude Codeに開発コンテキストを自動提供
3. **Workflow Automation** - 仕様決定→Issue作成→開発→完了までを自動化
4. **Developer Experience** - 高速起動、安定動作、直感的なUI

## 🔬 技術選定の根拠

### なぜRustを選んだか

**比較検討結果:**
- **Node.js**: 開発速度◎、安定性△（TUIライブラリが未成熟）
- **Go**: GitHub CLI実績◎、学習容易◎、TUIライブラリ△
- **Rust**: 安定性◎、パフォーマンス◎、TUIエコシステム◎

**決定理由:**
1. ターミナルUIの安定性（crossterm/ratatuiは5年以上の実績）
2. 型安全・メモリ安全による高品質
3. 単一バイナリ配布可能
4. クロスプラットフォーム対応

### 採用技術スタック

| カテゴリ | ライブラリ | バージョン | 選定理由 |
|---------|-----------|-----------|---------|
| CLI | clap | 4.5 | derive API、型安全、GitHub CLI採用実績 |
| TUI (低レベル) | crossterm | 0.27 | クロスプラットフォーム、5年以上の安定実績 |
| TUI (高レベル) | ratatui | 0.26 | tui-rsの成熟した後継、Elm Architecture対応 |
| Input | inquire | 0.7 | インタラクティブプロンプト、UX優秀 |
| GitHub API | octocrab | 0.38 | 公式推奨、型安全、非同期対応 |
| Git | git2 | 0.18 | libgit2バインディング、安定版 |
| Async | tokio | 1.x | 業界標準、GitHub API連携に必須 |
| Error | anyhow/thiserror | 1.0 | CLIはanyhow、ライブラリはthiserror |
| Serde | serde/toml | 1.0/0.8 | 設定ファイル管理 |
| Config | dirs | 5.0 | XDG Base Directory対応 |

## 🏗️ アーキテクチャ設計

### プロジェクト構造（ベストプラクティス準拠）

```
zeami4/
├── Cargo.toml           # ワークスペース設定（将来の拡張性）
├── src/
│   ├── main.rs          # エントリーポイント
│   ├── cli/             # CLIコマンド定義（clap）
│   │   ├── mod.rs       # コマンド構造
│   │   └── commands/    # サブコマンド実装
│   │       ├── init.rs
│   │       ├── spec.rs
│   │       ├── issue.rs
│   │       ├── dev.rs
│   │       └── status.rs
│   ├── github/          # GitHub API層
│   │   ├── mod.rs
│   │   ├── client.rs    # octocrab wrapper
│   │   ├── issues.rs
│   │   └── auth.rs
│   ├── git/             # Git操作層
│   │   ├── mod.rs
│   │   ├── repository.rs
│   │   └── branch.rs
│   ├── tui/             # TUIコンポーネント
│   │   ├── mod.rs
│   │   ├── app.rs       # Elm Architecture: Model
│   │   ├── update.rs    # Elm Architecture: Update
│   │   ├── view.rs      # Elm Architecture: View
│   │   └── components/  # 再利用可能なウィジェット
│   ├── config/          # 設定管理
│   │   ├── mod.rs
│   │   └── xdg.rs       # XDG Base Directory準拠
│   ├── state/           # 状態管理
│   │   ├── mod.rs
│   │   └── issue_link.rs
│   └── error.rs         # エラー型定義
├── tests/               # 統合テスト
└── examples/            # サンプルコード
```

### 設計パターン

#### 1. Elm Architecture (TEA) for TUI

```rust
// Model: アプリケーション状態
struct App {
    issues: Vec<Issue>,
    selected: usize,
    mode: AppMode,
}

// Update: 状態更新ロジック
fn update(app: &mut App, msg: Message) -> Command {
    match msg {
        Message::SelectNext => app.selected += 1,
        Message::FetchIssues => return Command::FetchIssues,
    }
}

// View: UI描画
fn view(app: &App, frame: &mut Frame) {
    // ratatui widgets
}
```

**採用理由:** gitui、多数のRust TUIアプリで実績

#### 2. エラーハンドリング戦略

```rust
// main.rs: anyhow使用
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    cli.execute().await?;
    Ok(())
}

// ライブラリコード: thiserror使用
#[derive(Error, Debug)]
pub enum ZeamiError {
    #[error("GitHub API error: {0}")]
    GitHub(String),

    #[error("Git operation failed: {0}")]
    Git(#[from] git2::Error),
}
```

**参考:** [Effective Error Handling in Rust CLI Apps](https://technorely.com/insights/effective-error-handling-in-rust-cli-apps-best-practices-examples-and-advanced-techniques)

#### 3. 設定管理（XDG準拠）

```
macOS:
  ~/.config/zeami/config.toml
  ~/.local/share/zeami/state.json
  ~/.cache/zeami/

Linux:
  $XDG_CONFIG_HOME/zeami/config.toml
  $XDG_DATA_HOME/zeami/state.json
  $XDG_CACHE_HOME/zeami/
```

**参考:** [XDG Base Directory Specification](https://rust-cli-recommendations.sunshowers.io/configuration.html)

## 🔄 Issue駆動開発ワークフロー

### フェーズ1: 仕様決定

```bash
$ zeami spec init
📝 Creating project specification...

Project name: my-app
Description: A cool application
Tech stack: [Rust, PostgreSQL, React]

✓ Saved to ~/.config/zeami/specs/my-app.yml
```

### フェーズ2: Issue作成

```bash
$ zeami issue create --from-spec
📋 Creating issues from spec...

Creating issues:
  #1 Setup Rust backend
  #2 Implement PostgreSQL schema
  #3 Build React frontend

✓ 3 issues created
```

### フェーズ3: 開発開始

```bash
$ zeami dev start
? Select issue:
❯ #1 Setup Rust backend
  #2 Implement PostgreSQL schema
  #3 Build React frontend

✓ Branch created: issue-1-setup-rust-backend
✓ Issue context saved to .claude/context/issue-1.md
✓ Ready to develop!

Current context:
  Issue: #1 - Setup Rust backend
  Branch: issue-1-setup-rust-backend
```

### フェーズ4: 開発・同期

```bash
$ zeami dev sync
🔄 Syncing progress...

Commits since last sync:
  - feat: Add Cargo.toml
  - feat: Implement basic server

✓ Updated issue #1 with progress
```

### フェーズ5: 完了

```bash
$ zeami dev complete
✅ Completing development...

Summary:
  Commits: 5
  Files changed: 12
  Tests: passing

? Create PR? (Y/n) Y

✓ PR #1 created and linked to issue #1
✓ Branch issue-1-setup-rust-backend → main
```

## 🎨 TUIデザイン原則

### 参考実装
- [gitui](https://github.com/gitui-org/gitui) - Git TUIのベストプラクティス
- [GitHub CLI (gh)](https://github.com/cli/cli) - コマンド設計の参考

### デザインガイドライン

1. **Immediate Mode Rendering** - ratatuiのパターンに従う
2. **Keyboard First** - vim風キーバインド（j/k/Enter/q）
3. **視認性** - lipglossによるスタイリング
4. **レスポンシブ** - ターミナルサイズに適応

## 📊 成功基準（Definition of Done）

### 機能要件
- [ ] GitHub Issue一覧の取得・表示
- [ ] Issue選択→ブランチ作成の自動化
- [ ] 現在のIssueコンテキスト表示
- [ ] ブランチ-Issue紐付けの永続化
- [ ] Claude Code連携（`.claude/context/`）

### 非機能要件
- [ ] 起動時間 < 100ms
- [ ] macOS/Linux対応
- [ ] ターミナル互換性（Terminal.app, iTerm2, Alacritty）
- [ ] エラーメッセージがユーザーフレンドリー
- [ ] 単一バイナリで配布可能

### 品質要件
- [ ] 統合テストカバレッジ > 70%
- [ ] Clippy警告ゼロ
- [ ] rustfmtフォーマット準拠
- [ ] ドキュメント完備（README, examples）

## 🔗 関連Issue

- #2 - macOSネイティブバイナリのビルドと基本動作

## 📚 参考資料

### Rust CLI Best Practices
- [Rust CLI Book](https://rust-cli.github.io/book/)
- [clap Derive API Guide](https://generalistprogrammer.com/tutorials/clap-rust-crate-guide)
- [Error Handling in Rust CLI](https://technorely.com/insights/effective-error-handling-in-rust-cli-apps-best-practices-examples-and-advanced-techniques)

### TUI Development
- [Ratatui Documentation](https://ratatui.rs/)
- [Elm Architecture Pattern](https://ratatui.rs/concepts/application-patterns/the-elm-architecture/)
- [Creating TUI in Rust](https://raysuliteanu.medium.com/creating-a-tui-in-rust-e284d31983b3)

### GitHub API
- [octocrab Documentation](https://docs.rs/octocrab/latest/octocrab/)
- [GitHub CLI Source](https://github.com/cli/cli)

### Project Structure
- [Cargo Workspaces](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html)
- [Rust Project Structure Best Practices](https://www.djamware.com/post/68b2c7c451ce620c6f5efc56/rust-project-structure-and-best-practices-for-clean-scalable-code)

### Configuration Management
- [XDG Base Directory in Rust](https://rust-cli-recommendations.sunshowers.io/configuration.html)
- [dirs crate](https://docs.rs/dirs/latest/dirs/)

### Issue-Driven Development
- [Development Workflow Best Practices](https://www.atlassian.com/agile/project-management/workflow)
- [Modern Developer Workflow](https://medium.com/@averageguymedianow/the-modern-developers-workflow-best-practices-for-peak-productivity-7655be24947f)
