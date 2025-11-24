# STREAM A Orchestrator - Usage Guide

## Overview

STREAM Aオーケストレーターは、PRの作成・更新時に自動的に実行され、すべてのSTREAM A検証を統合的に実行します。

## How It Works

### Automatic Execution

オーケストレーターは以下のイベントで自動的にトリガーされます:

```yaml
on:
  pull_request:
    types: [opened, synchronize, edited, reopened]
```

### Execution Flow

```
PR Event
  ↓
1. Initialize Context (コンテキスト初期化)
  ├─ PR情報取得
  ├─ Issue番号抽出
  └─ JSONコンテキスト作成
  ↓
2. Validate Branch Name (ブランチ名検証)
  ├─ パターンチェック: {type}/{issue}-{desc}
  └─ 結果をコンテキストに保存
  ↓
3. Validate Commit Messages (コミットメッセージ検証)
  ├─ Issue参照チェック: #123
  └─ 結果をコンテキストに保存
  ↓
4. Validate PR Files (PRファイル検証)
  ├─ テストファイル有無確認
  └─ 結果をコンテキストに保存
  ↓
5. Validate Issue DoD (DoD検証)
  ├─ Issueチェックボックスカウント
  └─ 結果をコンテキストに保存
  ↓
6. Check Merge Conflicts (コンフリクト検出)
  ├─ Mergeability確認
  └─ 結果をコンテキストに保存
  ↓
7. Finalize Context (コンテキスト確定)
  ├─ 最終ステータス計算
  └─ 実行時間記録
  ↓
8. Post Summary Comment (サマリー投稿)
  ├─ PRにコメント投稿
  └─ ワークフローステータス設定
```

## Understanding the Report

### Sample Report

```markdown
## 🎯 STREAM A Orchestrator Report

**Status**: ⚠️ WARNING
**Can Merge**: ✅ Yes

### 📊 Validation Results

Total: 5 | Passed: 4 | Failed: 0 | Warnings: 1

- ✅ **branch_name**: Branch name follows convention
- ✅ **commit_message**: All 1 commits have issue references
- ✅ **pr_files**: Test files present
- ⚠️ **dod_checklist**: 15 DoD items unchecked
- ✅ **conflicts**: No merge conflicts

---
🤖 Orchestrated by STREAM A v1.0.0
⏱️ Execution time: 2051ms
```

### Status Icons

| Icon | Status | Meaning | Blocking? |
|------|--------|---------|-----------|
| ✅ | `pass` | 検証成功 | No |
| ❌ | `fail` | 検証失敗 | Yes |
| ⚠️ | `warning` | 警告あり | No |
| ⏳ | `pending` | 検証中 | No |
| ⏭️ | `skipped` | スキップ | No |

### Can Merge?

- **✅ Yes**: マージ可能（Failedがない）
- **❌ No**: マージ不可（Failedあり）

警告（Warning）があってもマージは可能ですが、推奨されません。

## Validation Details

### 1. Branch Name Validation

**Pattern**: `{type}/{issue}-{description}`

**Valid types**:
- `feature` - 新機能
- `hotfix` - 緊急修正
- `docs` - ドキュメント
- `test` - テスト追加
- `fix` - バグ修正

**Examples**:
```
✅ feature/20-orchestrator
✅ hotfix/123-fix-crash
✅ docs/45-update-readme
❌ add-feature (type missing)
❌ feature-20 (format incorrect)
```

### 2. Commit Message Validation

**Requirement**: 全コミットにIssue参照 `#123` が必要

**Valid formats**:
```
✅ feat: Add orchestrator (#20)
✅ fix: #123 Fix validation error
✅ docs: Update README #45
❌ Add orchestrator (no issue reference)
```

**Skipped commits**:
- Merge commits (`Merge pull request...`)
- Conflict resolution commits (`Resolve merge conflict...`)

### 3. PR Files Validation

**Check**: ソースコード変更時にテストファイルの変更があるか

**Status**:
- ✅ Pass: テストファイルあり or ソース変更なし
- ⚠️ Warning: ソース変更あり、テストなし

**Exception cases** (Test not required):
- ドキュメントのみの変更
- 型定義のみの変更
- 設定ファイルのみの変更

### 4. Issue DoD Validation

**Check**: リンクされたIssueのDoDチェックボックス完了状況

**Status**:
- ✅ Pass: 全チェックボックスチェック済み
- ⚠️ Warning: 未完了のチェックボックスあり
- ⏭️ Skipped: Issueにチェックボックスなし

**Action**:
```bash
gh issue edit <issue-number>
```

### 5. Merge Conflict Detection

**Check**: ベースブランチとのコンフリクト有無

**Status**:
- ✅ Pass: コンフリクトなし
- ❌ Fail: コンフリクトあり

**Resolution**:
```bash
git checkout <branch>
git fetch origin main
git merge origin/main
# Resolve conflicts
git add .
git commit -m "fix: Resolve merge conflict"
git push
```

## Context File

### Location

```
/tmp/stream-a-context-<PR_NUMBER>.json
```

### Structure

