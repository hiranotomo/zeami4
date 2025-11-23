#!/usr/bin/env node

/**
 * Work Unit 開始スクリプト
 *
 * Usage:
 *   node scripts/work-unit-start.js <issue-number> <worker-type> [branch-type]
 *
 * Examples:
 *   node scripts/work-unit-start.js 183 main feature
 *   node scripts/work-unit-start.js 200 explore feature
 *   node scripts/work-unit-start.js 185 runner fix
 */

const { Octokit } = require('@octokit/rest');
const { retry } = require('@octokit/plugin-retry');
const { throttling } = require('@octokit/plugin-throttling');
const { execSync } = require('child_process');

// Octokitにプラグインを追加
const MyOctokit = Octokit.plugin(retry, throttling);

async function startWorkUnit(issueNumber, workerType, branchType = 'feature') {
  const timestamp = Math.floor(Date.now() / 1000);
  const workUnitId = `${issueNumber}-${workerType}-${timestamp}`;
  const branchName = `${branchType}/${workUnitId}`;

  console.log('🔨 Starting Work Unit...\n');
  console.log(`Work Unit ID: ${workUnitId}`);
  console.log(`Branch: ${branchName}`);
  console.log(`Type: ${branchType}`);
  console.log(`Worker: ${workerType}`);
  console.log(`Issue: #${issueNumber}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // GitHub token確認
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('⚠️  GITHUB_TOKEN not found. Skipping GitHub comment.');
    console.log('\nTo enable GitHub integration:');
    console.log('  export GITHUB_TOKEN=your_token\n');
  } else {
    try {
      // Issueにコメント投稿
      const octokit = new MyOctokit({
        auth: token,
        throttle: {
          onRateLimit: (retryAfter, options, octokit, retryCount) => {
            console.warn(`⚠️  Rate limit reached. Retrying after ${retryAfter} seconds... (attempt ${retryCount + 1}/3)`);

            // 最大3回までリトライ
            if (retryCount < 3) {
              return true;
            }

            console.error('❌ Rate limit exceeded. Max retries reached.');
            return false;
          },
          onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
            console.warn(`⚠️  Secondary rate limit. Retrying after ${retryAfter} seconds... (attempt ${retryCount + 1}/3)`);

            if (retryCount < 3) {
              return true;
            }

            return false;
          }
        },
        retry: {
          doNotRetry: [400, 401, 404, 422], // これらのステータスコードは再試行しない
        }
      });

      await octokit.rest.issues.createComment({
        owner: 'hiranotomo',
        repo: 'giflearn',
        issue_number: issueNumber,
        body: `🔨 **Work Unit Started**

- **ID**: \`${workUnitId}\`
- **Branch**: \`${branchName}\`
- **Type**: ${branchType}
- **Worker Type**: ${workerType}
- **Started**: ${new Date().toISOString()}

Work Unit開始。進捗は随時更新されます。`
      });

      console.log(`✅ Comment posted to Issue #${issueNumber}`);
    } catch (error) {
      console.error(`⚠️  Failed to post comment: ${error.message}`);
    }
  }

  // ブランチ作成
  try {
    console.log(`\nCreating branch: ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    console.log(`\n✅ Work Unit ready!`);
    console.log(`\nNext steps:`);
    console.log(`  1. Make your changes`);
    console.log(`  2. Commit: git commit -m "type: #${issueNumber} description"`);
    console.log(`  3. Push: git push -u origin ${branchName}`);
    console.log(`  4. Create PR: gh pr create --title "type: #${issueNumber} title" --body "Closes #${issueNumber}"`);
  } catch (error) {
    console.error(`\n❌ Failed to create branch: ${error.message}`);
    process.exit(1);
  }
}

// コマンドライン引数処理
const [issueNumber, workerType, branchType] = process.argv.slice(2);

if (!issueNumber || !workerType) {
  console.error('Usage: node scripts/work-unit-start.js <issue-number> <worker-type> [branch-type]');
  console.error('\nExamples:');
  console.error('  node scripts/work-unit-start.js 183 main feature');
  console.error('  node scripts/work-unit-start.js 200 explore feature');
  console.error('  node scripts/work-unit-start.js 185 runner fix');
  console.error('\nWorker types: main, explore, test-impl, workflow, runner');
  console.error('Branch types: feature, hotfix, docs, test, fix');
  process.exit(1);
}

startWorkUnit(issueNumber, workerType, branchType).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
