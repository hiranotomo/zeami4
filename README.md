# Zeami

**GitHub issue-driven development tool for Claude Code**

Zeamiは、Claude Codeを使った開発ワークフローを支援するRust製のターミナルツールです。GitHub Issueを中心とした開発プロセスを自動化し、仕様決定からIssue作成、開発、完了までを一貫して管理します。

## 特徴

- 🎯 **Issue駆動開発** - すべての開発作業をGitHub Issueに紐付け
- 🚀 **高速・安定** - Rust製で高速起動、クロスプラットフォーム対応
- 🔗 **Git連携** - ブランチとIssueの自動リンク
- 💻 **TUI対応** - ratatui + crosstermによる安定したターミナルUI
- 🤖 **Claude Code統合** - 開発コンテキストの自動管理

## アーキテクチャ

```
zeami4/
├── src/
│   ├── cli/          # CLIコマンド定義（clap）
│   ├── config/       # 設定管理
│   ├── github/       # GitHub API連携（octocrab）
│   ├── git/          # Git操作（git2）
│   ├── state/        # 状態管理（Issue-Branch紐付け）
│   └── tui/          # TUIコンポーネント（ratatui）
├── Cargo.toml
└── README.md
```

## 技術スタック

| カテゴリ | ライブラリ | 用途 |
|---------|-----------|------|
| CLI | clap v4.5 | コマンドライン引数パース |
| TUI | crossterm v0.27 | ターミナル制御（安定版） |
| TUI | ratatui v0.26 | リッチTUIフレームワーク |
| Input | inquire v0.7 | インタラクティブプロンプト |
| GitHub | octocrab v0.38 | GitHub API クライアント |
| Git | git2 v0.18 | Git操作 |
| Async | tokio v1 | 非同期ランタイム |
| Serde | serde v1.0 | シリアライゼーション |

## インストール

### ソースからビルド

```bash
# リポジトリをクローン
git clone <repository-url>
cd zeami4

# ビルド
cargo build --release

# インストール（オプション）
cargo install --path .
```

## 使い方

### 1. 初期設定

```bash
zeami init
```

GitHub Personal Access Tokenとリポジトリ情報を設定します。
設定は `~/.zeami/config.toml` に保存されます。

### 2. プロジェクト仕様の作成

```bash
zeami spec init
```

### 3. Issue作成

```bash
zeami issue create
```

### 4. 開発開始

```bash
zeami dev start
```

### 5. 現在の状態確認

```bash
zeami status
```

## コマンド一覧

### `zeami init`
Zeamiの設定を初期化します。

### `zeami spec`
プロジェクト仕様を管理します。
- `spec init` - 新規仕様を作成
- `spec show` - 現在の仕様を表示
- `spec edit` - 仕様を編集

### `zeami issue`
GitHub Issueを管理します。
- `issue create` - 新しいIssueを作成
- `issue list` - Issue一覧を表示
- `issue show <number>` - Issue詳細を表示
- `issue link <number>` - 現在のブランチとIssueをリンク

### `zeami dev`
開発ワークフローを管理します。
- `dev start` - Issue開発を開始
- `dev sync` - 進捗をIssueに同期
- `dev complete` - 開発完了

### `zeami status`
現在の開発状態を表示します。

## 開発ワークフロー

```
1. 仕様決定
   zeami spec init
   ↓
2. Issue作成
   zeami issue create
   ↓
3. 開発開始
   zeami dev start
   ↓
4. コーディング（Claude Code使用）
   ↓
5. 進捗同期
   zeami dev sync
   ↓
6. 完了
   zeami dev complete
```

## 開発ステータス

現在は基本構造の実装が完了しています。

### 実装済み
- ✅ プロジェクト構造
- ✅ CLIコマンド定義
- ✅ 設定管理システム

### 実装予定
- ⏳ GitHub API連携
- ⏳ Git操作
- ⏳ Issue-Branch紐付け
- ⏳ TUIコンポーネント
- ⏳ Claude Code統合

## ライセンス

MIT

## 設計思想

Zeamiは「Issue駆動開発」を徹底し、すべてのターミナルセッションが必ずIssueに紐づくように設計されています。これにより：

- 開発目的が常に明確
- 進捗の可視化が容易
- Claude Codeへのコンテキスト提供が自動化
- チーム協働が円滑化

Rust + 成熟したターミナルライブラリにより、高速で安定した開発体験を提供します。
