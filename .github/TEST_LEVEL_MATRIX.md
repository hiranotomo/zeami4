# Test Level Matrix

このドキュメントは、変更の種類と影響範囲に基づいて、どのレベルのテストを実施すべきかを定義しています。

## テストレベルの定義

### Level 0: No Testing Required
- **対象**: 完全に独立した新規ドキュメント、コメント修正など
- **実施内容**: テスト不要
- **確認**: Syntax/Linkチェックのみ

### Level 1: Manual Testing Only
- **対象**: ドキュメント修正、設定ファイル変更（影響小）
- **実施内容**: 手動での確認
- **確認**:
  - [ ] リンク確認
  - [ ] フォーマット確認
  - [ ] 内容の妥当性確認

### Level 2: Unit Tests + Manual Testing
- **対象**: 単一モジュールのコード変更、Agentの変更
- **実施内容**: ユニットテスト + 手動テスト
- **確認**:
  - [ ] `npm test` パス
  - [ ] 関連するユニットテスト追加/更新
  - [ ] 手動での動作確認
  - [ ] `npm run lint` パス

### Level 3: Unit + Integration Tests
- **対象**: 複数モジュールに影響するコード変更、ワークフロー変更
- **実施内容**: ユニットテスト + 統合テスト + 手動テスト
- **確認**:
  - [ ] `npm test` パス
  - [ ] `npm run build` パス
  - [ ] ドライラン実施（ワークフロー場合）
  - [ ] 統合テスト成功
  - [ ] 手動での動作確認

### Level 4: Full Testing + Environment Validation
- **対象**: 本番環境に直接影響する変更、セキュリティに関わる変更
- **実施内容**: すべてのテスト + 本番環境検証
- **確認**:
  - [ ] Level 3 のすべて
  - [ ] 本番環境でのドライラン
  - [ ] エラーケースの検証
  - [ ] パフォーマンス検証
  - [ ] セキュリティレビュー（該当する場合）

---

## 変更パス別テストレベルマトリクス

### Code Changes

| 変更パス | 説明 | テストレベル |
|---------|------|-------------|
| `src/**/*.js`, `src/**/*.ts` | メインコード | Level 2 |
| `tests/**` | テストコード | Level 2 |
| `lib/**` | ライブラリコード | Level 2 |

### Workflow Changes

| 変更パス | 説明 | テストレベル |
|---------|------|-------------|
| `.github/workflows/*.yml` | GitHub Actions | Level 3 |
| `.github/workflows/**.{yml,yaml}` | ワークフローファイル | Level 3 |

### Agent & Command Changes

| 変更パス | 説明 | テストレベル |
|---------|------|-------------|
| `.claude/agents/*.md` | Agent定義 | Level 2 |
| `.claude/commands/*.md` | コマンド定義 | Level 2 |

### Documentation Changes

| 変更パス | 説明 | テストレベル |
|---------|------|-------------|
| `README.md` | メインREADME | Level 1 |
| `.github/*.md` | GitHub関連ドキュメント | Level 1 |
| `docs/**/*.md` | ドキュメント | Level 1 |
| `*.md` | Markdownファイル全般 | Level 0-1 |

### Configuration Changes

| 変更パス | 説明 | テストレベル |
|---------|------|-------------|
| `package.json` | 依存関係、スクリプト | Level 3 |
| `.eslintrc*` | Lint設定 | Level 2 |
| `tsconfig.json` | TypeScript設定 | Level 2 |
| `.gitignore` | Git設定 | Level 0 |
| `*.config.js` | ツール設定 | Level 2 |

### CI/CD Configuration

| 変更パス | 説明 | テストレベル |
|---------|------|-------------|
| `.github/workflows/` | ワークフロー | Level 3-4 |
| `.github/actions/` | カスタムアクション | Level 3 |

---

## 複合変更の場合のテストレベル決定

複数の変更タイプが含まれる場合は、**最も高いレベルのテスト**を実施してください。

### 例

| 変更パターン | テストレベル | 理由 |
|------------|-----------|------|
| コード変更 + ドキュメント更新 | Level 2 | コード変更がLevel 2 |
| ワークフロー変更 + コード変更 | Level 3 | ワークフロー変更がLevel 3 |
| ドキュメント変更のみ | Level 1 | 最も低いレベル |
| `package.json` + コード変更 | Level 3 | `package.json`がLevel 3 |

---

## テストレベル別の実施手順

### Level 0: No Testing Required

```bash
# 不要
```

**例**: コメント修正のみ、.gitignore更新のみ

