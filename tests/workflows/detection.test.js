/**
 * Detection Layer Tests (Grouped)
 *
 * validate-pr.yml, validate-pr-files.yml, circular-dependency-detector.yml のテスト
 * 複数のテストケースを1つのPRグループで実行し、汚染を最小化
 */

module.exports = function (runner) {
  runner.addTest('Detection Layer - All Validation Tests', async (runner) => {
    const results = [];
    let testNumber = 0;

    console.log('\n  🧪 Starting Detection Layer Tests (24 test cases in 1 group)...\n');

    // ========================================
    // 1. PR Validation Tests (5 cases)
    // ========================================
    console.log('  📋 Group 1: PR Validation Tests');

    // Case 1: Closes pattern
    testNumber++;
    try {
      const issue1 = await runner.createTestIssue('Test Issue for Closes pattern');
      const pr1 = await runner.createTestPR(issue1.number, {
        title: `Test PR for #${issue1.number}`,
        body: `Closes #${issue1.number}`
      });
      await runner.sleep(15000);
      const checks1 = await runner.getPRChecks(pr1.number);
      const validation1 = checks1.find(c => c.name === 'Check Issue Reference');
      if (!validation1 || validation1.conclusion !== 'success') {
        throw new Error('Expected success');
      }
      results.push({ test: `${testNumber}. Closes pattern`, status: 'PASS', pr: pr1.number });
      console.log(`    ✅ ${testNumber}. Closes pattern accepted`);
    } catch (e) {
      results.push({ test: `${testNumber}. Closes pattern`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Closes pattern: ${e.message}`);
    }

    // Case 2: Fixes pattern
    testNumber++;
    try {
      const issue2 = await runner.createTestIssue('Test Issue for Fixes pattern');
      const pr2 = await runner.createTestPR(issue2.number, {
        title: `Fix #${issue2.number}`,
        body: `Fixes #${issue2.number}`
      });
      await runner.sleep(15000);
      const checks2 = await runner.getPRChecks(pr2.number);
      const validation2 = checks2.find(c => c.name === 'Check Issue Reference');
      if (!validation2 || validation2.conclusion !== 'success') {
        throw new Error('Expected success');
      }
      results.push({ test: `${testNumber}. Fixes pattern`, status: 'PASS', pr: pr2.number });
      console.log(`    ✅ ${testNumber}. Fixes pattern accepted`);
    } catch (e) {
      results.push({ test: `${testNumber}. Fixes pattern`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Fixes pattern: ${e.message}`);
    }

    // Case 3: Resolves pattern
    testNumber++;
    try {
      const issue3 = await runner.createTestIssue('Test Issue for Resolves pattern');
      const pr3 = await runner.createTestPR(issue3.number, {
        title: `Resolve #${issue3.number}`,
        body: `Resolves #${issue3.number}`
      });
      await runner.sleep(15000);
      const checks3 = await runner.getPRChecks(pr3.number);
      const validation3 = checks3.find(c => c.name === 'Check Issue Reference');
      if (!validation3 || validation3.conclusion !== 'success') {
        throw new Error('Expected success');
      }
      results.push({ test: `${testNumber}. Resolves pattern`, status: 'PASS', pr: pr3.number });
      console.log(`    ✅ ${testNumber}. Resolves pattern accepted`);
    } catch (e) {
      results.push({ test: `${testNumber}. Resolves pattern`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Resolves pattern: ${e.message}`);
    }

    // Case 4: No close pattern (should fail)
    testNumber++;
    try {
      const issue4 = await runner.createTestIssue('Test Issue without close pattern');
      const pr4 = await runner.createTestPR(issue4.number, {
        title: `Test PR #${issue4.number}`,
        body: `This PR references #${issue4.number} but has no close pattern`
      });
      await runner.sleep(15000);
      const checks4 = await runner.getPRChecks(pr4.number);
      const validation4 = checks4.find(c => c.name === 'Check Issue Reference');
      if (!validation4 || validation4.conclusion !== 'failure') {
        throw new Error('Expected failure');
      }
      results.push({ test: `${testNumber}. No close pattern (reject)`, status: 'PASS', pr: pr4.number });
      console.log(`    ✅ ${testNumber}. No close pattern correctly rejected`);
    } catch (e) {
      results.push({ test: `${testNumber}. No close pattern (reject)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. No close pattern: ${e.message}`);
    }

    // Case 5: Multiple issues
    testNumber++;
    try {
      const issue5a = await runner.createTestIssue('Test Issue 1');
      const issue5b = await runner.createTestIssue('Test Issue 2');
      const pr5 = await runner.createTestPR(issue5a.number, {
        title: 'Multiple issues test',
        body: `Closes #${issue5a.number}\nCloses #${issue5b.number}`
      });
      await runner.sleep(15000);
      const checks5 = await runner.getPRChecks(pr5.number);
      const validation5 = checks5.find(c => c.name === 'Check Issue Reference');
      if (!validation5 || validation5.conclusion !== 'success') {
        throw new Error('Expected success');
      }
      results.push({ test: `${testNumber}. Multiple issues`, status: 'PASS', pr: pr5.number });
      console.log(`    ✅ ${testNumber}. Multiple issues accepted`);
    } catch (e) {
      results.push({ test: `${testNumber}. Multiple issues`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Multiple issues: ${e.message}`);
    }

    // ========================================
    // 2. Required Files Tests (5 cases)
    // ========================================
    console.log('\n  📋 Group 2: Required Files Tests');

    // Case 6: Phase completion with notes.md
    testNumber++;
    try {
      const issue6 = await runner.createTestIssue('フェーズ1: テスト完了');
      const pr6 = await runner.createTestPR(issue6.number, {
        title: 'フェーズ1完了',
        body: `Closes #${issue6.number}`,
        files: [{
          path: 'docs/learning/phase1/notes.md',
          content: '# 学習メモ\n\n## 学んだこと\n- GitHub Actionsの基礎'
        }]
      });
      await runner.sleep(15000);
      const checks6 = await runner.getPRChecks(pr6.number);
      const validation6 = checks6.find(c => c.name === 'Check Required File Changes');
      if (!validation6 || validation6.conclusion !== 'success') {
        throw new Error('Expected success');
      }
      results.push({ test: `${testNumber}. Phase completion with notes.md`, status: 'PASS', pr: pr6.number });
      console.log(`    ✅ ${testNumber}. Phase completion with notes.md`);
    } catch (e) {
      results.push({ test: `${testNumber}. Phase completion with notes.md`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Phase completion with notes.md: ${e.message}`);
    }

    // Case 7: Phase completion without notes.md (should fail)
    testNumber++;
    try {
      const issue7 = await runner.createTestIssue('フェーズ2: テスト完了（notes.mdなし）');
      const pr7 = await runner.createTestPR(issue7.number, {
        title: 'フェーズ2完了',
        body: `Closes #${issue7.number}`,
        files: [{
          path: 'README.md',
          content: '# Updated README'
        }]
      });
      await runner.sleep(15000);
      const checks7 = await runner.getPRChecks(pr7.number);
      const validation7 = checks7.find(c => c.name === 'Check Required File Changes');
      if (!validation7 || validation7.conclusion !== 'failure') {
        throw new Error('Expected failure');
      }
      results.push({ test: `${testNumber}. Phase completion without notes.md (reject)`, status: 'PASS', pr: pr7.number });
      console.log(`    ✅ ${testNumber}. Phase completion without notes.md correctly rejected`);
    } catch (e) {
      results.push({ test: `${testNumber}. Phase completion without notes.md (reject)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Phase completion without notes.md: ${e.message}`);
    }

    // Case 8: Source + test changes
    testNumber++;
    try {
      const issue8 = await runner.createTestIssue('ソースコードとテストの変更');
      const pr8 = await runner.createTestPR(issue8.number, {
        title: 'テスト: ソースとテスト両方変更',
        body: `Closes #${issue8.number}`,
        files: [
          { path: 'src/newFeature.ts', content: 'export function newFeature() { return true; }' },
          { path: 'src/newFeature.spec.ts', content: 'test("newFeature", () => { expect(true).toBe(true); });' }
        ]
      });
      await runner.sleep(15000);
      const comments8 = await runner.getIssueComments(pr8.number);
      const warning8 = comments8.find(c => c.body.includes('テストファイルの変更が見つかりません'));
      if (warning8) {
        throw new Error('Should not warn when both source and test are changed');
      }
      results.push({ test: `${testNumber}. Source + test changes (no warning)`, status: 'PASS', pr: pr8.number });
      console.log(`    ✅ ${testNumber}. Source + test changes (no warning)`);
    } catch (e) {
      results.push({ test: `${testNumber}. Source + test changes (no warning)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Source + test changes: ${e.message}`);
    }

    // Case 9: Source without test (should warn)
    testNumber++;
    try {
      const issue9 = await runner.createTestIssue('テストなしのソース変更');
      const pr9 = await runner.createTestPR(issue9.number, {
        title: 'テスト: ソースのみ変更',
        body: `Closes #${issue9.number}`,
        files: [{ path: 'src/anotherFeature.ts', content: 'export function anotherFeature() { return false; }' }]
      });
      await runner.sleep(15000);
      const comments9 = await runner.getIssueComments(pr9.number);
      const warning9 = comments9.find(c => c.body.includes('テストファイルの変更が見つかりません'));
      if (!warning9) {
        throw new Error('Should warn when source is changed without tests');
      }
      results.push({ test: `${testNumber}. Source without test (warning)`, status: 'PASS', pr: pr9.number });
      console.log(`    ✅ ${testNumber}. Source without test correctly warned`);
    } catch (e) {
      results.push({ test: `${testNumber}. Source without test (warning)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Source without test: ${e.message}`);
    }

    // Case 10: Non-phase completion PR (skip)
    testNumber++;
    try {
      const issue10 = await runner.createTestIssue('通常のバグ修正');
      const pr10 = await runner.createTestPR(issue10.number, {
        title: 'バグ修正: テスト',
        body: `Closes #${issue10.number}`,
        files: [{ path: 'src/index.ts', content: 'export function test() {}' }]
      });
      await runner.sleep(15000);
      const checks10 = await runner.getPRChecks(pr10.number);
      const validation10 = checks10.find(c => c.name === 'Check Required File Changes');
      if (validation10 && validation10.conclusion === 'failure') {
        throw new Error('Non-phase completion PR should not fail file check');
      }
      results.push({ test: `${testNumber}. Non-phase completion PR (skip)`, status: 'PASS', pr: pr10.number });
      console.log(`    ✅ ${testNumber}. Non-phase completion PR correctly skipped`);
    } catch (e) {
      results.push({ test: `${testNumber}. Non-phase completion PR (skip)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Non-phase completion PR: ${e.message}`);
    }

    // ========================================
    // 3. Workflow Syntax Tests (2 cases)
    // ========================================
    console.log('\n  📋 Group 3: Workflow Syntax Tests');

    // Case 11: Valid YAML
    testNumber++;
    try {
      const issue11 = await runner.createTestIssue('正常なワークフローYAML');
      const pr11 = await runner.createTestPR(issue11.number, {
        title: 'テスト: 正常なワークフロー追加',
        body: `Closes #${issue11.number}`,
        files: [{
          path: '.github/workflows/test-valid.yml',
          content: `name: Test Valid Workflow\n\non: push\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n      - name: Test\n        run: echo "Valid workflow"\n`
        }]
      });
      await runner.sleep(15000);
      const checks11 = await runner.getPRChecks(pr11.number);
      const validation11 = checks11.find(c => c.name === 'Validate YAML Syntax');
      if (!validation11 || validation11.conclusion !== 'success') {
        throw new Error('Valid YAML should pass validation');
      }
      results.push({ test: `${testNumber}. Valid YAML syntax`, status: 'PASS', pr: pr11.number });
      console.log(`    ✅ ${testNumber}. Valid YAML syntax`);
    } catch (e) {
      results.push({ test: `${testNumber}. Valid YAML syntax`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Valid YAML syntax: ${e.message}`);
    }

    // Case 12: Invalid YAML (should fail)
    testNumber++;
    try {
      const issue12 = await runner.createTestIssue('壊れたワークフローYAML');
      const pr12 = await runner.createTestPR(issue12.number, {
        title: 'テスト: 壊れたワークフロー',
        body: `Closes #${issue12.number}`,
        files: [{
          path: '.github/workflows/test-invalid.yml',
          content: `name: Test Invalid Workflow\n\non: push\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n      - name: Broken\n        run echo "Missing colon"\n`
        }]
      });
      await runner.sleep(15000);
      const checks12 = await runner.getPRChecks(pr12.number);
      const validation12 = checks12.find(c => c.name === 'Validate YAML Syntax');
      if (!validation12 || validation12.conclusion !== 'failure') {
        throw new Error('Invalid YAML should fail validation');
      }
      results.push({ test: `${testNumber}. Invalid YAML syntax (reject)`, status: 'PASS', pr: pr12.number });
      console.log(`    ✅ ${testNumber}. Invalid YAML correctly rejected`);
    } catch (e) {
      results.push({ test: `${testNumber}. Invalid YAML syntax (reject)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Invalid YAML syntax: ${e.message}`);
    }

    // ========================================
    // 4. Circular Dependency Tests (12 cases)
    // ========================================
    console.log('\n  📋 Group 4: Circular Dependency Tests');

    // Case 13: Simple circular (A→B→A)
    testNumber++;
    try {
      const issueA = await runner.createTestIssue('Circular Test A', 'Initial content');
      const issueB = await runner.createTestIssue('Circular Test B', `depends on #${issueA.number}`);
      await runner.updateIssue(issueA.number, { body: `depends on #${issueB.number}` });
      await runner.sleep(15000);
      const labelsA = await runner.getIssueLabels(issueA.number);
      const labelsB = await runner.getIssueLabels(issueB.number);
      if (!labelsA.includes('circular-dependency') || !labelsB.includes('circular-dependency')) {
        throw new Error('Both issues should have circular-dependency label');
      }
      results.push({ test: `${testNumber}. Simple circular dependency (A→B→A)`, status: 'PASS', issues: [issueA.number, issueB.number] });
      console.log(`    ✅ ${testNumber}. Simple circular dependency detected`);
    } catch (e) {
      results.push({ test: `${testNumber}. Simple circular dependency (A→B→A)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Simple circular dependency: ${e.message}`);
    }

    // Case 14: Three-way circular (A→B→C→A)
    testNumber++;
    try {
      const issueA2 = await runner.createTestIssue('Three-way Test A', 'Initial content');
      const issueB2 = await runner.createTestIssue('Three-way Test B', 'Initial content');
      const issueC2 = await runner.createTestIssue('Three-way Test C', `depends on #${issueA2.number}`);
      await runner.updateIssue(issueA2.number, { body: `depends on #${issueB2.number}` });
      await runner.updateIssue(issueB2.number, { body: `depends on #${issueC2.number}` });
      await runner.sleep(15000);
      const labelsA2 = await runner.getIssueLabels(issueA2.number);
      const labelsB2 = await runner.getIssueLabels(issueB2.number);
      const labelsC2 = await runner.getIssueLabels(issueC2.number);
      if (!labelsA2.includes('circular-dependency') || !labelsB2.includes('circular-dependency') || !labelsC2.includes('circular-dependency')) {
        throw new Error('All three issues should have circular-dependency label');
      }
      results.push({ test: `${testNumber}. Three-way circular (A→B→C→A)`, status: 'PASS', issues: [issueA2.number, issueB2.number, issueC2.number] });
      console.log(`    ✅ ${testNumber}. Three-way circular dependency detected`);
    } catch (e) {
      results.push({ test: `${testNumber}. Three-way circular (A→B→C→A)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Three-way circular: ${e.message}`);
    }

    // Case 15: Self-dependency
    testNumber++;
    try {
      const issueSelf = await runner.createTestIssue('Self Dependency Test', 'Initial content');
      await runner.updateIssue(issueSelf.number, { body: `depends on #${issueSelf.number}` });
      await runner.sleep(15000);
      const labelsSelf = await runner.getIssueLabels(issueSelf.number);
      if (!labelsSelf.includes('circular-dependency')) {
        throw new Error('Self-dependent issue should have circular-dependency label');
      }
      results.push({ test: `${testNumber}. Self-dependency detection`, status: 'PASS', issue: issueSelf.number });
      console.log(`    ✅ ${testNumber}. Self-dependency detected`);
    } catch (e) {
      results.push({ test: `${testNumber}. Self-dependency detection`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Self-dependency: ${e.message}`);
    }

    // Case 16: No circular dependency
    testNumber++;
    try {
      const issueNC1 = await runner.createTestIssue('No Circular Test B', 'No dependencies');
      const issueNC2 = await runner.createTestIssue('No Circular Test A', `depends on #${issueNC1.number}`);
      await runner.sleep(15000);
      const labelsNC1 = await runner.getIssueLabels(issueNC1.number);
      const labelsNC2 = await runner.getIssueLabels(issueNC2.number);
      if (labelsNC1.includes('circular-dependency') || labelsNC2.includes('circular-dependency')) {
        throw new Error('Issues should not have circular-dependency label');
      }
      results.push({ test: `${testNumber}. No circular dependency (normal)`, status: 'PASS', issues: [issueNC1.number, issueNC2.number] });
      console.log(`    ✅ ${testNumber}. No circular dependency (normal case)`);
    } catch (e) {
      results.push({ test: `${testNumber}. No circular dependency (normal)`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. No circular dependency: ${e.message}`);
    }

    // Case 17: Resolution by editing
    testNumber++;
    try {
      const issueR1 = await runner.createTestIssue('Resolution Test A', 'Initial content');
      const issueR2 = await runner.createTestIssue('Resolution Test B', `depends on #${issueR1.number}`);
      await runner.updateIssue(issueR1.number, { body: `depends on #${issueR2.number}` });
      await runner.sleep(15000);
      let labelsR1 = await runner.getIssueLabels(issueR1.number);
      if (!labelsR1.includes('circular-dependency')) {
        throw new Error('Issue A should initially have circular-dependency label');
      }
      await runner.updateIssue(issueR1.number, { body: 'No dependencies anymore' });
      await runner.sleep(15000);
      labelsR1 = await runner.getIssueLabels(issueR1.number);
      if (labelsR1.includes('circular-dependency')) {
        throw new Error('Issue A should not have circular-dependency label after resolution');
      }
      results.push({ test: `${testNumber}. Circular dependency resolution`, status: 'PASS', issues: [issueR1.number, issueR2.number] });
      console.log(`    ✅ ${testNumber}. Circular dependency resolved`);
    } catch (e) {
      results.push({ test: `${testNumber}. Circular dependency resolution`, status: 'FAIL', error: e.message });
      console.log(`    ❌ ${testNumber}. Circular dependency resolution: ${e.message}`);
    }

    // ========================================
    // Summary Report
    // ========================================
    console.log('\n  📊 Detection Layer Test Summary:\n');

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
      throw new Error(`Detection Layer Tests: ${failed}/${results.length} test cases failed`);
    }

    console.log('\n  ✅ All Detection Layer test cases passed!\n');
  });
};
