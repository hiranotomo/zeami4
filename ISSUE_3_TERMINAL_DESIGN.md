# Issue #3: Zeami - GitHub Issue駆動型ターミナルエミュレータの設計と実装方針

## 🎯 プロジェクトの目的

**GitHub Issue駆動開発を実現する、macOSネイティブGUIターミナルエミュレータ**

Warp、iTerm2のような独立したターミナルアプリケーションとして動作し、すべてのタブ・セッションがGitHub Issueに紐づく革新的な開発環境を構築する。

### コアバリュー

1. **Issue First Terminal** - すべてのターミナルタブがIssueに紐づく
2. **Native macOS App** - Tauri製の高速・軽量GUIアプリ
3. **Shell Integration** - zsh/bash/fishをPTY経由で完全サポート
4. **Claude Code Ready** - Issue情報を`.claude/context/`に自動注入

---

## 🔬 技術選定の根拠

### なぜターミナルエミュレータ + GitHub統合なのか

**既存ツールの課題:**

| ツール | 課題 |
|--------|------|
| iTerm2 | GitHub統合なし、Issue管理は手動 |
| Warp | GitHub統合あり**だが**Issue駆動開発に特化していない |
| VSCode Terminal | エディタ依存、独立したターミナルではない |
| Tmux + CLI | GUIなし、Issue可視化が弱い |

**Zeamiの差別化:**
- ✅ **ターミナルタブ = GitHub Issue** （1対1マッピング）
- ✅ **Issue情報を常時表示** （UI統合）
- ✅ **コミット→Issue自動更新** （ワークフロー自動化）
- ✅ **Claude Code統合** （AIペアプロ対応）

---

## 🏗️ アーキテクチャ設計

### 全体構成

```
┌──────────────────────────────────────────────────────────┐
│                 Zeami (Tauri App)                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend (React + TypeScript + xterm.js)               │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐     │
│  │ UI Layer   │  │ Terminal UI  │  │ State       │     │
│  │ (React)    │  │ (xterm.js)   │  │ (Zustand)   │     │
│  └─────┬──────┘  └──────┬───────┘  └──────┬──────┘     │
│        │                 │                  │            │
│        └─────────────────┴──────────────────┘            │
│                          │ IPC                           │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │    Backend (Rust)                                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐ │ │
│  │  │ PTY      │  │ GitHub   │  │ Git Ops         │ │ │
│  │  │ (portable│  │ API      │  │ (git2)          │ │ │
│  │  │  -pty)   │  │(octocrab)│  │                 │ │ │
│  │  └──────────┘  └──────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Shell (zsh/bash)     │
              │  Git Repository       │
              │  Claude Code          │
              └───────────────────────┘
```

---

## 📦 採用技術スタック

### Frontend

| カテゴリ | 技術 | バージョン | 選定理由 |
|---------|------|-----------|---------|
| Framework | React | 19 | 最新版、hooks最適化 |
| Language | TypeScript | 5.x | 型安全 |
| Build | Vite | 6.x | 高速ビルド |
| Terminal UI | **xterm.js** | 5.x | **業界標準、VSCode採用** |
| React Wrapper | xterm-for-react | latest | React統合簡易化 |
| UI Components | shadcn/ui | latest | Tailwind CSS統合 |
| State | Zustand | 5.x | 軽量、React 19対応 |
| Styling | Tailwind CSS | 4.x | ユーティリティ優先 |

