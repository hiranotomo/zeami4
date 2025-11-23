#!/usr/bin/env node

/**
 * 汎用ワークフローテストランナー
 *
 * GitHub Actionsワークフローをテストするための基盤
 * 将来的に他のテストタイプ（unit, e2e）も統合可能
 */

const { Octokit } = require('@octokit/rest');
const { retry } = require('@octokit/plugin-retry');
const { throttling } = require('@octokit/plugin-throttling');
const fs = require('fs');
const path = require('path');

// Octokitにプラグインを追加
const MyOctokit = Octokit.plugin(retry, throttling);

// 設定
// TEST_REPO環境変数でテスト実行先を指定可能（デフォルト: giflearn-test）
const TEST_REPO = process.env.TEST_REPO || 'hiranotomo/giflearn-test';
const [owner, repo] = TEST_REPO.split('/');

const CONFIG = {
  owner,
  repo,
  testIssuePrefix: '[TEST]',
  cleanupAfterTests: true
};

class WorkflowTestRunner {
  constructor(octokit, config) {
    this.octokit = octokit;
    this.config = config;
    this.tests = [];
    this.testIssues = []; // クリーンアップ用
    this.testPRs = []; // クリーンアップ用
    this.testMilestones = []; // クリーンアップ用
  }

  /**
   * テストケースを追加
   */
  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * APIエラーを分類して適切なメッセージを返す
   * @param {Error} error - APIエラー
   * @param {string} context - エラーが発生した処理のコンテキスト
   */
  handleApiError(error, context) {
    const status = error.status;
    const message = error.message;

    console.error(`\n❌ API Error in ${context}:`);
    console.error(`   Status: ${status}`);
    console.error(`   Message: ${message}`);

    // エラー分類
    if (status === 403) {
      if (message.includes('rate limit')) {
        throw new Error(
          '❌ API Rate Limit exceeded.\n' +
          '   - Wait 1 hour for reset\n' +
          '   - Or use a different token\n' +
          '   - Or implement request throttling'
        );
      }
      if (message.includes('Resource not accessible')) {
        throw new Error(
          '❌ Token lacks required permissions.\n' +
          '   Required scopes: repo, workflow\n' +
          '   Check your GITHUB_TOKEN permissions'
        );
      }
      throw new Error(`❌ Forbidden: ${message}`);
    }

    if (status === 422) {
      throw new Error(
        `❌ Validation failed: ${message}\n` +
        '   Check input data (branch name, commit message, etc.)'
      );
    }

    if (status === 429) {
      throw new Error(
        '❌ Too Many Requests (Rate Limit)\n' +
        '   This should be handled by throttling plugin.\n' +
        '   If you see this, the plugin may not be configured correctly.'
      );
    }

    if (status >= 500) {
      console.warn(`⚠️  GitHub server error (${status}). Will retry via auto-retry workflow...`);
      throw error;
    }

    throw error;
  }

  /**
   * テスト用Issueを作成
   */
  async createTestIssue(title, body) {
    try {
      const { data: issue } = await this.octokit.rest.issues.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: `${this.config.testIssuePrefix} ${title}`,
        body: body || 'This is a test issue created by automated tests.',
        labels: ['test-automation']
      });

