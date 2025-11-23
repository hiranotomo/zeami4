# ブランチ戦略ガイド

## 概要

このドキュメントは、LLMエージェント（Claude Code）が効率的に作業できるブランチ戦略を定義します。

## 基本原則

### 1. **Zero-Decision Branching**
ブランチ名はIssue番号から機械的に決定される。LLMが命名を考える必要はない。

### 2. **Automatic Integration**
複数の成果物は自動的に1つのブランチに統合される。

### 3. **Predictable Naming**
ブランチ名のパターンは一貫しており、予測可能。

## ブランチ命名規則

### 単一Issue対応

```
<type>/<issue-number>-<slug>
```

**Components**:
- `<type>`: feat, fix, docs, style, refactor, test, chore
- `<issue-number>`: GitHub Issue番号
- `<slug>`: Issue titleの最初の3単語（kebab-case）

**Examples**:
```bash
feat/424-wiki-update-agent
fix/430-pipeline-improvements
docs/415-permissions-matrix
test/420-auto-run-functionality
```

### 複数Issue統合

```
multi/<primary-issue>-<secondary-issues>
```

**Example**:
```bash
multi/430-413-415  # #430がメイン、#413と#415も含む
```

**使用ケース**: 並列サブエージェント実行時の統合ブランチ

## ブランチ作成フロー

### パターン1: 手動作成

```bash
# Issue番号とタイトルを確認
gh issue view 424

# ブランチ作成
git checkout main
git pull
git checkout -b feat/424-wiki-update-agent
git push -u origin feat/424-wiki-update-agent
```

### パターン2: スクリプトで自動作成（将来機能）

```bash
./scripts/create-branch.sh 424
# → feat/424-wiki-update-agent が自動作成される
```

## コミットメッセージ

### 自動Issue番号注入

`.githooks/commit-msg` が自動的にIssue番号を注入します：

**Before** (あなたが書く):
```bash
git commit -m "feat: Add Wiki update agent"
```

**After** (自動注入後):
```bash
feat: #424 Add Wiki update agent
```

**仕組み**: ブランチ名 `feat/424-wiki-update-agent` から `424` を抽出

### 手動でIssue番号を指定する場合

```bash
git commit -m "feat: #424 Add Wiki update agent"
# → 自動注入はスキップされ、そのまま使用される
```

## PR作成

### 自動PR作成スクリプト

```bash
./scripts/create-pr.sh
```

**自動で行われること**:
- Issue番号の抽出
- Issue情報の取得
- コミット履歴からChangesセクション生成
- ファイル変更統計の追加
- Test Levelの自動推測
- PR作成（titleとbodyを自動設定）

**Dry-run**:
```bash
./scripts/create-pr.sh --dry-run
# → 実際にPRを作らず、内容をプレビュー
```

## サブエージェント並列実行

### 推奨パターン: 親エージェントが統合ブランチを管理

```javascript
// 1. 統合ブランチ作成
const primaryIssue = 430;
const relatedIssues = [413, 415, 422];
const branchName = `multi/${primaryIssue}-${relatedIssues.join('-')}`;

await bash(`git checkout main && git pull`);
await bash(`git checkout -b ${branchName}`);
await bash(`git push -u origin ${branchName}`);

// 2. サブエージェント起動（並列）
const tasks = relatedIssues.map(issue =>
  task({
    prompt: `
      Issue #${issue}を実装してください。

      **重要**: すべての変更を \`${branchName}\` にコミットしてください。

      作業開始前に必ず実行:
      \`\`\`bash
      git checkout ${branchName}
      git pull
      \`\`\`
    `,
    model: 'haiku'  // コスト最適化
  })
);

await Promise.all(tasks);

// 3. 統合確認
await bash(`git log ${branchName} --oneline -10`);
```

## ベストプラクティス

### ✅ DO

- Issue番号を含むブランチ名を使う
- `<type>/<issue>-<slug>` パターンに従う
- 並列実行時は `multi/` ブランチを使う
- PR作成前にスクリプトでdry-run

### ❌ DON'T

- ブランチ名にIssue番号を含めない（自動注入が効かない）
- `feature-branch` のような曖昧な名前
- 複数の無関係なIssueを1ブランチに混在
- PR作成時に手動でbodyを書く（スクリプトを使う）

## トラブルシューティング

### Q: コミット時に「Issue番号が必要」エラーが出る

**A**: ブランチ名にIssue番号が含まれているか確認してください。

```bash
# 現在のブランチ名確認
git branch --show-current

# 正しい例: feat/424-wiki-update-agent
# 間違い例: feature-branch
```

### Q: 自動注入が効かない

**A**: `.githooks/commit-msg` がインストールされているか確認：

```bash
# Git hooksの設定確認
git config core.hooksPath

# 期待される出力: .githooks

# 設定されていない場合
git config core.hooksPath .githooks
```

### Q: サブエージェントが異なるブランチにコミットした

**A**: promptで明示的にブランチ名を指定してください：

```javascript
prompt: `
  Issue #${issue}を実装してください。

  **ブランチ指示**: ${branchName}
  作業開始前に: git checkout ${branchName} && git pull
`
```

## 関連ドキュメント

- `.github/DOD_TEMPLATES.md` - Definition of Done
- `.github/TEST_LEVEL_MATRIX.md` - テストレベルマトリクス
- `.claude/config/subagent-best-practices.md` - サブエージェント活用ガイド
- `scripts/create-pr.sh` - PR自動作成スクリプト

## 更新履歴

- 2025-11-23: 初版作成（#430関連）
