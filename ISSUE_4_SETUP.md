# Issue #4: Tauri + xterm.js開発環境のセットアップと基本実装

## 🎯 目的

Issue #3で定義された設計に基づき、Zeami（GitHub Issue駆動型ターミナルエミュレータ）の開発環境をセットアップし、基本的なターミナル機能を実装する。

## 📋 前提条件

- macOS Ventura (13.x) 以降
- Rust 1.70以降インストール済み
- Node.js 20以降インストール済み
- GitHub Personal Access Token取得済み

---

## 🚀 実装スコープ

### Phase 1: プロジェクト初期化

#### 1.1 Tauriプロジェクト作成

```bash
# create-tauri-appでプロジェクト初期化
npm create tauri-app@latest

# 選択肢:
# - Project name: zeami
# - Package manager: npm
# - UI recipe: React + TypeScript
# - UI flavor: TypeScript
```

**参考:** [Tauri Create Project](https://v2.tauri.app/start/create-project/)

#### 1.2 依存関係追加

**Frontend (`package.json`):**
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "xterm-for-react": "^1.0.4",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

**Backend (`src-tauri/Cargo.toml`):**
```toml
[dependencies]
tauri = { version = "2.0", features = ["macos-private-api"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }

# PTY
portable-pty = "0.9"
tauri-plugin-pty = "0.1"

# GitHub API
octocrab = "0.38"

# Git
git2 = "0.18"

# Utilities
anyhow = "1.0"
thiserror = "1.0"
uuid = { version = "1.0", features = ["v4"] }

[build-dependencies]
tauri-build = { version = "2.0", features = [] }
```

#### 1.3 Tailwind CSS設定

```bash
# Tailwind CSS初期化
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**`tailwind.config.js`:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**`src/index.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### Phase 2: ターミナル基本機能実装

#### 2.1 PTYセッション管理（Rust側）

**ディレクトリ構造:**
```
src-tauri/src/
├── main.rs
├── lib.rs
├── commands/
│   ├── mod.rs
│   └── pty.rs
├── pty/
│   ├── mod.rs
│   └── session.rs
└── error.rs
```

**`src-tauri/src/pty/session.rs`:**
```rust
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

pub struct PtySession {
    master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl PtySession {
    pub fn new(shell: &str, rows: u16, cols: u16) -> anyhow::Result<Self> {
        let pty_system = NativePtySystem::default();

        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let cmd = CommandBuilder::new(shell);
        let child = pair.slave.spawn_command(cmd)?;

        Ok(Self {
            master: Arc::new(Mutex::new(pair.master)),
            child,
        })
    }

    pub fn write(&self, data: &[u8]) -> anyhow::Result<()> {
        let mut master = self.master.lock().unwrap();
        let writer = master.take_writer()?;
        writer.write_all(data)?;
        Ok(())
    }

    pub fn read(&self) -> anyhow::Result<Vec<u8>> {
        let mut master = self.master.lock().unwrap();
        let mut reader = master.try_clone_reader()?;
        let mut buf = vec![0u8; 8192];
        let n = reader.read(&mut buf)?;
        buf.truncate(n);
        Ok(buf)
    }

    pub fn resize(&self, rows: u16, cols: u16) -> anyhow::Result<()> {
        let mut master = self.master.lock().unwrap();
        master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }
}
```

**`src-tauri/src/commands/pty.rs`:**
```rust
use tauri::{AppHandle, Manager, State};
use std::collections::HashMap;
use std::sync::Mutex;
use crate::pty::PtySession;

pub struct PtyState {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub async fn create_pty(
    app: AppHandle,
    shell: String,
    rows: u16,
    cols: u16,
    state: State<'_, PtyState>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();

    let session = PtySession::new(&shell, rows, cols)
        .map_err(|e| e.to_string())?;

    // PTY出力をフロントエンドに送信するタスク起動
    let session_id_clone = session_id.clone();
    let app_clone = app.clone();
    tokio::spawn(async move {
        loop {
            if let Ok(data) = session.read() {
                if !data.is_empty() {
                    let payload = String::from_utf8_lossy(&data).to_string();
                    app_clone.emit("pty-data", (session_id_clone.clone(), payload)).ok();
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }
    });

    state.sessions.lock().unwrap().insert(session_id.clone(), session);
    Ok(session_id)
}

#[tauri::command]
pub async fn write_pty(
    session_id: String,
    data: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(&session_id)
        .ok_or("Session not found")?;

    session.write(data.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn resize_pty(
    session_id: String,
    rows: u16,
    cols: u16,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(&session_id)
        .ok_or("Session not found")?;

    session.resize(rows, cols)
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

**`src-tauri/src/main.rs`:**
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod pty;
mod error;

use commands::pty::PtyState;

fn main() {
    tauri::Builder::default()
        .manage(PtyState::new())
        .invoke_handler(tauri::generate_handler![
            commands::pty::create_pty,
            commands::pty::write_pty,
            commands::pty::resize_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

#### 2.2 xterm.jsコンポーネント（React側）

**ディレクトリ構造:**
```
src/
├── main.tsx
├── App.tsx
├── components/
│   ├── Terminal.tsx
│   ├── TabBar.tsx
│   └── IssueBar.tsx
├── hooks/
│   └── useTerminal.ts
└── styles/
    └── terminal.css
```

**`src/components/Terminal.tsx`:**
```typescript
import { useEffect, useRef, useState } from 'react';
import { Terminal as XTermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  tabId: string;
}

export function Terminal({ tabId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // xterm.js初期化
    const terminal = new XTermTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Menlo", "Monaco", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selection: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
      },
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // PTYセッション作成
    invoke<string>('create_pty', {
      shell: '/bin/zsh',
      rows: terminal.rows,
      cols: terminal.cols,
    }).then((id) => {
      setSessionId(id);
    });

    // ユーザー入力をPTYに送信
    terminal.onData((data) => {
      if (sessionId) {
        invoke('write_pty', { sessionId, data });
      }
    });

    // PTY出力を受信
    const unlisten = listen<[string, string]>('pty-data', (event) => {
      const [sid, data] = event.payload;
      if (sid === sessionId) {
        terminal.write(data);
      }
    });

    // リサイズ処理
    const handleResize = () => {
      fitAddon.fit();
      if (sessionId) {
        invoke('resize_pty', {
          sessionId,
          rows: terminal.rows,
          cols: terminal.cols,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      unlisten.then((fn) => fn());
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [tabId, sessionId]);

  return (
    <div
      ref={terminalRef}
      className="h-full w-full"
      style={{ padding: '8px' }}
    />
  );
}
```

**`src/App.tsx`:**
```typescript
import { useState } from 'react';
import { Terminal } from './components/Terminal';
import './App.css';

function App() {
  const [tabs, setTabs] = useState([{ id: '1', title: 'Terminal 1' }]);
  const [activeTab, setActiveTab] = useState('1');

  const addTab = () => {
    const newId = String(tabs.length + 1);
    setTabs([...tabs, { id: newId, title: `Terminal ${newId}` }]);
    setActiveTab(newId);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* タブバー */}
      <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t ${
              activeTab === tab.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {tab.title}
          </button>
        ))}
        <button
          onClick={addTab}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          +
        </button>
      </div>

      {/* ターミナル表示 */}
      <div className="flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`h-full ${activeTab === tab.id ? 'block' : 'hidden'}`}
          >
            <Terminal tabId={tab.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
```

---

### Phase 3: ビルドと動作確認

#### 3.1 開発ビルド

```bash
# 開発モード起動
npm run tauri dev

# 期待される動作:
# 1. Tauriウィンドウが開く
# 2. ターミナルが表示される
# 3. コマンド入力・実行ができる
# 4. タブの追加・切り替えができる
```

#### 3.2 リリースビルド

```bash
# リリースビルド
npm run tauri build

# 出力:
# src-tauri/target/release/bundle/macos/Zeami.app
# src-tauri/target/release/bundle/dmg/Zeami_0.1.0_universal.dmg
```

**`src-tauri/tauri.conf.json`最適化:**
```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],
    "identifier": "com.zeami.app",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "13.0"
    }
  }
}
```

---

## 📊 成功基準（Definition of Done）

### 機能チェックリスト

- [ ] **開発環境**
  - [ ] Tauriプロジェクト作成完了
  - [ ] 全依存関係インストール済み
  - [ ] TypeScriptエラーなし
  - [ ] Rustコンパイル成功

- [ ] **ターミナル基本機能**
  - [ ] PTYセッション作成・管理
  - [ ] xterm.jsでターミナル表示
  - [ ] キーボード入力→PTY送信
  - [ ] PTY出力→ターミナル表示
  - [ ] ターミナルリサイズ対応

- [ ] **タブ機能**
  - [ ] 複数タブ作成
  - [ ] タブ切り替え
  - [ ] 各タブ独立したPTYセッション

- [ ] **動作確認**
  - [ ] シェルコマンド実行（ls, cd, etc）
  - [ ] カラー出力表示
  - [ ] 日本語入出力
  - [ ] vimなどのフルスクリーンアプリ動作

### 品質チェックリスト

- [ ] **コード品質**
  - [ ] TypeScript型エラーゼロ
  - [ ] ESLint警告ゼロ
  - [ ] Rust Clippy警告ゼロ
  - [ ] rustfmt適用済み

- [ ] **パフォーマンス**
  - [ ] 起動時間 < 1秒
  - [ ] メモリ使用量 < 100MB（1タブ時）
  - [ ] 入力遅延なし

- [ ] **互換性**
  - [ ] macOS Ventura (13.x) 動作確認
  - [ ] macOS Sonoma (14.x) 動作確認
  - [ ] Apple Silicon (M1/M2/M3) 動作確認
  - [ ] Intel Mac 動作確認

---

## 🐛 既知の問題と回避策

### Issue 1: PTY読み取りブロッキング

**問題:** `session.read()`が同期的でブロックする

**解決策:**
```rust
// 非ブロッキング読み取り
use std::io::ErrorKind;

match reader.read(&mut buf) {
    Ok(n) if n > 0 => { /* データ処理 */ }
    Err(e) if e.kind() == ErrorKind::WouldBlock => {
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    _ => break,
}
```

### Issue 2: xterm.jsフォントレンダリング

**問題:** macOSでフォントがぼやける

**解決策:**
```css
/* src/styles/terminal.css */
.xterm {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 🔗 関連Issue

- #3 - Zeami設計と実装方針（前提）
- #5 - GitHub Issue統合機能の実装（次）

---

## 📚 参考資料

### 実装ガイド
- [Tauri Terminal Example](https://github.com/marc2332/tauri-terminal)
- [portable-pty Examples](https://docs.rs/portable-pty/latest/portable_pty/)
- [xterm.js API](https://xtermjs.org/docs/api/terminal/)

### チュートリアル
- [Tauri Quick Start](https://v2.tauri.app/start/)
- [React xterm.js Integration](https://www.linkedin.com/pulse/easy-web-terminal-magic-integrating-xtermjs-react-john-kagunda-545gf)

### トラブルシューティング
- [Tauri Debugging Guide](https://v2.tauri.app/debug/)
- [xterm.js Issues](https://github.com/xtermjs/xterm.js/issues)