      this.testIssues.push(issue.number);
      return issue;
    } catch (error) {
      this.handleApiError(error, 'createTestIssue');
    }
  }

  /**
   * Issueの状態を取得（リトライ付き）
   */
  async getIssue(issueNumber, maxRetries = 5, delayMs = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      const { data: issue } = await this.octokit.rest.issues.get({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber
      });

      // ワークフローが実行されるまで待機
      if (i < maxRetries - 1) {
        await this.sleep(delayMs);
      }

      return issue;
    }
  }

  /**
   * ファイルをブランチにコミット
   * @param {string} branch - ブランチ名
   * @param {string} path - ファイルパス
   * @param {string} content - ファイル内容
   * @param {string} message - コミットメッセージ（オプション）
   * @returns {Promise<Object>} コミット結果
   */
  async commitFile(branch, path, content, message) {
    try {
      // mainブランチの最新SHA取得
      const { data: mainRef } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: 'heads/main'
      });

      const mainSha = mainRef.object.sha;

      // 新しいブランチが存在するか確認
      let branchExists = true;
      try {
        await this.octokit.rest.git.getRef({
          owner: this.config.owner,
          repo: this.config.repo,
          ref: `heads/${branch}`
        });
      } catch (error) {
        if (error.status === 404) {
          branchExists = false;
        } else {
          throw error;
        }
      }

      // ブランチが存在しない場合は作成
      if (!branchExists) {
        await this.octokit.rest.git.createRef({
          owner: this.config.owner,
          repo: this.config.repo,
          ref: `refs/heads/${branch}`,
          sha: mainSha
        });
      }

      // ファイルが既に存在するかチェック
      let fileSha = null;
      try {
        const { data: existingFile } = await this.octokit.rest.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path: path,
          ref: branch
        });
        fileSha = existingFile.sha;
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
        // 404 = ファイルが存在しない（新規作成）
      }

      // ファイル作成/更新
      const params = {
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        message: message || `Add/Update ${path}`,
        content: Buffer.from(content).toString('base64'),
        branch: branch
      };

      if (fileSha) {
        params.sha = fileSha; // 既存ファイルの場合のみSHAを指定
      }

      const { data: fileData } = await this.octokit.rest.repos.createOrUpdateFileContents(params);

      return fileData;
    } catch (error) {
      this.handleApiError(error, `commitFile(${path})`);
    }
  }

  /**
   * テスト用PRを作成
   * @param {number} issueNumber - 関連するIssue番号
   * @param {Object} options - PRオプション
   * @param {string} options.title - PRタイトル
   * @param {string} options.body - PR本文
   * @param {string} options.branchName - カスタムブランチ名（オプション）
   * @param {string} options.commitMessage - カスタムコミットメッセージ（オプション）
   * @param {Array<Object>} options.files - ファイル配列 [{path, content, commitMessage}]
   * @returns {Promise<Object>} 作成されたPRオブジェクト
   */
  async createTestPR(issueNumber, options = {}) {
    try {
      // ブランチ名: カスタム or デフォルト
      const branch = options.branchName || `test-pr-${Date.now()}`;

      // デフォルトのコミットメッセージ
      const defaultCommitMessage = options.commitMessage || `test: Add test files for #${issueNumber}`;

      // ファイルがあればコミット
      if (options.files && Array.isArray(options.files)) {
        for (const file of options.files) {
          if (!file.path || !file.content) {
            throw new Error('Each file must have path and content properties');
          }
          // ファイル個別のコミットメッセージ or デフォルト
          const commitMsg = file.commitMessage || defaultCommitMessage;
          await this.commitFile(branch, file.path, file.content, commitMsg);
        }
      } else {
        // ファイル指定がない場合、ダミーファイルを作成
        await this.commitFile(branch, 'test-file.txt', `Test PR for #${issueNumber}`, defaultCommitMessage);
      }

      // PR作成
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: options.title || `${this.config.testIssuePrefix} PR for Issue #${issueNumber}`,
        body: options.body || `This is a test PR created by automated tests.\n\nCloses #${issueNumber}`,
        head: branch,
        base: 'main'
      });

      // クリーンアップ用に記録
      this.testPRs.push({ number: pr.number, branch: branch });

      return pr;
    } catch (error) {
      this.handleApiError(error, 'createTestPR');
    }
  }

  /**
   * PRのチェック結果を取得
   * @param {number} prNumber - PR番号
   * @returns {Promise<Array>} チェック結果の配列
   */
  async getPRChecks(prNumber) {
    try {
      // PRの詳細を取得してHEAD SHAを取得
      const { data: pr } = await this.octokit.rest.pulls.get({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber
      });

      // チェック結果を取得
      const { data: checks } = await this.octokit.rest.checks.listForRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: pr.head.sha
      });

      return checks.check_runs || [];
    } catch (error) {
      this.handleApiError(error, 'getPRChecks');
    }
  }

  /**
   * Milestoneをクローズ
   * @param {string} milestoneName - Milestone名（部分一致）
   */
  async closeMilestone(milestoneName) {
    const { data: milestones } = await this.octokit.rest.issues.listMilestones({
      owner: this.config.owner,
      repo: this.config.repo,
      state: 'all',
      per_page: 100
    });

    const milestone = milestones.find(m => m.title.includes(milestoneName));
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneName}`);
    }

    await this.octokit.rest.issues.updateMilestone({
      owner: this.config.owner,
      repo: this.config.repo,
      milestone_number: milestone.number,
      state: 'closed'
    });
  }

  /**
   * Milestoneをオープン
   * @param {string} milestoneName - Milestone名（部分一致）
   */
  async openMilestone(milestoneName) {
    const { data: milestones } = await this.octokit.rest.issues.listMilestones({
      owner: this.config.owner,
      repo: this.config.repo,
      state: 'all',
      per_page: 100
    });

    const milestone = milestones.find(m => m.title.includes(milestoneName));
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneName}`);
    }

    await this.octokit.rest.issues.updateMilestone({
      owner: this.config.owner,
      repo: this.config.repo,
      milestone_number: milestone.number,
      state: 'open'
    });
  }

  /**
   * Milestoneを作成
   * @param {string} title - Milestoneタイトル
   * @param {string} description - Milestone説明（オプション）
   * @returns {Promise<Object>} 作成されたMilestone
   */
  async createMilestone(title, description = '') {
    const { data: milestone } = await this.octokit.rest.issues.createMilestone({
      owner: this.config.owner,
      repo: this.config.repo,
      title: title,
      description: description
    });

    // クリーンアップ用に記録
    this.testMilestones.push(milestone.number);

    return milestone;
  }

  /**
   * IssueにMilestoneを紐付け
   * @param {number} issueNumber - Issue番号
   * @param {number} milestoneNumber - Milestone番号
   */
  async assignIssueToMilestone(issueNumber, milestoneNumber) {
    await this.octokit.rest.issues.update({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      milestone: milestoneNumber
    });
  }

  /**
   * Milestoneを取得
   * @param {number} milestoneNumber - Milestone番号
   * @returns {Promise<Object>} Milestoneオブジェクト
   */
  async getMilestone(milestoneNumber) {
    const { data: milestone } = await this.octokit.rest.issues.getMilestone({
      owner: this.config.owner,
      repo: this.config.repo,
      milestone_number: milestoneNumber
    });

    return milestone;
  }

  /**
   * Milestoneを削除
   * @param {number} milestoneNumber - Milestone番号
   */
  async deleteMilestone(milestoneNumber) {
    await this.octokit.rest.issues.deleteMilestone({
      owner: this.config.owner,
      repo: this.config.repo,
      milestone_number: milestoneNumber
    });
  }

  /**
   * Issueのコメントを取得
   * @param {number} issueNumber - Issue番号
   * @returns {Promise<Array>} コメント配列
   */
  async getIssueComments(issueNumber) {
    const { data: comments } = await this.octokit.rest.issues.listComments({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber
    });
    return comments;
  }

  /**
   * Issueのラベルを取得
   * @param {number} issueNumber - Issue番号
   * @returns {Promise<Array>} ラベル名の配列
   */
  async getIssueLabels(issueNumber) {
    const { data: issue } = await this.octokit.rest.issues.get({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber
    });
    return issue.labels.map(label => label.name);
  }

  /**
   * Issueを更新
   * @param {number} issueNumber - Issue番号
   * @param {Object} updates - 更新内容 (body, title, state, labels等)
   * @returns {Promise<Object>} 更新されたIssue
   */
  async updateIssue(issueNumber, updates) {
    const { data: issue } = await this.octokit.rest.issues.update({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      ...updates
    });
    return issue;
  }

  /**
   * ワークフロー実行履歴を取得
   * @param {string} workflowName - ワークフロー名
   * @param {Object} options - オプション
   * @param {string} options.branch - ブランチ名でフィルタ
   * @param {string} options.sha - コミットSHAでフィルタ
   * @returns {Promise<Array>} ワークフロー実行履歴
   */
  async getWorkflowRuns(workflowName, options = {}) {
    try {
      // ワークフロー一覧を取得
      const { data: workflows } = await this.octokit.rest.actions.listRepoWorkflows({
        owner: this.config.owner,
        repo: this.config.repo
      });

      // 指定されたワークフロー名で検索
      const workflow = workflows.workflows.find(w => w.name === workflowName);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowName}`);
      }

      // ワークフロー実行履歴を取得
      const params = {
        owner: this.config.owner,
        repo: this.config.repo,
        workflow_id: workflow.id,
        per_page: 20
      };

      if (options.branch) {
        params.branch = options.branch;
      }

      if (options.sha) {
        params.head_sha = options.sha;
      }

      const { data: runs } = await this.octokit.rest.actions.listWorkflowRuns(params);

      return runs.workflow_runs || [];
    } catch (error) {
      this.handleApiError(error, 'getWorkflowRuns');
    }
  }

  /**
   * ワークフロー実行完了を待機
   * @param {number} runId - ワークフローRun ID
   * @param {Object} options - オプション
   * @param {number} options.timeout - タイムアウト（ミリ秒）デフォルト: 180000 (3分)
   * @param {number} options.interval - チェック間隔（ミリ秒）デフォルト: 5000
   * @returns {Promise<Object>} ワークフロー実行結果
   */
  async waitForWorkflowRun(runId, options = {}) {
    const timeout = options.timeout || 180000; // 3分
    const interval = options.interval || 5000; // 5秒
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const { data: run } = await this.octokit.rest.actions.getWorkflowRun({
          owner: this.config.owner,
          repo: this.config.repo,
          run_id: runId
        });

        if (run.status === 'completed') {
          return run;
        }

        await this.sleep(interval);
      } catch (error) {
        // 404エラーは実行がまだ開始されていない可能性がある
        if (error.status !== 404) {
          throw error;
        }
        await this.sleep(interval);
      }
    }

    throw new Error(`Workflow run ${runId} did not complete within ${timeout}ms`);
  }

  /**
   * ワークフロー失敗をトリガー（テスト用）
   * @param {Object} options - オプション
   * @param {string} options.errorType - エラータイプ ('network', 'logic', 'syntax')
   * @param {number} options.issueNumber - 関連するIssue番号
   * @returns {Promise<Object>} 作成されたPR
   */
  async triggerWorkflowFailure(options = {}) {
    const errorType = options.errorType || 'network';
    const issueNumber = options.issueNumber;

    if (!issueNumber) {
      throw new Error('issueNumber is required');
    }

    // エラータイプに応じたテストファイルを生成
    let testContent = '';
    let testFileName = '';

    switch (errorType) {
      case 'network':
        // ネットワークエラーをシミュレート（存在しないURLへのリクエスト）
        testFileName = 'tests/network-failure.test.js';
        testContent = `
const axios = require('axios');

describe('Network Error Test', () => {
  test('should fail with network error', async () => {
    // 存在しないホストへのリクエスト
    await axios.get('http://nonexistent-host-for-testing-12345.example.com', {
      timeout: 5000
    });
  }, 10000);
});
`;
        break;

      case 'logic':
        // 論理エラーをシミュレート（テスト失敗）
        testFileName = 'tests/logic-failure.test.js';
        testContent = `
describe('Logic Error Test', () => {
  test('should fail with assertion error', () => {
    const expected = 'correct value';
    const actual = 'wrong value';
    expect(actual).toBe(expected);
  });
});
`;
        break;

      case 'syntax':
        // 構文エラーをシミュレート
        testFileName = 'tests/syntax-failure.test.js';
        testContent = `
describe('Syntax Error Test', () => {
  test('should fail with syntax error', () => {
    // 意図的な構文エラー
    const broken = ;
  });
});
`;
        break;

      default:
        throw new Error(`Unknown error type: ${errorType}`);
    }

    // テスト失敗を含むPRを作成
    const pr = await this.createTestPR(issueNumber, {
      title: `Test: ${errorType} error for Issue #${issueNumber}`,
      body: `Closes #${issueNumber}\n\nThis PR intentionally triggers a ${errorType} error for testing.`,
      files: [
        {
          path: testFileName,
          content: testContent
        }
      ]
    });

    return pr;
  }

  /**
   * 待機
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * すべてのテストを実行
   */
  async runAll() {
    console.log('🧪 Starting Workflow Tests...\n');

    const results = [];
    let passed = 0;
    let failed = 0;

    try {
      for (const test of this.tests) {
        console.log(`▶️  ${test.name}`);

        try {
          await test.testFn(this);
          console.log(`   ✅ PASS\n`);
          results.push({ name: test.name, status: 'pass' });
          passed++;
        } catch (error) {
          console.log(`   ❌ FAIL: ${error.message}\n`);
          results.push({ name: test.name, status: 'fail', error: error.message });
          failed++;
        }
      }
    } finally {
      // クリーンアップは必ず実行（エラー発生時も）
      if (this.config.cleanupAfterTests) {
        try {
          await this.cleanup();
        } catch (cleanupError) {
          console.error(`⚠️  Cleanup failed: ${cleanupError.message}`);
          // クリーンアップ失敗はテスト結果に影響させない
        }
      }
    }

    // サマリー
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📝 Total:  ${this.tests.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failed > 0) {
      console.log('Failed tests:');
      results.filter(r => r.status === 'fail').forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
      process.exit(1);
    }

    return results;
  }

  /**
   * テスト用IssueとPRとMilestoneをクリーンアップ
   */
  async cleanup() {
    const totalItems = this.testIssues.length + this.testPRs.length + this.testMilestones.length;

    if (totalItems === 0) {
      return;
    }

    console.log(`🧹 Cleaning up ${this.testIssues.length} test issues, ${this.testPRs.length} test PRs, and ${this.testMilestones.length} test milestones...`);

    let issuesDeleted = 0;
    let prsClosed = 0;
    let branchesDeleted = 0;
    let milestonesDeleted = 0;

    // PRのクリーンアップ（Issue より先に）
    for (const pr of this.testPRs) {
      try {
        // PRをクローズ
        await this.octokit.rest.pulls.update({
          owner: this.config.owner,
          repo: this.config.repo,
          pull_number: pr.number,
          state: 'closed'
        });
        prsClosed++;

        // ブランチを削除
        try {
          await this.octokit.rest.git.deleteRef({
            owner: this.config.owner,
            repo: this.config.repo,
            ref: `heads/${pr.branch}`
          });
          branchesDeleted++;
        } catch (error) {
          // ブランチ削除失敗は警告のみ（既に削除されている可能性もある）
          console.warn(`   ⚠️  Failed to delete branch ${pr.branch}: ${error.message}`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to close PR #${pr.number}: ${error.message}`);
      }
    }

    // Issueのクリーンアップ（PR がクローズされた後）
    for (const issueNumber of this.testIssues) {
      try {
        await this.octokit.rest.issues.update({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: issueNumber,
          state: 'closed'
        });
        issuesDeleted++;
      } catch (error) {
        console.warn(`   ⚠️  Failed to close issue #${issueNumber}: ${error.message}`);
      }
    }

    // Milestoneのクリーンアップ
    for (const milestoneNumber of this.testMilestones) {
      try {
        await this.octokit.rest.issues.deleteMilestone({
          owner: this.config.owner,
          repo: this.config.repo,
          milestone_number: milestoneNumber
        });
        milestonesDeleted++;
      } catch (error) {
        console.warn(`   ⚠️  Failed to delete milestone #${milestoneNumber}: ${error.message}`);
      }
    }

    console.log(`   ✅ Cleanup complete: ${issuesDeleted}/${this.testIssues.length} issues, ${prsClosed}/${this.testPRs.length} PRs, ${branchesDeleted}/${this.testPRs.length} branches, ${milestonesDeleted}/${this.testMilestones.length} milestones\n`);

    // クリーンアップ失敗があれば警告
    const failedCleanup = (this.testIssues.length - issuesDeleted) + (this.testPRs.length - prsClosed);
    if (failedCleanup > 0) {
      console.warn(`   ⚠️  Warning: ${failedCleanup} items failed to cleanup. Manual cleanup may be required.\n`);
    }
  }

  /**
   * Issue作成をトリガーに自動的にエージェントを起動してPRを作成
   * @param {number} issueNumber - Issue番号
   * @param {string} agentType - エージェントタイプ（'auto'で自動選択）
   */
  async autorun(issueNumber, agentType = 'auto') {
    console.log(`\n🤖 Auto-running agent for Issue #${issueNumber}`);
    console.log(`   Repository: ${this.config.owner}/${this.config.repo}\n`);

    try {
      // 1. Issue内容取得
      console.log('📖 Fetching issue details...');
      const issue = await this.getIssue(issueNumber);
      console.log(`   Title: ${issue.title}`);
      console.log(`   Labels: ${issue.labels.map(l => l.name).join(', ') || '(none)'}\n`);

      // 2. エージェント選択
      const agent = agentType === 'auto' ? this.selectAgent(issue) : agentType;
      console.log(`🎯 Selected agent: ${agent}\n`);

      // 3. Work Unit ID生成（ブランチ名）
      const timestamp = Math.floor(Date.now() / 1000);
      const sanitizedTitle = issue.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30);
      const branch = `feature/${issueNumber}-${sanitizedTitle}-${timestamp}`;
      console.log(`🌿 Branch name: ${branch}\n`);

      // 4. エージェント設定ファイルのパス
      const agentPath = path.join(__dirname, '../../.claude/agents', `${agent}.md`);

      // エージェント定義ファイルが存在するか確認
      if (!fs.existsSync(agentPath)) {
        throw new Error(`Agent definition not found: ${agentPath}`);
      }

      console.log(`📝 Agent definition: ${agentPath}`);
      console.log(`\n⚠️  Note: Actual agent execution requires Claude Code integration.`);
      console.log(`   This is a proof-of-concept that demonstrates the autorun flow.\n`);

      // 5. 結果をIssueにコメント
      await this.octokit.rest.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        body: `🤖 **Auto-Agent Execution Report**

✅ Agent selected: \`${agent}\`
🌿 Branch would be created: \`${branch}\`
📝 Agent definition: \`${agentPath}\`

**Next Steps:**
This is a proof-of-concept. To enable full automation:
1. Integrate with Claude Code API
2. Execute agent with issue context
3. Create PR automatically

For now, please manually execute the agent with this context.`
      });

      console.log('✅ Autorun completed successfully!');
      console.log(`   Comment added to Issue #${issueNumber}\n`);

      return {
        success: true,
        issueNumber,
        agent,
        branch
      };

    } catch (error) {
      console.error(`\n❌ Autorun failed: ${error.message}\n`);

      // エラーをIssueにコメント
      try {
        await this.octokit.rest.issues.createComment({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: issueNumber,
          body: `❌ **Auto-Agent Execution Failed**

\`\`\`
${error.message}
\`\`\`

Please check the workflow logs for details.`
        });
      } catch (commentError) {
        console.error(`Failed to add error comment: ${commentError.message}`);
      }

      throw error;
    }
  }

  /**
   * Issueの内容から最適なエージェントを選択
   * @param {object} issue - Issue object
   * @returns {string} - エージェント名
   */
  selectAgent(issue) {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    const title = issue.title.toLowerCase();

    // ラベルベースの判断（優先）
    if (labels.includes('workflow') || labels.includes('workflow-bug')) {
      return 'workflow-implementer';
    }
    if (labels.includes('test') || labels.includes('testing')) {
      return 'test-implementer';
    }
    if (labels.includes('test-infra') || labels.includes('test-infrastructure')) {
      return 'test-infrastructure';
    }

    // タイトルベースの判断（フォールバック）
    if (title.includes('workflow') || title.includes('github actions')) {
      return 'workflow-implementer';
    }
    if (title.includes('test') || title.includes('testing')) {
      return 'test-implementer';
    }

    // デフォルト: general-purpose
    // 注: general-purposeエージェントは将来追加予定
    console.warn('   ⚠️  No specific agent matched. Using workflow-implementer as default.');
    return 'workflow-implementer';
  }
}

