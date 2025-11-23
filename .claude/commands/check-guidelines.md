---
description: AI開発ガイドラインを確認し、現在の作業が適合しているかチェックする
---

# AI開発ガイドライン確認

このコマンドは、Issue #360 に記載されたガイドライン概要と、Wikiの詳細ドキュメントを参照します。

## 必読ドキュメント（Wiki）

1. **[AI開発者向けガイド](https://github.com/hiranotomo/zeami4/wiki/AI開発者向けガイド)** - 4つの絶対ルール、標準ワークフロー
2. **[コード編集範囲ガイド](https://github.com/hiranotomo/zeami4/wiki/コード編集範囲ガイド)** - 編集可能範囲の定義
3. **[テスト仕様ガイド](https://github.com/hiranotomo/zeami4/wiki/テスト仕様ガイド)** - テスト仕様ガイド

## 実行手順

1. `gh issue view 360 --json body --jq .body` でガイドライン概要を取得
2. 取得した内容を表示（WikiへのリンクがIssue内に記載されています）
3. Wikiドキュメントを確認
4. 現在の作業がガイドラインに適合しているか確認

## 4つの絶対ルール（クイックリファレンス）

1. **Issue First** - Issue作成後に実装
2. **Pre-Check** - `npm run pre-check` を実行
3. **Branch Naming** - `{type}/{issue-number}-{description}`
4. **Commit Message** - `{type}: #{issue-number} {description}`

---

**注**: ガイドラインの概要は Issue #360、詳細は [Wiki](https://github.com/hiranotomo/zeami4/wiki) で管理されています。
