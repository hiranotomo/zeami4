# Issue #1 (Updated): Zeami - Tauri版GitHub Issue駆動開発GUIアプリの設計

## 🎯 プロジェクトの目的

Claude Codeを使った開発ワークフローを支援する、**macOSネイティブGUIアプリケーション**。Issue駆動開発（IDD）を徹底し、Rust + Web技術（Tauri）で構築する高速・軽量・安全なデスクトップアプリ。

### コアバリュー

1. **Issue First** - すべての開発作業が必ずGitHub Issueに紐づく
2. **Native Experience** - macOSネイティブアプリとしての快適なUX
3. **Performance** - Electron比で3倍軽量、2倍高速
4. **Developer Experience** - React + TypeScriptによる高速開発

## 🔬 技術選定の根拠

### なぜTauriを選んだか

**比較検討結果（2025年最新データ）:**

| 項目 | Tauri | Electron | Pure Rust GUI (egui) |
|------|-------|----------|---------------------|
| **バイナリサイズ** | 2.5-10MB ✅ | 50-85MB ❌ | 3-5MB ✅ |
| **メモリ使用量** | 30-40MB ✅ | 数百MB ❌ | 20-30MB ✅ |
| **起動時間** | <0.5秒 ✅ | 1-2秒 ❌ | <0.3秒 ✅ |
| **開発速度** | React使用 ✅ | React使用 ✅ | 低速 ❌ |
| **エコシステム** | 成長中 ⚡ | 成熟 ✅ | 限定的 ❌ |
| **2024年成長率** | +35% ✅ | 安定 ○ | ニッチ ○ |

**決定理由:**

1. **パフォーマンス優位性** - Electron比で劇的に軽量（85MB → 2.5MB）
2. **セキュリティ** - Principle of Least Privilege
3. **開発生産性** - React/TypeScriptの豊富なエコシステム
4. **macOS統合** - WKWebViewによるネイティブ体験
5. **Rust活用** - GitHub API、Git操作をRustで実装

**参考:**
- [Tauri vs Electron 2025 Comparison](https://www.gethopp.app/blog/tauri-vs-electron)
- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/)

### 採用技術スタック

#### Frontend

| カテゴリ | 技術 | バージョン | 選定理由 |
|---------|------|-----------|---------|
| フレームワーク | React | 19 | 最新版、豊富なライブラリ |
| 言語 | TypeScript | 5.x | 型安全、開発効率 |
| ビルドツール | Vite | 6.x | 高速ビルド、Tauri公式推奨 |
| UI Framework | shadcn/ui | latest | Tailwind CSS、カスタマイズ容易 |
| State管理 | Zustand | 5.x | シンプル、React 19対応 |
| ルーティング | TanStack Router | latest | 型安全ルーティング |
| API通信 | TanStack Query | 5.x | キャッシング、楽観的更新 |
| Styling | Tailwind CSS | 4.x | ユーティリティファースト |

#### Backend (Rust)

| カテゴリ | ライブラリ | バージョン | 選定理由 |
|---------|-----------|-----------|---------|
| Framework | Tauri | 2.0 | 最新安定版、2024年リリース |
| GitHub API | octocrab | 0.38 | 型安全、非同期対応 |
| Git操作 | git2 | 0.18 | libgit2バインディング |
| 非同期 | tokio | 1.x | Tauri標準 |
| エラー | anyhow/thiserror | 1.0 | Rust標準パターン |
| シリアライズ | serde | 1.0 | Tauri IPC必須 |

