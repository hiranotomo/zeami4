/**
 * Zeami Settings Schema
 *
 * Complete type-safe settings schema using Zod.
 * This is the single source of truth for all settings validation.
 */

import { z } from 'zod';

// ============================================================================
// GitHub Settings
// ============================================================================

export const githubSettingsSchema = z.object({
  enabled: z.boolean().default(true),

  // Authentication
  token: z.string()
    .min(1, 'GitHub token is required')
    .regex(/^ghp_[a-zA-Z0-9]{36}$/, 'Invalid GitHub token format (must be ghp_...)')
    .describe('Personal Access Token for GitHub API'),

  // Repository
  repository: z.string()
    .min(1, 'Repository is required')
    .regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/, 'Invalid format (must be owner/repo)')
    .describe('Default repository (owner/repo)'),

  defaultBranch: z.string()
    .default('main')
    .describe('Default branch name'),

  // API Configuration
  apiUrl: z.string()
    .url('Must be a valid URL')
    .default('https://api.github.com')
    .describe('GitHub API URL (for GitHub Enterprise)'),

  timeout: z.number()
    .int()
    .min(1000, 'Timeout must be at least 1 second')
    .max(60000, 'Timeout must be at most 60 seconds')
    .default(30000)
    .describe('API request timeout (milliseconds)'),

  // Features
  autoLinkIssues: z.boolean()
    .default(true)
    .describe('Automatically link commits to issues'),

  autoCreateBranch: z.boolean()
    .default(true)
    .describe('Auto-create branch when starting work on issue'),

  branchPrefix: z.string()
    .default('issue-')
    .describe('Prefix for auto-created branches'),

  // Pull Requests
  prTemplate: z.string()
    .optional()
    .describe('Default pull request template'),

  autoAssignReviewers: z.boolean()
    .default(false)
    .describe('Automatically assign reviewers to PRs'),

  defaultReviewers: z.array(z.string())
    .default([])
    .describe('Default reviewers (GitHub usernames)'),
});

// ============================================================================
// Git Settings
// ============================================================================

export const gitSettingsSchema = z.object({
  // User Configuration
  userName: z.string()
    .min(1, 'User name is required')
    .describe('Git user name'),

  userEmail: z.string()
    .email('Invalid email format')
    .describe('Git user email'),

  // Commit Settings
  signCommits: z.boolean()
    .default(false)
    .describe('Sign commits with GPG'),

  gpgKeyId: z.string()
    .optional()
    .describe('GPG key ID for signing commits'),

  commitTemplate: z.string()
    .default('')
    .describe('Default commit message template'),

  // Branch Settings
  defaultBranch: z.string()
    .default('main')
    .describe('Default branch name for new repos'),

  autoFetch: z.boolean()
    .default(true)
    .describe('Automatically fetch remote changes'),

  fetchInterval: z.number()
    .int()
    .min(60, 'Fetch interval must be at least 60 seconds')
    .max(3600, 'Fetch interval must be at most 1 hour')
    .default(300)
    .describe('Auto-fetch interval (seconds)'),

  // Merge Settings
  mergeStrategy: z.enum(['merge', 'rebase', 'squash'])
    .default('merge')
    .describe('Default merge strategy'),

  autoCleanBranches: z.boolean()
    .default(true)
    .describe('Auto-delete merged branches'),
});

// ============================================================================
// Terminal Settings
// ============================================================================

export const terminalSettingsSchema = z.object({
  // Shell
  shell: z.enum(['bash', 'zsh', 'fish', 'sh'])
    .default('zsh')
    .describe('Default shell'),

  customShellPath: z.string()
    .optional()
    .describe('Custom shell path (overrides shell selection)'),

  // Appearance
  theme: z.enum(['dark', 'light', 'dracula', 'monokai', 'nord', 'solarized'])
    .default('dark')
    .describe('Terminal color theme'),

  fontSize: z.number()
    .int()
    .min(8, 'Font size must be at least 8')
    .max(32, 'Font size must be at most 32')
    .default(14)
    .describe('Font size (pixels)'),

  fontFamily: z.string()
    .default('Monaco, Menlo, Consolas, monospace')
    .describe('Font family'),

  lineHeight: z.number()
    .min(1.0, 'Line height must be at least 1.0')
    .max(2.0, 'Line height must be at most 2.0')
    .default(1.2)
    .describe('Line height multiplier'),

  // Behavior
  scrollback: z.number()
    .int()
    .min(100, 'Scrollback must be at least 100 lines')
    .max(100000, 'Scrollback must be at most 100000 lines')
    .default(10000)
    .describe('Scrollback buffer size (lines)'),

  cursorBlink: z.boolean()
    .default(true)
    .describe('Cursor blink animation'),

  cursorStyle: z.enum(['block', 'underline', 'bar'])
    .default('block')
    .describe('Cursor style'),

  // Features
  enableBellSound: z.boolean()
    .default(false)
    .describe('Enable terminal bell sound'),

  enableWebLinks: z.boolean()
    .default(true)
    .describe('Click-able URLs in terminal'),

  enableCopyOnSelect: z.boolean()
    .default(false)
    .describe('Copy text automatically on selection'),
});

