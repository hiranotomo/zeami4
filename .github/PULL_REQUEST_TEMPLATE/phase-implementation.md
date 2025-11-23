## 📚 フェーズ実装

**フェーズ番号**:
**フェーズ名**:
**関連Issue**: Closes #

---

## 🎯 このPRで実装した内容

### 追加したワークフロー
- [ ] `.github/workflows/stepX-xxx.yml`

### 追加したコード
- [ ] `src/xxx.ts`
- [ ] `src/xxx.spec.ts`

### 追加したドキュメント
- [ ] `docs/learning/phaseX/README.md`
- [ ] `docs/learning/phaseX/concepts.md`
- [ ] `docs/learning/phaseX/checklist.md`
- [ ] `docs/learning/phaseX/notes.md`（人間が記入）

---

## 🔍 動作確認方法

### テスト実行
```bash
npm test
```

### ワークフロー実行
```bash
# 手動実行の場合
# GitHub Actionsタブから「stepX-xxx」を選択してRun workflow

# 自動実行の場合
git push origin feature/phaseX
```

### 確認ポイント
- [ ] テストが全て通る
- [ ] ワークフローが正常に完了する
- [ ] ドキュメントに記載された概念が理解できる

---

## 📖 学習のポイント

### 人間が理解すべき概念

（このフェーズで学ぶべき重要な概念）

1.
2.
3.

### LLMが実装した部分の説明

（なぜこのように実装したか）

---

## ✅ レビュー観点

### 人間がチェックすべきこと

- [ ] ワークフローを実行して結果を確認した
- [ ] ログを読んで動作を理解した
- [ ] コードを読んで仕組みを理解した
- [ ] ドキュメントの概念説明を理解した
- [ ] `docs/learning/phaseX/notes.md`に学習メモを追記した
- [ ] 理解度チェックリストをクリアした

---

## 🔗 関連リンク

- [ラーニングロードマップ](../../docs/learning/ROADMAP.md)
- [ADR 001: ラーニングフロー設計](../../docs/meta/adr/001-learning-flow-design.md)

---

## 🤖 AI開発ガイドライン準拠チェック

- [ ] [AI-GUIDE.md](../../docs/AI-GUIDE.md) - 4つの絶対ルールに従っている
  - [ ] Issue First - Issue作成後に実装した
  - [ ] Pre-Completion Check - `npm run pre-check` を実行した
  - [ ] Branch Naming - `{type}/{issue-number}-{description}` 形式
  - [ ] Commit Message - `{type}: #{issue-number} {description}` 形式
- [ ] [CODE_BOUNDARIES.md](../../docs/CODE_BOUNDARIES.md) - 編集範囲を守っている
  - [ ] 編集可能範囲内での変更
  - [ ] 注意が必要な範囲は慎重に編集
  - [ ] 編集禁止領域には触れていない
- [ ] [TEST_SPEC.md](../../docs/TEST_SPEC.md) - テスト仕様に従っている
  - [ ] テストを追加/更新した
  - [ ] カバレッジ要件を満たしている

Claude Codeを使用している場合: `/check-guidelines` コマンドで確認できます。

---

## 📝 学習メモ（人間が記入）

（このPRをレビューして学んだこと、気づいたことを記録）

### 理解したこと


### つまずいたポイント


### 次に試したいこと

