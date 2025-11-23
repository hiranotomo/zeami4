#!/usr/bin/env node

/**
 * ブランチ名自動生成スクリプト
 *
 * Usage: npm run branch
 *
 * 機能:
 * - Issue番号の存在確認
 * - ブランチ名の自動サニタイズ(大文字→小文字、不正文字除去)
 * - フォーマット検証
 * - 自動ブランチ作成・切り替え
 */

import readline from 'readline';
import { execSync } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const VALID_TYPES = ['feature', 'fix', 'docs', 'hotfix', 'test'];

/**
 * Issue番号の存在を確認
 */
function checkIssueExists(issueNumber) {
  try {
    execSync(`gh issue view ${issueNumber}`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 説明をサニタイズ
 * - 大文字 → 小文字
 * - スペース/アンダースコア → ハイフン
 * - 不正文字を除去
 */
function sanitizeDescription(description) {
  return description
    .toLowerCase()
    .replace(/\s+/g, '-')           // スペース → ハイフン
    .replace(/_+/g, '-')            // アンダースコア → ハイフン
    .replace(/[^a-z0-9-]/g, '')     // 英小文字・数字・ハイフン以外を除去
    .replace(/-+/g, '-')            // 連続ハイフンを1つに
    .replace(/^-|-$/g, '');         // 先頭・末尾のハイフンを除去
}

/**
 * ブランチ名を検証
 */
function validateBranchName(branchName) {
  const pattern = /^(feature|fix|docs|hotfix|test)\/[0-9]+-[a-z0-9-]+$/;
  return pattern.test(branchName);
}

/**
 * 現在のブランチ名を取得
 */
function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * ブランチが存在するかチェック
 */
function branchExists(branchName) {
  try {
    const branches = execSync('git branch', { encoding: 'utf-8' });
    return branches.split('\n').some(b => b.trim().replace('* ', '') === branchName);
  } catch (error) {
    return false;
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🌿 ブランチ名自動生成ツール\n');

  // 現在のブランチ確認
  const currentBranch = getCurrentBranch();
  if (currentBranch === 'main' || currentBranch === 'master') {
    console.log(`✅ 現在のブランチ: ${currentBranch}\n`);
  } else {
    console.log(`⚠️  現在のブランチ: ${currentBranch}`);
    console.log(`   mainブランチから作成することを推奨します\n`);
    const proceed = await question('続行しますか？ (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('キャンセルしました');
      rl.close();
      process.exit(0);
    }
    console.log('');
  }

  // Issue番号入力
  let issueNumber;
  while (true) {
    issueNumber = await question('Issue番号を入力: #');

    if (!/^\d+$/.test(issueNumber)) {
      console.log('❌ Issue番号は数字のみで入力してください\n');
      continue;
    }

    // Issue存在確認
    console.log(`🔍 Issue #${issueNumber}を確認中...`);
    if (checkIssueExists(issueNumber)) {
      console.log(`✅ Issue #${issueNumber}が存在します\n`);
      break;
    } else {
      console.log(`❌ Issue #${issueNumber}が見つかりません`);
      const create = await question('Issueを作成しますか？ (y/N): ');
      if (create.toLowerCase() === 'y') {
        console.log('\nIssueを作成してください:');
        console.log(`  gh issue create --title "Your task description"`);
        rl.close();
        process.exit(0);
      }
      console.log('');
    }
  }

  // タイプ選択
  let type;
  while (true) {
    console.log('ブランチタイプを選択:');
    console.log('  1) feature  - 新機能');
    console.log('  2) fix      - バグ修正');
    console.log('  3) docs     - ドキュメント');
    console.log('  4) hotfix   - 緊急修正');
    console.log('  5) test     - テスト');

    const typeInput = await question('\n番号またはタイプ名を入力: ');

    const typeMap = {
      '1': 'feature',
      '2': 'fix',
      '3': 'docs',
      '4': 'hotfix',
      '5': 'test'
    };

    type = typeMap[typeInput] || typeInput;

    if (VALID_TYPES.includes(type)) {
      console.log(`✅ タイプ: ${type}\n`);
      break;
    } else {
      console.log(`❌ 無効なタイプです: ${typeInput}\n`);
    }
  }

  // 説明入力
  let description;
  let sanitized;
  while (true) {
    description = await question('説明を入力 (英語推奨、自動で小文字・ハイフン化): ');

    if (!description.trim()) {
      console.log('❌ 説明を入力してください\n');
      continue;
    }

    sanitized = sanitizeDescription(description);

    if (!sanitized) {
      console.log('❌ 有効な説明を入力してください\n');
      continue;
    }

    console.log(`📝 サニタイズ後: ${sanitized}\n`);
    break;
  }

  // ブランチ名生成
  const branchName = `${type}/${issueNumber}-${sanitized}`;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 ブランチ名プレビュー:');
  console.log(`   ${branchName}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 検証
  if (!validateBranchName(branchName)) {
    console.log('❌ エラー: ブランチ名の検証に失敗しました');
    console.log(`   ブランチ名: ${branchName}`);
    rl.close();
    process.exit(1);
  }

  console.log('✅ フォーマット検証: 合格\n');

  // ブランチ存在チェック
  if (branchExists(branchName)) {
    console.log(`⚠️  ブランチ ${branchName} は既に存在します`);
    const switchTo = await question('このブランチに切り替えますか？ (y/N): ');
    if (switchTo.toLowerCase() === 'y') {
      try {
        execSync(`git checkout ${branchName}`, { stdio: 'inherit' });
        console.log(`\n✅ ブランチ ${branchName} に切り替えました`);
        rl.close();
        process.exit(0);
      } catch (error) {
        console.log(`\n❌ ブランチ切り替えに失敗しました`);
        rl.close();
        process.exit(1);
      }
    } else {
      console.log('キャンセルしました');
      rl.close();
      process.exit(0);
    }
  }

  // 確認
  const confirm = await question('このブランチを作成しますか？ (Y/n): ');
  if (confirm.toLowerCase() === 'n') {
    console.log('キャンセルしました');
    rl.close();
    process.exit(0);
  }

  // ブランチ作成
  try {
    console.log(`\n🌿 ブランチを作成中...`);
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    console.log(`\n✅ ブランチ ${branchName} を作成しました！`);
    console.log(`\n次のステップ:`);
    console.log(`  1. コードを変更`);
    console.log(`  2. git add .`);
    console.log(`  3. git commit -m "${type}: #${issueNumber} Your commit message"`);
    console.log(`  4. git push -u origin ${branchName}`);
    console.log(`  5. gh pr create\n`);
  } catch (error) {
    console.log(`\n❌ ブランチ作成に失敗しました`);
    console.log(error.message);
    rl.close();
    process.exit(1);
  }

  rl.close();
}

// エラーハンドリング
process.on('SIGINT', () => {
  console.log('\n\nキャンセルしました');
  rl.close();
  process.exit(0);
});

main().catch((error) => {
  console.error('エラーが発生しました:', error);
  rl.close();
  process.exit(1);
});