// ============================================================================
// UI Settings
// ============================================================================

export const uiSettingsSchema = z.object({
  // Theme
  theme: z.enum(['dark', 'light', 'auto'])
    .default('dark')
    .describe('Application theme'),

  accentColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
    .default('#3b82f6')
    .describe('Accent color (hex)'),

  // Layout
  sidebarPosition: z.enum(['left', 'right'])
    .default('left')
    .describe('Sidebar position'),

  sidebarWidth: z.number()
    .int()
    .min(200, 'Sidebar width must be at least 200px')
    .max(600, 'Sidebar width must be at most 600px')
    .default(300)
    .describe('Sidebar width (pixels)'),

  compactMode: z.boolean()
    .default(false)
    .describe('Compact UI mode'),

  // Notifications
  showNotifications: z.boolean()
    .default(true)
    .describe('Show desktop notifications'),

  notificationSound: z.boolean()
    .default(false)
    .describe('Play sound with notifications'),

  notificationPosition: z.enum(['top-right', 'top-left', 'bottom-right', 'bottom-left'])
    .default('top-right')
    .describe('Notification position'),

  // Misc
  showWelcomeScreen: z.boolean()
    .default(true)
    .describe('Show welcome screen on startup'),

  confirmBeforeQuit: z.boolean()
    .default(false)
    .describe('Confirm before quitting application'),

  language: z.enum(['en', 'ja'])
    .default('en')
    .describe('Application language'),
});

// ============================================================================
// Workflow Settings
// ============================================================================

export const workflowSettingsSchema = z.object({
  // Auto-commit
  autoCommit: z.boolean()
    .default(false)
    .describe('Automatically commit changes'),

  autoCommitInterval: z.number()
    .int()
    .min(60, 'Auto-commit interval must be at least 60 seconds')
    .max(3600, 'Auto-commit interval must be at most 1 hour')
    .default(300)
    .describe('Auto-commit interval (seconds)'),

  autoCommitMessage: z.string()
    .default('WIP: Auto-save')
    .describe('Auto-commit message prefix'),

  // Testing
  autoRunTests: z.boolean()
    .default(false)
    .describe('Automatically run tests on save'),

  autoRunTestsPattern: z.string()
    .default('**/*.test.{ts,tsx,js,jsx}')
    .describe('File pattern to trigger test runs'),

  testCommand: z.string()
    .default('npm test')
    .describe('Test command to run'),

  // Builds
  autoBuild: z.boolean()
    .default(false)
    .describe('Automatically build on file changes'),

  buildCommand: z.string()
    .default('npm run build')
    .describe('Build command to run'),

  // Issue Workflow
  autoCloseIssueOnPR: z.boolean()
    .default(false)
    .describe('Auto-close issue when PR is merged'),

  autoSyncProgress: z.boolean()
    .default(true)
    .describe('Automatically sync progress to GitHub issue'),

  syncProgressInterval: z.number()
    .int()
    .min(60, 'Sync interval must be at least 60 seconds')
    .max(3600, 'Sync interval must be at most 1 hour')
    .default(600)
    .describe('Progress sync interval (seconds)'),

  // Pre-commit Hooks
  runLintOnCommit: z.boolean()
    .default(true)
    .describe('Run linter before commit'),

  runFormatOnCommit: z.boolean()
    .default(true)
    .describe('Run formatter before commit'),

  runTestsOnCommit: z.boolean()
    .default(false)
    .describe('Run tests before commit'),
});

// ============================================================================
// Claude Settings
// ============================================================================