---

### Level 1: Manual Testing Only

```bash
# 1. Markdownフォーマット確認
# ローカルで表示確認（GitHub上で確認）

# 2. リンク確認
# 内部リンク、外部リンクが有効か確認
```

**例**: README更新、ドキュメント修正、簡単な設定変更

---

### Level 2: Unit Tests + Manual Testing

```bash
# 1. テストの実行
npm test

# 2. Lintチェック
npm run lint

# 3. 手動での動作確認
# Agentやツールの場合は実際に動作確認
```

**例**: 単一モジュール変更、Agent追加、簡単なコード修正

---

### Level 3: Unit + Integration Tests

```bash
# 1. テストの実行
npm test

# 2. ビルド確認
npm run build

# 3. Lintチェック
npm run lint

# 4. ドライランテスト（ワークフロー場合）
# 別ブランチで実際にワークフローを実行して確認

# 5. 統合テストの実行
npm run test:integration  # プロジェクトに存在する場合

# 6. 手動での動作確認
```

**例**: ワークフロー変更、複数モジュール変更、package.json依存関係変更

---

### Level 4: Full Testing + Environment Validation

```bash
# 1. Level 3 のすべてを実施

# 2. 本番環境でのドライラン
# 実際のリポジトリで実行して検証

# 3. エラーケース検証
# 異常系での動作確認

# 4. パフォーマンス検証
# 必要に応じてパフォーマンス計測

# 5. セキュリティレビュー
# セキュリティに影響する変更の場合は別途レビュー
```

**例**: 本番ワークフロー修正、セキュリティ関連の変更、システム全体に影響する変更

---

## CI/CD との連携

### 自動テスト（GitHub Actions）

| テストレベル | 自動実行項目 |
|----------|----------|
| Level 0 | なし |
| Level 1 | なし（手動確認） |
| Level 2 | `npm test`, `npm run lint` |
| Level 3 | `npm test`, `npm run lint`, `npm run build` |
| Level 4 | Level 3 + 本番環境ドライラン |

### マージ前チェック

| チェック項目 | 実行条件 |
|-----------|---------|
| PR形式チェック | すべてのPR |
| テストランナー実行 | Level 2-4 |
| リンク検証 | Level 1-4 |
| コミットメッセージ形式 | すべてのPR |

---

## 判定フローチャート

```
変更ファイルを確認
  │
  ├─ .gitignore, *.lock ファイル等？
  │  └─ Level 0
  │
  ├─ README.md, ドキュメント（*.md）のみ？
  │  └─ Level 1
  │
  ├─ .claude/ ファイル変更？
  │  ├─ コード変更なし？
  │  │  └─ Level 2
  │  └─ コード変更あり？
  │     └─ Level 3 以上に昇格
  │
  ├─ .github/workflows/ 変更？
  │  └─ Level 3
  │
  ├─ src/, lib/, tests/ 変更？
  │  ├─ 単一ファイル？
  │  │  └─ Level 2
  │  └─ 複数ファイル・複数モジュール？
  │     └─ Level 3
  │
  ├─ package.json, tsconfig.json 等設定変更？
  │  └─ Level 3
  │
  └─ その他
     └─ 複数タイプ → 最高レベルに昇格
```

---

## テストレベルと完了条件（DOD）の対応

| テストレベル | 対応する DOD | 確認項目 |
|----------|-----------|--------|
| Level 0 | Type 3: ドキュメント（簡易版） | Syntax確認 |
| Level 1 | Type 3: ドキュメント | リンク、フォーマット確認 |
| Level 2 | Type 2: Agent, Type 4: コード | ユニットテスト、Lint |
| Level 3 | Type 1: ワークフロー, Type 4: コード | 統合テスト、ドライラン |
| Level 4 | 本番環境影響大 | 本番検証、セキュリティレビュー |

---

## よくある質問

### Q: 小さなドキュメント修正はテストが必要？
**A**: 完全にテキスト修正のみでリンク変更がなければ Level 0 または Level 1。

### Q: ワークフロー修正はどのレベル？
**A**: すべてのワークフロー変更は Level 3 以上。本番環境に影響する場合は Level 4。

### Q: テストを追加するだけの場合は？
**A**: テストコード自体もコード変更なので Level 2。既存テストが通ること、新しいテストが意味のあるテストであることを確認。

### Q: 複数の変更が混在している場合は？
**A**: 最も高いテストレベルを適用してください。例：ドキュメント + ワークフロー変更 = Level 3。