// メイン実行
async function main() {
  // コマンドライン引数を解析
  const args = process.argv.slice(2);
  const command = args[0];

  // GitHub Token確認
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ Error: GITHUB_TOKEN environment variable is required');
    console.error('\nUsage:');
    console.error('  GITHUB_TOKEN=your_token npm run test:workflows');
    console.error('  GITHUB_TOKEN=your_token node tests/workflows/runner.js autorun --issue 123 --agent auto');
    process.exit(1);
  }

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
  const runner = new WorkflowTestRunner(octokit, CONFIG);

  // autorunコマンド処理
  if (command === 'autorun') {
    const issueIndex = args.indexOf('--issue');
    const agentIndex = args.indexOf('--agent');

    if (issueIndex === -1 || issueIndex + 1 >= args.length) {
      console.error('❌ Error: --issue <number> is required for autorun command');
      console.error('\nUsage:');
      console.error('  node tests/workflows/runner.js autorun --issue <number> --agent <agent-name|auto>');
      process.exit(1);
    }

    const issueNumber = parseInt(args[issueIndex + 1], 10);
    const agentType = agentIndex !== -1 && agentIndex + 1 < args.length
      ? args[agentIndex + 1]
      : 'auto';

    if (isNaN(issueNumber)) {
      console.error('❌ Error: Issue number must be a valid number');
      process.exit(1);
    }

    await runner.autorun(issueNumber, agentType);
    return;
  }

  // デフォルト: テストケースを実行
  const testsDir = __dirname;
  const testFiles = fs.readdirSync(testsDir)
    .filter(f => f.endsWith('.test.js'))
    .sort();

  if (testFiles.length === 0) {
    console.log('ℹ️  No test files found');
    return;
  }

  console.log(`📁 Found ${testFiles.length} test file(s):\n`);
  testFiles.forEach(f => console.log(`   - ${f}`));
  console.log('');

  // 各テストファイルを読み込んで実行
  for (const testFile of testFiles) {
    const testPath = path.join(testsDir, testFile);
    console.log(`📦 Loading ${testFile}...`);

    try {
      const testModule = require(testPath);
      if (typeof testModule === 'function') {
        testModule(runner);
      } else {
        console.warn(`   ⚠️  ${testFile} does not export a function`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to load ${testFile}: ${error.message}`);
    }
  }

  console.log('');

  // すべてのテストを実行
  await runner.runAll();
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// 実行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = WorkflowTestRunner;