export const claudeSettingsSchema = z.object({
  // API
  apiKey: z.string()
    .min(1, 'API key is required')
    .describe('Claude API key (stored in Keychain)'),

  // Model
  model: z.enum([
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-3-5-20241022',
    'claude-opus-4-20250514',
    'claude-haiku-3-5-20241022',
  ])
    .default('claude-sonnet-4-5-20250929')
    .describe('Claude model to use'),

  // Parameters
  temperature: z.number()
    .min(0, 'Temperature must be between 0 and 1')
    .max(1, 'Temperature must be between 0 and 1')
    .default(1.0)
    .describe('Response randomness (0 = deterministic, 1 = creative)'),

  maxTokens: z.number()
    .int()
    .min(100, 'Max tokens must be at least 100')
    .max(200000, 'Max tokens must be at most 200000')
    .default(8192)
    .describe('Maximum tokens in response'),

  // System Prompts
  systemPrompt: z.string()
    .default('')
    .describe('Custom system prompt'),

  customInstructions: z.string()
    .default('')
    .describe('Additional instructions for every request'),

  // Context
  includeProjectContext: z.boolean()
    .default(true)
    .describe('Include project files in context'),

  maxContextFiles: z.number()
    .int()
    .min(1, 'Must include at least 1 file')
    .max(100, 'Must include at most 100 files')
    .default(20)
    .describe('Maximum number of files to include in context'),

  excludePatterns: z.array(z.string())
    .default(['node_modules/**', 'dist/**', 'build/**', '.git/**'])
    .describe('File patterns to exclude from context'),

  // Features
  enableStreaming: z.boolean()
    .default(true)
    .describe('Stream responses (faster perceived response)'),

  enableCaching: z.boolean()
    .default(true)
    .describe('Cache system prompts (reduces costs)'),
});

// ============================================================================
// Test Settings
// ============================================================================

export const testSettingsSchema = z.object({
  // Framework
  framework: z.enum(['jest', 'vitest', 'playwright', 'cypress'])
    .default('jest')
    .describe('Test framework'),

  // Configuration
  configPath: z.string()
    .default('')
    .describe('Path to test configuration file'),

  testMatch: z.array(z.string())
    .default(['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'])
    .describe('Test file patterns'),

  // Coverage
  collectCoverage: z.boolean()
    .default(true)
    .describe('Collect test coverage'),

  coverageThreshold: z.number()
    .int()
    .min(0, 'Coverage threshold must be between 0 and 100')
    .max(100, 'Coverage threshold must be between 0 and 100')
    .default(80)
    .describe('Minimum coverage threshold (percentage)'),

  coverageReportFormats: z.array(z.enum(['text', 'html', 'json', 'lcov']))
    .default(['text', 'html'])
    .describe('Coverage report formats'),

  // Execution
  maxConcurrency: z.number()
    .int()
    .min(1, 'Max concurrency must be at least 1')
    .max(32, 'Max concurrency must be at most 32')
    .default(4)
    .describe('Maximum number of parallel test workers'),

  timeout: z.number()
    .int()
    .min(1000, 'Timeout must be at least 1 second')
    .max(300000, 'Timeout must be at most 5 minutes')
    .default(30000)
    .describe('Test timeout (milliseconds)'),

  retries: z.number()
    .int()
    .min(0, 'Retries must be at least 0')
    .max(5, 'Retries must be at most 5')
    .default(0)
    .describe('Number of retries for failing tests'),

  // E2E Tests (Playwright/Cypress)
  baseUrl: z.string()
    .url('Must be a valid URL')
    .default('http://localhost:3000')
    .describe('Base URL for E2E tests'),

  headless: z.boolean()
    .default(true)
    .describe('Run E2E tests in headless mode'),

  slowMo: z.number()
    .int()
    .min(0, 'Slow motion must be at least 0ms')
    .max(1000, 'Slow motion must be at most 1000ms')
    .default(0)
    .describe('Slow down E2E tests (milliseconds)'),
});

// ============================================================================
// Root Settings Schema
// ============================================================================

export const settingsSchema = z.object({
  github: githubSettingsSchema,
  git: gitSettingsSchema,
  terminal: terminalSettingsSchema,
  ui: uiSettingsSchema,
  workflow: workflowSettingsSchema,
  claude: claudeSettingsSchema,
  test: testSettingsSchema,
});

// ============================================================================
// TypeScript Types (auto-generated from schema)
// ============================================================================