**参考:** [xterm.js React Integration](https://github.com/robert-harbison/xterm-for-react)

### Backend (Rust)

| カテゴリ | ライブラリ | バージョン | 選定理由 |
|---------|-----------|-----------|---------|
| Framework | Tauri | 2.0 | 最新安定版 |
| PTY | **portable-pty** | 0.9 | **クロスプラットフォームPTY、wezterm採用** |
| Tauri PTY Plugin | tauri-plugin-pty | latest | Tauri統合簡易化 |
| GitHub API | octocrab | 0.38 | 型安全、非同期 |
| Git | git2 | 0.18 | libgit2 |
| Async | tokio | 1.x | Tauri標準 |
| Error | anyhow/thiserror | 1.0 | Rust標準 |

**参考:**
- [portable-pty Documentation](https://docs.rs/portable-pty/latest/portable_pty/)
- [tauri-plugin-pty](https://crates.io/crates/tauri-plugin-pty)
- [Tauri Terminal Example](https://github.com/marc2332/tauri-terminal)

---

## 🎨 UI/UX設計

### アプリケーションレイアウト

```
┌──────────────────────────────────────────────────────────┐
│ ●●● Zeami                                   🔍 ⚙️  - □ × │ ← macOSウィンドウ
├──────────────────────────────────────────────────────────┤
│ 📋 Issue #123: Add user authentication                  │ ← Issue情報バー
│ 🔀 Branch: issue-123-add-auth  👤 @username             │
├──────────────────────────────────────────────────────────┤
│ Tab1: #123 │ Tab2: #124 │ Tab3: main │ + │              │ ← タブバー
├──────────────────────────────────────────────────────────┤
│                                                          │
│ $ git status                                             │
│ On branch issue-123-add-auth                            │
│ Changes not staged for commit:                          │
│   modified:   src/auth.ts                               │
│                                                          │
│ $ npm run dev                                            │
│ > zeami@0.1.0 dev                                       │
│ > vite                                                   │
│                                                          │
│   VITE v6.0.0  ready in 231 ms                          │
│                                                          │
│   ➜  Local:   http://localhost:5173/                    │
│   ➜  Network: use --host to expose                      │
│                                                          │
│ $ █                                                      │ ← カーソル
│                                                          │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Issue情報バー（常時表示）

```tsx
// src/components/IssueBar.tsx
export function IssueBar() {
  const { currentIssue } = useIssueStore();
  const { currentBranch } = useGitStore();

  if (!currentIssue) {
    return (
      <div className="bg-yellow-50 border-b px-4 py-2">
        <p className="text-sm text-yellow-800">
          ⚠️ No issue linked. Run: <code>zeami link</code>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border-b px-4 py-2 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Badge>#{currentIssue.number}</Badge>
        <span className="font-medium">{currentIssue.title}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <GitBranch className="w-4 h-4" />
        <code>{currentBranch}</code>
      </div>
      <div className="ml-auto">
        <Button size="sm" onClick={syncProgress}>
          Sync Progress
        </Button>
      </div>
    </div>
  );
}
```

---

## 🔧 ターミナルエミュレータの実装

### 1. PTY統合（Rust側）

```rust
// src-tauri/src/pty/mod.rs
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::Window;

pub struct PtySession {
    pty: Box<dyn portable_pty::MasterPty>,
    reader: Box<dyn std::io::Read + Send>,
    writer: Box<dyn std::io::Write + Send>,
}

impl PtySession {
    pub fn new(shell: &str, window: Window) -> Result<Self, Box<dyn std::error::Error>> {
        let pty_system = NativePtySystem::default();

        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let cmd = CommandBuilder::new(shell);
        let child = pair.slave.spawn_command(cmd)?;

        let reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;

        // PTY出力をフロントエンドに転送
        spawn_pty_reader(reader, window);

        Ok(Self {
            pty: pair.master,
            reader,
            writer,
        })
    }

    pub fn write(&mut self, data: &[u8]) -> Result<(), std::io::Error> {
        self.writer.write_all(data)
    }

    pub fn resize(&mut self, rows: u16, cols: u16) -> Result<(), Box<dyn std::error::Error>> {
        self.pty.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }
}

fn spawn_pty_reader(mut reader: Box<dyn std::io::Read + Send>, window: Window) {
    tokio::spawn(async move {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    window.emit("pty-data", data).ok();
                }
                Err(e) => {
                    eprintln!("PTY read error: {}", e);
                    break;
                }
            }
        }
    });
}
```

**参考:** [Warp Terminal Architecture](https://www.warp.dev/blog/how-warp-works)

### 2. Tauri Commands

```rust
// src-tauri/src/commands/pty.rs
use tauri::State;
use crate::pty::PtySession;

#[tauri::command]
pub async fn create_pty_session(
    shell: String,
    window: tauri::Window,
) -> Result<String, String> {
    let session = PtySession::new(&shell, window)
        .map_err(|e| e.to_string())?;

    let session_id = uuid::Uuid::new_v4().to_string();
    // Store session in app state
    Ok(session_id)
}

#[tauri::command]
pub async fn write_to_pty(
    session_id: String,
    data: String,
) -> Result<(), String> {
    // Get session from state
    // session.write(data.as_bytes())?;
    Ok(())
}

#[tauri::command]
pub async fn resize_pty(
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    // session.resize(rows, cols)?;
    Ok(())
}
```

### 3. xterm.js統合（React側）

```tsx
// src/components/Terminal.tsx
import { useEffect, useRef } from 'react';
import { Terminal as XTermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

export function Terminal({ sessionId }: { sessionId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // xterm.js初期化
    const terminal = new XTermTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // ユーザー入力をPTYに送信
    terminal.onData((data) => {
      invoke('write_to_pty', { sessionId, data });
    });

    // PTY出力を受信
    const unlisten = listen<string>('pty-data', (event) => {
      terminal.write(event.payload);
    });

    // ウィンドウリサイズ対応
    const handleResize = () => {
      fitAddon.fit();
      invoke('resize_pty', {
        sessionId,
        rows: terminal.rows,
        cols: terminal.cols,
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      unlisten.then((fn) => fn());
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [sessionId]);

  return <div ref={terminalRef} className="h-full w-full" />;
}
```

**参考:**
- [xterm.js Documentation](https://xtermjs.org/)
- [Alacritty Architecture](https://github.com/alacritty/alacritty)

---

## 🔗 GitHub Issue統合機能

### 1. Issue-Tab紐付け

```rust
// src-tauri/src/state/mod.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppState {
    pub tabs: HashMap<String, TabInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TabInfo {
    pub tab_id: String,
    pub issue_number: Option<u64>,
    pub pty_session_id: String,
    pub current_branch: String,
}

#[tauri::command]
pub async fn link_tab_to_issue(
    tab_id: String,
    issue_number: u64,
) -> Result<(), String> {
    // 1. Gitブランチ作成
    let branch = format!("issue-{}", issue_number);
    create_git_branch(&branch)?;

    // 2. Issueコンテキスト保存
    save_claude_context(issue_number).await?;

    // 3. タブ-Issue紐付け保存
    save_tab_link(tab_id, issue_number)?;

    Ok(())
}
```

### 2. Claude Code統合

```rust
// src-tauri/src/claude/mod.rs
use crate::github::GitHubClient;

pub async fn save_claude_context(issue_number: u64) -> Result<(), Box<dyn std::error::Error>> {
    let client = GitHubClient::new()?;
    let issue = client.get_issue(issue_number).await?;

    let context = format!(
        r#"# Issue Context

## Issue #{}: {}

{}

## Acceptance Criteria

- Implement feature X
- Add tests
- Update documentation

## Technical Notes

[Additional context from issue body]
"#,
        issue.number, issue.title, issue.body.unwrap_or_default()
    );

    let path = format!(".claude/context/issue-{}.md", issue_number);
    tokio::fs::write(&path, context).await?;

    Ok(())
}
```

### 3. 自動コミット→Issue更新

```rust
// src-tauri/src/git/hooks.rs
use git2::Repository;

pub async fn on_commit(repo: &Repository) -> Result<(), Box<dyn std::error::Error>> {
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;

    // Issue番号抽出（ブランチ名から）
    if let Some(branch_name) = head.shorthand() {
        if let Some(issue_num) = extract_issue_number(branch_name) {
            // GitHub Issueにコメント追加
            update_issue_with_commit(issue_num, &commit).await?;
        }
    }

    Ok(())
}

fn extract_issue_number(branch: &str) -> Option<u64> {
    // "issue-123-feature-name" -> 123
    branch
        .strip_prefix("issue-")?
        .split('-')
        .next()?
        .parse()
        .ok()
}
```

---

## 📊 成功基準（Definition of Done）

### Phase 1: ターミナル基本機能

- [ ] **PTY統合**
  - [ ] portable-pty経由でシェル起動
  - [ ] zsh/bash/fish対応
  - [ ] 入出力のリアルタイム転送

- [ ] **xterm.js UI**
  - [ ] ターミナル描画
  - [ ] カーソル操作
  - [ ] カラー対応
  - [ ] ウィンドウリサイズ

- [ ] **タブ機能**
  - [ ] 複数タブ管理
  - [ ] タブ切り替え
  - [ ] 新規タブ作成

### Phase 2: GitHub統合

- [ ] **Issue管理**
  - [ ] Issue一覧取得
  - [ ] Issue検索
  - [ ] タブ-Issue紐付け

- [ ] **Git連携**
  - [ ] ブランチ自動作成（issue-123形式）
  - [ ] コミット検知
  - [ ] Issue自動更新

- [ ] **Claude Code**
  - [ ] `.claude/context/`生成
  - [ ] Issue情報の注入

### Phase 3: UX最適化

- [ ] **パフォーマンス**
  - [ ] 起動時間 < 500ms
  - [ ] メモリ < 50MB (idle)
  - [ ] バイナリサイズ < 15MB

- [ ] **macOS統合**
  - [ ] ネイティブメニュー
  - [ ] Spotlight検索
  - [ ] キーボードショートカット

---

## 🔗 関連Issue

- #4 - Tauri + xterm.js開発環境のセットアップ
- #5 - PTY統合とシェル起動の実装

---

## 📚 参考資料

### ターミナルエミュレータ
- [Warp: How Warp Works](https://www.warp.dev/blog/how-warp-works)
- [Alacritty Source Code](https://github.com/alacritty/alacritty)
- [Tauri Terminal Example](https://github.com/marc2332/tauri-terminal)

### PTY
- [portable-pty Documentation](https://docs.rs/portable-pty/latest/portable_pty/)
- [tauri-plugin-pty](https://crates.io/crates/tauri-plugin-pty)

### xterm.js
- [xterm.js Official](https://xtermjs.org/)
- [xterm-for-react](https://github.com/robert-harbison/xterm-for-react)
- [React xterm.js Integration Guide](https://www.linkedin.com/pulse/easy-web-terminal-magic-integrating-xtermjs-react-john-kagunda-545gf)

### Tauri
- [Tauri 2.0 Documentation](https://v2.tauri.app/)
- [Tauri Architecture](https://v2.tauri.app/concept/architecture/)
- [Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/)