**参考:**
- [Tauri Best Practices](https://v2.tauri.app/concept/)
- [Production-Ready Tauri Template](https://github.com/dannysmith/tauri-template)

## 🏗️ アーキテクチャ設計

### プロジェクト構造

```
zeami4/
├── src/                        # Frontend (React + TypeScript)
│   ├── main.tsx               # エントリーポイント
│   ├── App.tsx                # ルートコンポーネント
│   ├── components/            # UIコンポーネント
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── issues/
│   │   │   ├── IssueList.tsx
│   │   │   ├── IssueDetail.tsx
│   │   │   └── IssueCreate.tsx
│   │   └── ui/                # shadcn/ui components
│   ├── hooks/                 # Custom Hooks
│   │   ├── useGitHub.ts
│   │   ├── useGitOps.ts
│   │   └── useIssueLink.ts
│   ├── store/                 # Zustand stores
│   │   ├── issueStore.ts
│   │   ├── configStore.ts
│   │   └── gitStore.ts
│   ├── services/              # Tauri Command wrappers
│   │   ├── github.ts
│   │   ├── git.ts
│   │   └── config.ts
│   ├── types/                 # TypeScript types
│   │   ├── issue.ts
│   │   ├── github.ts
│   │   └── git.ts
│   └── lib/                   # Utilities
│       └── utils.ts
│
├── src-tauri/                 # Backend (Rust)
│   ├── src/
│   │   ├── main.rs            # Tauri app setup
│   │   ├── lib.rs             # Command exports
│   │   ├── commands/          # Tauri Commands
│   │   │   ├── mod.rs
│   │   │   ├── github.rs      # GitHub API commands
│   │   │   ├── git.rs         # Git operations
│   │   │   └── config.rs      # Config management
│   │   ├── github/            # GitHub API layer
│   │   │   ├── mod.rs
│   │   │   ├── client.rs
│   │   │   └── issues.rs
│   │   ├── git/               # Git layer
│   │   │   ├── mod.rs
│   │   │   ├── repository.rs
│   │   │   └── branch.rs
│   │   ├── config/            # Config management
│   │   │   └── mod.rs
│   │   └── error.rs           # Error types
│   ├── Cargo.toml
│   ├── tauri.conf.json        # Tauri設定
│   └── capabilities/          # Security capabilities
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

**参考:** [Tauri Project Structure](https://v2.tauri.app/start/project-structure/)

### アーキテクチャパターン

#### 1. Frontend-Backend通信（IPC）

```typescript
// Frontend: src/services/github.ts
import { invoke } from '@tauri-apps/api/core';

export async function listIssues(): Promise<Issue[]> {
  return await invoke<Issue[]>('list_github_issues');
}

export async function createIssue(title: string, body: string): Promise<Issue> {
  return await invoke<Issue>('create_github_issue', { title, body });
}
```

```rust
// Backend: src-tauri/src/commands/github.rs
use tauri::State;
use crate::github::GitHubClient;

#[tauri::command]
pub async fn list_github_issues(
    client: State<'_, GitHubClient>
) -> Result<Vec<IssueInfo>, String> {
    client.list_issues()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_github_issue(
    title: String,
    body: String,
    client: State<'_, GitHubClient>
) -> Result<IssueInfo, String> {
    client.create_issue(&title, &body)
        .await
        .map_err(|e| e.to_string())
}
```

**参考:** [Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/)

#### 2. State Management (Zustand)

```typescript
// src/store/issueStore.ts
import { create } from 'zustand';
import { listIssues } from '@/services/github';

interface IssueStore {
  issues: Issue[];
  selectedIssue: Issue | null;
  isLoading: boolean;
  fetchIssues: () => Promise<void>;
  selectIssue: (issue: Issue) => void;
}

export const useIssueStore = create<IssueStore>((set) => ({
  issues: [],
  selectedIssue: null,
  isLoading: false,

  fetchIssues: async () => {
    set({ isLoading: true });
    const issues = await listIssues();
    set({ issues, isLoading: false });
  },

  selectIssue: (issue) => set({ selectedIssue: issue }),
}));
```

#### 3. セキュリティ（Principle of Least Privilege）

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for zeami",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file"
  ]
}
```

**セキュリティベストプラクティス:**
- ✅ フロントエンドで機密情報を扱わない
- ✅ 必要最小限の権限のみ許可
- ✅ ユーザー入力を常にサニタイズ
- ✅ ビジネスロジックはRust側に配置

**参考:** [Tauri Security Best Practices](https://v2.tauri.app/concept/architecture/)

## 🎨 UI/UXデザイン

### デザインシステム: shadcn/ui + Tailwind CSS

```tsx
// src/components/issues/IssueList.tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useIssueStore } from '@/store/issueStore';

export function IssueList() {
  const { issues, selectIssue } = useIssueStore();

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <Card
          key={issue.number}
          onClick={() => selectIssue(issue)}
          className="cursor-pointer hover:bg-accent transition-colors"
        >
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Badge variant={issue.state === 'open' ? 'default' : 'secondary'}>
                {issue.state}
              </Badge>
              <span className="font-medium">#{issue.number}</span>
            </div>
            <h3 className="mt-2 font-semibold">{issue.title}</h3>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### レイアウト

```
┌─────────────────────────────────────────────┐
│  Header (Repository, Branch, Issue)         │
├───────────┬─────────────────────────────────┤
│           │                                 │
│  Sidebar  │      Main Content               │
│           │                                 │
│  - Issues │  ┌──────────────────────────┐  │
│  - Spec   │  │   Issue Detail           │  │
│  - Dev    │  │                          │  │
│  - Status │  │   #123: Add feature      │  │
│           │  │                          │  │
│           │  │   Description...         │  │
│           │  │                          │  │
│           │  │   [Start Development]    │  │
│           │  └──────────────────────────┘  │
└───────────┴─────────────────────────────────┘
```

## 🔄 Issue駆動開発ワークフロー

### フェーズ1: 初期設定

```tsx
// 初回起動時の設定画面
<SetupWizard>
  <Step1>GitHub Personal Access Token入力</Step1>
  <Step2>リポジトリ選択</Step2>
  <Step3>接続確認</Step3>
</SetupWizard>
```

### フェーズ2: Issue一覧

```tsx
// Issue一覧画面
<IssueList>
  <Filter state="open|closed|all" />
  <SearchBar placeholder="Search issues..." />
  <IssueCard>
    #123 - Add user authentication
    [Start Dev Button]
  </IssueCard>
</IssueList>
```

### フェーズ3: 開発開始

```
ユーザー操作:
1. Issueカードの [Start Dev] クリック
   ↓
2. ブランチ名自動生成: issue-123-add-user-auth
   ↓
3. Gitブランチ作成
   ↓
4. .claude/context/issue-123.md 作成
   ↓
5. ステータス更新: "In Progress"
```

```rust
// src-tauri/src/commands/git.rs
#[tauri::command]
pub async fn start_issue_development(
    issue_number: u64,
    issue_title: String,
) -> Result<(), String> {
    // 1. ブランチ名生成
    let branch_name = format!("issue-{}-{}",
        issue_number,
        slugify(&issue_title)
    );

    // 2. Gitブランチ作成
    create_branch(&branch_name)?;

    // 3. Claude Codeコンテキスト作成
    write_claude_context(issue_number, &issue_title)?;

    // 4. 状態保存
    save_issue_link(issue_number, &branch_name)?;

    Ok(())
}
```

## 📦 ビルド＆配布

### macOS配布

```bash
# 開発ビルド
$ npm run tauri dev

# リリースビルド
$ npm run tauri build

# 出力:
# src-tauri/target/release/bundle/macos/Zeami.app
# src-tauri/target/release/bundle/dmg/Zeami_0.1.0_x64.dmg
```

### Code Signing

```json
// src-tauri/tauri.conf.json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name",
      "entitlements": null,
      "providerShortName": null
    }
  }
}
```

**環境変数:**
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"
```

**参考:** [macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/)

### GitHub Actions自動ビルド

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
```

## 📊 成功基準（Definition of Done）

### 機能要件

- [ ] **初期設定**
  - [ ] GitHub Personal Access Token設定
  - [ ] リポジトリ選択
  - [ ] 接続確認

- [ ] **Issue管理**
  - [ ] Issue一覧表示
  - [ ] Issue検索・フィルタリング
  - [ ] Issue詳細表示
  - [ ] Issue作成

- [ ] **開発ワークフロー**
  - [ ] Issue選択→ブランチ作成
  - [ ] Claude Codeコンテキスト自動生成
  - [ ] 進捗同期（コミット→Issueコメント）
  - [ ] PR作成支援

### 非機能要件

- [ ] **パフォーマンス**
  - [ ] 起動時間 < 500ms
  - [ ] メモリ使用量 < 50MB (idle)
  - [ ] バイナリサイズ < 10MB

- [ ] **互換性**
  - [ ] macOS Ventura (13.x) 以降
  - [ ] Apple Silicon + Intel対応

- [ ] **品質**
  - [ ] TypeScriptエラーゼロ
  - [ ] Rustコンパイル警告ゼロ
  - [ ] E2Eテストカバレッジ > 60%

## 🔗 関連Issue

- #2 - Tauri + React開発環境のセットアップと基本機能実装

## 📚 参考資料

### Tauri
- [Tauri 2.0 Documentation](https://v2.tauri.app/)
- [Tauri Architecture](https://v2.tauri.app/concept/architecture/)
- [Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/)
- [Production-Ready Template](https://github.com/dannysmith/tauri-template)

### Performance Comparison
- [Tauri vs Electron 2025](https://www.gethopp.app/blog/tauri-vs-electron)
- [Real-World Comparison](https://www.levminer.com/blog/tauri-vs-electron)

### React + TypeScript
- [Tauri React Guide](https://dev.to/dubisdev/creating-your-first-tauri-app-with-react-a-beginners-guide-3eb2)
- [TypeScript Integration](https://www.xjavascript.com/blog/tauri-react-typescript/)

### Distribution
- [macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/)
- [App Store Distribution](https://v2.tauri.app/distribute/app-store/)