See [ORCHESTRATOR_DESIGN.md](./ORCHESTRATOR_DESIGN.md#shared-context-schema) for full schema.

**Key sections**:
- `pr`: PR情報
- `validations`: 各検証の結果
- `auto_fixes_applied`: 適用された自動修正
- `summary`: サマリー情報
- `metadata`: メタデータ

## Auto-Fix (Phase 1 Limitation)

### Current Status

Phase 1では自動修正は **プレースホルダー実装** です。

**What it does**:
- 自動修正が可能かどうかを判定
- 修正方法をログに記録
- コンテキストに記録

**What it does NOT do**:
- 実際にコミットを修正
- ブランチを作り直し
- Issueを更新

### Phase 2 (Planned)

Phase 2で以下の自動修正を実装予定:

1. **Commit Message Auto-Fix**
   ```bash
   # Before: "Add orchestrator"
   # After: "feat: Add orchestrator (#20)"
   ```

2. **Branch Name Normalization**
   ```bash
   # Before: "add-orchestrator"
   # After: "feature/20-add-orchestrator"
   ```

3. **DoD Checkbox Updates** (Phase 2+)
   ```bash
   # Automatically check completed DoD items via GitHub API
   ```

## Troubleshooting

### Orchestrator Failed

**Symptom**: ワークフローが失敗

**Check**:
1. Blocking issues in summary
2. Error messages in workflow logs
3. Context file content

**Common causes**:
- ブランチ名が不正
- コミットメッセージにIssue参照なし
- マージコンフリクト

### No Summary Comment

**Symptom**: サマリーコメントが投稿されない

**Possible reasons**:
- ワークフローがクラッシュ
- GitHub API権限不足
- Rate limit exceeded

**Check**: Actions タブでワークフローログを確認

### Context File Not Found

**Symptom**: コンテキストファイルが見つからない

**Reason**: `/tmp` ディレクトリはワークフロー実行ごとに初期化

**Solution**: コンテキストはステップ間でのみ共有される

## Integration with Existing Workflows

### Phase 1 (Current)

オーケストレーターは既存ワークフローと **並行実行** します:

```
PR Event
  ├─ STREAM A Orchestrator (New)
  ├─ validate-branch-name (Existing)
  ├─ validate-commit-message (Existing)
  ├─ validate-pr-files (Existing)
  ├─ conflict-detector (Existing)
  └─ ... (Other workflows)
```

**Benefit**: 段階的な移行が可能

### Phase 2 (Planned)

個別ワークフローを段階的に無効化:

```
PR Event
  └─ STREAM A Orchestrator (Only)
      ├─ Branch Validation
      ├─ Commit Validation
      ├─ File Validation
      ├─ DoD Validation
      └─ Conflict Detection
```

**Benefit**: 統合されたコンテキストと自動修正

## Advanced Usage

### Customizing Behavior

現在の実装では環境変数で動作をカスタマイズできます:

```yaml
env:
  AUTO_FIX_ENABLED: true  # Auto-fix有効化 (Phase 1: placeholder only)
  ORCHESTRATOR_VERSION: "1.0.0"  # バージョン
```

### Future: Command-Line Interface

Phase 2では以下のコマンドインターフェースを提供予定:

```bash
# Full orchestration with auto-fix
@claude --workflow=stream-a --pr=123

# Validation only (no auto-fix)
@claude --workflow=stream-a --pr=123 --mode=validate

# Auto-fix only
@claude --workflow=stream-a --pr=123 --mode=auto-fix

# Hard block mode
@claude --workflow=stream-a --pr=123 --hard-block=true
```

## Performance

### Execution Time

**Typical**: 2-3 seconds
**Parallel validations**: Most checks run concurrently
**Bottlenecks**: GitHub API calls

### Resource Usage

- **CPU**: Minimal (JavaScript execution only)
- **Memory**: <100MB
- **Network**: ~10 API calls per execution

## Security

### Permissions

```yaml
permissions:
  contents: write      # For auto-fix commits (Phase 2)
  pull-requests: write # For comments
  issues: write        # For DoD updates (Phase 2)
  checks: write        # For status updates
```

### Safe Operations

- Force pushes use `--force-with-lease`
- Commit authorship verified before amending
- All auto-fixes logged in context
- Audit trail in workflow logs

## Best Practices

### For PR Authors

1. **Use correct branch naming** from the start
2. **Include issue references** in commit messages
3. **Add tests** when changing source code
4. **Update DoD checkboxes** as you complete tasks
5. **Resolve conflicts** quickly

### For Reviewers

1. **Check orchestrator report** before reviewing
2. **Verify DoD completion** before approving
3. **Look for warnings** even if checks pass
4. **Use context file** for detailed investigation

## FAQ

### Q: オーケストレーターと既存ワークフローの違いは？

A: オーケストレーターは全検証を統合し、共有コンテキストと自動修正を提供します。既存ワークフローは独立して動作します。

### Q: 自動修正は本当に動きますか？

A: Phase 1ではプレースホルダー実装です。Phase 2で実際の自動修正を実装予定です。

### Q: Warningでもマージできますか？

A: はい。Warningは推奨事項ですが、マージをブロックしません。

### Q: Hard Blockモードとは？

A: Phase 2で実装予定の機能で、特定の検証失敗時にマージを強制的にブロックします。

### Q: 他のSTREAMとの統合は？

A: STREAM B/Cとの統合はPhase 3で計画されています。

## Related Documentation

- [ORCHESTRATOR_DESIGN.md](./ORCHESTRATOR_DESIGN.md) - アーキテクチャ詳細
- [Workflow Architecture Wiki](/tmp/workflow-architecture-wiki.md) - STREAM A全体設計
- [DOD_TEMPLATES.md](/.github/DOD_TEMPLATES.md) - DoD テンプレート
- [TEST_LEVEL_MATRIX.md](/.github/TEST_LEVEL_MATRIX.md) - テストレベル判定

## Support

Issue や質問は以下で受け付けます:
- GitHub Issues: https://github.com/hiranotomo/zeami4/issues
- PR #21: Initial implementation
- Issue #20: Orchestrator tracking issue

---

**Version**: 1.0.0
**Last Updated**: 2025-11-24
**Status**: Production Ready (Phase 1)
