/**
 * Local Development Guard Tests (Grouped)
 *
 * validate-branch-name.yml, validate-commit-message.yml のテスト
 * 複数のテストケースを1つのグループで実行し、汚染を最小化
 */

module.exports = function (runner) {
  runner.addTest('Local Guard Layer - Branch & Commit Validation', async (runner) => {
    const results = [];
    let testNumber = 0;

    console.log('\n  🧪 Starting Local Guard Layer Tests (6 test cases in 1 group)...\n');

    // ========================================
    // 1. Branch Naming Tests (3 cases)
    // ========================================
    console.log('  📋 Group 1: Branch Naming Tests');

    // Case 1: Valid feature branch
    testNumber++;
    try {
      const issue1 = await runner.createTestIssue('Test Issue for valid branch');
      const pr1 = await runner.createTestPR(issue1.number, {
        title: `Test: Valid branch name for #${issue1.number}`,
        body: `Closes #${issue1.number}`,
        branchName: `feature/${issue1.number}-valid-branch-test`
      });
      await runner.sleep(15000);
      const checks1 = await runner.getPRChecks(pr1.number);
      const validation1 = checks1.find(c => c.name === 'Check Branch Naming Convention');
      if (!validation1 || validation1.conclusion !== 'success') {
        throw new Error('Valid feature branch should pass');
      }
      results.push({ test: `${testNumber}. Valid feature branch`, status: 'PASS', pr: pr1.number });
      console.log(`    ✅ ${testNumber}. Valid feature branch`);
    } catch (e) {
      results.push({ test: `${testNumber}. Valid feature branch`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Valid feature branch: ${e.message}`);
    }

    // Case 2: Invalid branch (no issue number)
    testNumber++;
    try {
      const issue2 = await runner.createTestIssue('Test Issue for invalid branch');
      const pr2 = await runner.createTestPR(issue2.number, {
        title: `Test: Invalid branch name`,
        body: `Closes #${issue2.number}`,
        branchName: `feature/invalid-branch-without-number`
      });
      await runner.sleep(15000);
      const checks2 = await runner.getPRChecks(pr2.number);
      const validation2 = checks2.find(c => c.name === 'Check Branch Naming Convention');
      if (!validation2 || validation2.conclusion !== 'failure') {
        throw new Error('Invalid branch should fail');
      }
      results.push({ test: `${testNumber}. Invalid branch (reject)`, status: 'PASS', pr: pr2.number });
      console.log(`    ✅ ${testNumber}. Invalid branch correctly rejected`);
    } catch (e) {
      results.push({ test: `${testNumber}. Invalid branch (reject)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Invalid branch: ${e.message}`);
    }

    // Case 3: Valid hotfix branch
    testNumber++;
    try {
      const issue3 = await runner.createTestIssue('Test Issue for hotfix');
      const pr3 = await runner.createTestPR(issue3.number, {
        title: `Hotfix: #${issue3.number}`,
        body: `Closes #${issue3.number}`,
        branchName: `hotfix/${issue3.number}-urgent-fix`
      });
      await runner.sleep(15000);
      const checks3 = await runner.getPRChecks(pr3.number);
      const validation3 = checks3.find(c => c.name === 'Check Branch Naming Convention');
      if (!validation3 || validation3.conclusion !== 'success') {
        throw new Error('Valid hotfix branch should pass');
      }
      results.push({ test: `${testNumber}. Valid hotfix branch`, status: 'PASS', pr: pr3.number });
      console.log(`    ✅ ${testNumber}. Valid hotfix branch`);
    } catch (e) {
      results.push({ test: `${testNumber}. Valid hotfix branch`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Valid hotfix branch: ${e.message}`);
    }

    // ========================================
    // 2. Commit Message Tests (3 cases)
    // ========================================
    console.log('\n  📋 Group 2: Commit Message Tests');

    // Case 4: Valid commit with issue
    testNumber++;
    try {
      const issue4 = await runner.createTestIssue('Test Issue for commit message');
      const pr4 = await runner.createTestPR(issue4.number, {
        title: `Test: Valid commit message`,
        body: `Closes #${issue4.number}`,
        branchName: `feature/${issue4.number}-valid-commit-test`,
        commitMessage: `fix: #${issue4.number} test valid commit message`
      });
      await runner.sleep(15000);
      const checks4 = await runner.getPRChecks(pr4.number);
      const validation4 = checks4.find(c => c.name === 'Check Commit Message Format');
      if (!validation4 || validation4.conclusion !== 'success') {
        throw new Error('Valid commit message should pass');
      }
      results.push({ test: `${testNumber}. Valid commit message`, status: 'PASS', pr: pr4.number });
      console.log(`    ✅ ${testNumber}. Valid commit message`);
    } catch (e) {
      results.push({ test: `${testNumber}. Valid commit message`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Valid commit message: ${e.message}`);
    }

    // Case 5: Invalid commit (no issue)
    testNumber++;
    try {
      const issue5 = await runner.createTestIssue('Test Issue for invalid commit');
      const pr5 = await runner.createTestPR(issue5.number, {
        title: `Test: Invalid commit message`,
        body: `Closes #${issue5.number}`,
        branchName: `feature/${issue5.number}-invalid-commit-test`,
        commitMessage: `fix: test without issue number`
      });
      await runner.sleep(15000);
      const checks5 = await runner.getPRChecks(pr5.number);
      const validation5 = checks5.find(c => c.name === 'Check Commit Message Format');
      if (!validation5 || validation5.conclusion !== 'failure') {
        throw new Error('Invalid commit should fail');
      }
      results.push({ test: `${testNumber}. Invalid commit (reject)`, status: 'PASS', pr: pr5.number });
      console.log(`    ✅ ${testNumber}. Invalid commit correctly rejected`);
    } catch (e) {
      results.push({ test: `${testNumber}. Invalid commit (reject)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Invalid commit: ${e.message}`);
    }

    // Case 6: Multiple commits with issues
    testNumber++;
    try {
      const issue6 = await runner.createTestIssue('Test Issue for multiple commits');
      const pr6 = await runner.createTestPR(issue6.number, {
        title: `Test: Multiple commits`,
        body: `Closes #${issue6.number}`,
        branchName: `feature/${issue6.number}-multiple-commits`,
        files: [
          {
            path: 'test-file-1.txt',
            content: 'First commit',
            commitMessage: `feat: #${issue6.number} first commit`
          },
          {
            path: 'test-file-2.txt',
            content: 'Second commit',
            commitMessage: `feat: #${issue6.number} second commit`
          }
        ]
      });
      await runner.sleep(15000);
      const checks6 = await runner.getPRChecks(pr6.number);
      const validation6 = checks6.find(c => c.name === 'Check Commit Message Format');
      if (!validation6 || validation6.conclusion !== 'success') {
        throw new Error('Multiple valid commits should pass');
      }
      results.push({ test: `${testNumber}. Multiple valid commits`, status: 'PASS', pr: pr6.number });
      console.log(`    ✅ ${testNumber}. Multiple valid commits`);
    } catch (e) {
      results.push({ test: `${testNumber}. Multiple valid commits`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Multiple valid commits: ${e.message}`);
    }

    // ========================================
    // Summary Report
    // ========================================
    console.log('\n  📊 Local Guard Layer Test Summary:\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`    Total:  ${results.length} test cases`);
    console.log(`    Passed: ${passed} ✅`);
    console.log(`    Failed: ${failed} ❌`);

    if (failed > 0) {
      console.log('\n  ❌ Failed Tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`    - ${r.test}`);
        console.log(`      Error: ${r.error}`);
      });
      throw new Error(`Local Guard Layer Tests: ${failed}/${results.length} test cases failed`);
    }

    console.log('\n  ✅ All Local Guard Layer test cases passed!\n');
  });
};