export type GitHubSettings = z.infer<typeof githubSettingsSchema>;
export type GitSettings = z.infer<typeof gitSettingsSchema>;
export type TerminalSettings = z.infer<typeof terminalSettingsSchema>;
export type UISettings = z.infer<typeof uiSettingsSchema>;
export type WorkflowSettings = z.infer<typeof workflowSettingsSchema>;
export type ClaudeSettings = z.infer<typeof claudeSettingsSchema>;
export type TestSettings = z.infer<typeof testSettingsSchema>;

export type Settings = z.infer<typeof settingsSchema>;

// ============================================================================
// Default Settings
// ============================================================================

export const defaultSettings: Settings = {
  github: {
    enabled: true,
    token: '',
    repository: '',
    defaultBranch: 'main',
    apiUrl: 'https://api.github.com',
    timeout: 30000,
    autoLinkIssues: true,
    autoCreateBranch: true,
    branchPrefix: 'issue-',
    autoAssignReviewers: false,
    defaultReviewers: [],
  },
  git: {
    userName: '',
    userEmail: '',
    signCommits: false,
    commitTemplate: '',
    defaultBranch: 'main',
    autoFetch: true,
    fetchInterval: 300,
    mergeStrategy: 'merge',
    autoCleanBranches: true,
  },
  terminal: {
    shell: 'zsh',
    theme: 'dark',
    fontSize: 14,
    fontFamily: 'Monaco, Menlo, Consolas, monospace',
    lineHeight: 1.2,
    scrollback: 10000,
    cursorBlink: true,
    cursorStyle: 'block',
    enableBellSound: false,
    enableWebLinks: true,
    enableCopyOnSelect: false,
  },
  ui: {
    theme: 'dark',
    accentColor: '#3b82f6',
    sidebarPosition: 'left',
    sidebarWidth: 300,
    compactMode: false,
    showNotifications: true,
    notificationSound: false,
    notificationPosition: 'top-right',
    showWelcomeScreen: true,
    confirmBeforeQuit: false,
    language: 'en',
  },
  workflow: {
    autoCommit: false,
    autoCommitInterval: 300,
    autoCommitMessage: 'WIP: Auto-save',
    autoRunTests: false,
    autoRunTestsPattern: '**/*.test.{ts,tsx,js,jsx}',
    testCommand: 'npm test',
    autoBuild: false,
    buildCommand: 'npm run build',
    autoCloseIssueOnPR: false,
    autoSyncProgress: true,
    syncProgressInterval: 600,
    runLintOnCommit: true,
    runFormatOnCommit: true,
    runTestsOnCommit: false,
  },
  claude: {
    apiKey: '',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 1.0,
    maxTokens: 8192,
    systemPrompt: '',
    customInstructions: '',
    includeProjectContext: true,
    maxContextFiles: 20,
    excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
    enableStreaming: true,
    enableCaching: true,
  },
  test: {
    framework: 'jest',
    configPath: '',
    testMatch: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
    collectCoverage: true,
    coverageThreshold: 80,
    coverageReportFormats: ['text', 'html'],
    maxConcurrency: 4,
    timeout: 30000,
    retries: 0,
    baseUrl: 'http://localhost:3000',
    headless: true,
    slowMo: 0,
  },
};

// ============================================================================
// Preset Configurations
// ============================================================================

export const presets = {
  minimal: {
    ...defaultSettings,
    github: {
      ...defaultSettings.github,
      autoLinkIssues: false,
      autoCreateBranch: false,
    },
    workflow: {
      ...defaultSettings.workflow,
      autoSyncProgress: false,
      runLintOnCommit: false,
      runFormatOnCommit: false,
    },
  } as Settings,

  recommended: defaultSettings,

  powerUser: {
    ...defaultSettings,
    workflow: {
      ...defaultSettings.workflow,
      autoCommit: true,
      autoRunTests: true,
      autoBuild: true,
      autoCloseIssueOnPR: true,
      runTestsOnCommit: true,
    },
    claude: {
      ...defaultSettings.claude,
      model: 'claude-sonnet-4-5-20250929',
      maxTokens: 16384,
    },
  } as Settings,

  teamCollaboration: {
    ...defaultSettings,
    github: {
      ...defaultSettings.github,
      autoAssignReviewers: true,
    },
    workflow: {
      ...defaultSettings.workflow,
      autoSyncProgress: true,
      syncProgressInterval: 300,
      runLintOnCommit: true,
      runFormatOnCommit: true,
      runTestsOnCommit: true,
    },
    test: {
      ...defaultSettings.test,
      collectCoverage: true,
      coverageThreshold: 90,
    },
  } as Settings,
};
