## 📋 変更内容

**関連Issue**: Closes #

### 変更の種類
- [ ] 🐛 バグ修正
- [ ] ✨ 新機能
- [ ] 📝 ドキュメント
- [ ] ♻️ リファクタリング
- [ ] 🎨 UI/UX改善
- [ ] ⚡ パフォーマンス改善
- [ ] 🔧 設定変更

---

## 🎯 変更の目的

（なぜこの変更が必要か）

---

## 📝 変更の詳細

（何を変更したか）

---

## ✅ Test Plan (Required - All items must be completed)

### Automated Tests
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] CI (GitHub Actions) passes

### Manual Testing
- [ ] Tested the feature/fix manually
- [ ] Verified expected behavior
- [ ] Tested error cases (if applicable)

**Test Results** (Required - Describe what you tested):
```
Examples:
- Created test issue #123 with 'auto-run' label
- Verified workflow triggered successfully
- Confirmed comment added to issue
- Tested with invalid input, verified proper error handling
```

### N/A Options (Check only if applicable)
- [ ] Documentation-only change (no code changes)
- [ ] Typo fix / Minor text correction
- [ ] Configuration change only (no logic changes)

---

## ✅ Definition of Done (DOD) Checklist

変更タイプに該当するDODを確認して、すべての項目にチェックを入れてください。

詳細は [DOD Templates](.github/DOD_TEMPLATES.md) 及び [Test Level Matrix](.github/TEST_LEVEL_MATRIX.md) を参照してください。

### 変更タイプの判定

- [ ] **Type 1: ワークフロー追加/変更** (`.github/workflows/**`)
- [ ] **Type 2: Agent追加/変更** (`.claude/agents/**` or `.claude/commands/**`)
- [ ] **Type 3: ドキュメント** (`README.md`, `.github/*.md`, etc.)
- [ ] **Type 4: コード変更** (`src/**`, `lib/**`, `tests/**`)

### 該当するDODチェックリスト

**変更に該当するType下のチェックリストを使用してください:**

#### Type 1: ワークフロー追加/変更（該当する場合）
- [ ] ドライランテスト成功
- [ ] 実環境での動作確認
- [ ] エラーケースの検証
- [ ] ログ出力の確認

#### Type 2: Agent追加/変更（該当する場合）
- [ ] Agent定義の構文確認
- [ ] 使用ツールの権限確認
- [ ] サンプルタスクでの動作確認
- [ ] トークン使用量の測定

#### Type 3: ドキュメント（該当する場合）
- [ ] リンク切れチェック
- [ ] フォーマット検証
- [ ] スペル・文法チェック

#### Type 4: コード変更（該当する場合）
- [ ] ユニットテスト追加/更新
- [ ] 既存テストのパス
- [ ] リント/フォーマット確認
- [ ] （該当する場合）統合テスト

### テストレベル

**このPRのテストレベル**: Level ___ （0-4を [Test Level Matrix](.github/TEST_LEVEL_MATRIX.md) から選択）

---

## 🤖 AI開発ガイドライン準拠チェック

- [ ] [AI開発者向けガイド (Wiki)](https://github.com/hiranotomo/zeami4/wiki/AI開発者向けガイド) - 4つの絶対ルールに従っている
  - [ ] Issue First - Issue作成後に実装した
  - [ ] Pre-Completion Check - `npm run pre-check` を実行した
  - [ ] Branch Naming - `{type}/{issue-number}-{description}` 形式
  - [ ] Commit Message - `{type}: #{issue-number} {description}` 形式
- [ ] [コード編集範囲ガイド (Wiki)](https://github.com/hiranotomo/zeami4/wiki/コード編集範囲ガイド) - 編集範囲を守っている
  - [ ] 編集可能範囲内での変更
  - [ ] 注意が必要な範囲は慎重に編集
  - [ ] 編集禁止領域には触れていない
- [ ] [テスト仕様ガイド (Wiki)](https://github.com/hiranotomo/zeami4/wiki/テスト仕様ガイド) - テスト仕様に従っている
  - [ ] テストを追加/更新した
  - [ ] カバレッジ要件を満たしている

Claude Codeを使用している場合: `/check-guidelines` コマンドで確認できます。

---

## 🔗 参考リンク

（参考にした資料やドキュメントがあれば）
