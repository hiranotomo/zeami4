/**
 * GitHub Settings Tab
 *
 * Settings for GitHub integration including token, repository, and API configuration.
 */

import { Control, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Settings, GitHubSettings as GitHubSettingsType } from '../../lib/settings-schema';
import { PasswordField } from './widgets/PasswordField';
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface GitHubSettingsProps {
  control: Control<Settings>;
  errors?: FieldErrors<GitHubSettingsType>;
}

interface TokenValidation {
  valid: boolean;
  username?: string;
  scopes?: string[];
}

export function GitHubSettings({ control, errors }: GitHubSettingsProps) {
  const [testingToken, setTestingToken] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<TokenValidation | null>(null);

  const testGitHubToken = async (token: string) => {
    if (!token) return;

    setTestingToken(true);
    setTokenValidation(null);

    try {
      const result = await invoke<TokenValidation>('test_github_token', { token });
      setTokenValidation(result);
    } catch (error) {
      setTokenValidation({ valid: false });
    } finally {
      setTestingToken(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-white mb-2">GitHub Integration</h3>
        <p className="text-sm text-gray-400">
          Configure GitHub API access and repository settings.
        </p>
      </div>

      {/* Enable GitHub Integration */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <Controller
            name="github.enabled"
            control={control}
            render={({ field }) => (
              <input
                type="checkbox"
                checked={field.value}
                onChange={field.onChange}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
              />
            )}
          />
          <div>
            <span className="text-white font-medium">Enable GitHub Integration</span>
            <p className="text-sm text-gray-400">
              Link commits to issues and manage pull requests
            </p>
          </div>
        </label>
      </div>

      {/* GitHub Token */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          Personal Access Token *
        </label>
        <Controller
          name="github.token"
          control={control}
          render={({ field }) => (
            <PasswordField
              value={field.value}
              onChange={field.onChange}
              placeholder="ghp_..."
              error={errors?.token?.message}
            />
          )}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Create a token at{' '}
            <a
              href="https://github.com/settings/tokens/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              github.com/settings/tokens
            </a>
            <br />
            Required scopes: repo, workflow
          </p>
          <Controller
            name="github.token"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => testGitHubToken(field.value)}
                disabled={!field.value || testingToken}
                className="px-4 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                {testingToken ? 'Testing...' : 'Test Token'}
              </button>
            )}
          />
        </div>
        {tokenValidation && (
          <div
            className={`p-3 rounded ${
              tokenValidation.valid
                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}
          >
            {tokenValidation.valid ? (
              <div>
                <p className="font-medium">Token is valid!</p>
                <p className="text-sm">Username: {tokenValidation.username}</p>
                <p className="text-sm">
                  Scopes: {tokenValidation.scopes?.join(', ')}
                </p>
              </div>
            ) : (
              <p>Token is invalid or has insufficient permissions</p>
            )}
          </div>
        )}
      </div>

      {/* Repository */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          Default Repository *
        </label>
        <Controller
          name="github.repository"
          control={control}
          render={({ field }) => (
            <input
              type="text"
              {...field}
              placeholder="owner/repo"
              className="w-full px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          )}
        />
        {errors?.repository && (
          <p className="text-sm text-red-400">{errors.repository.message}</p>
        )}
        <p className="text-xs text-gray-400">
          Format: owner/repository (e.g., facebook/react)
        </p>
      </div>

      {/* Default Branch */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          Default Branch
        </label>
        <Controller
          name="github.defaultBranch"
          control={control}
          render={({ field }) => (
            <input
              type="text"
              {...field}
              placeholder="main"
              className="w-full px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          )}
        />
        <p className="text-xs text-gray-400">
          Default branch for new pull requests
        </p>
      </div>

      {/* API Configuration */}
      <div className="pt-6 border-t border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4">
          API Configuration
        </h4>

        <div className="space-y-4">
          {/* API URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              GitHub API URL
            </label>
            <Controller
              name="github.apiUrl"
              control={control}
              render={({ field }) => (
                <input
                  type="url"
                  {...field}
                  placeholder="https://api.github.com"
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              )}
            />
            {errors?.apiUrl && (
              <p className="text-sm text-red-400">{errors.apiUrl.message}</p>
            )}
            <p className="text-xs text-gray-400">
              For GitHub Enterprise, use your instance URL
            </p>
          </div>

          {/* Timeout */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              API Timeout (seconds)
            </label>
            <Controller
              name="github.timeout"
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  min={1}
                  max={60}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              )}
            />
            <p className="text-xs text-gray-400">
              Request timeout in seconds (1-60)
            </p>
          </div>
        </div>
      </div>

      {/* Branch Settings */}
      <div className="pt-6 border-t border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4">
          Branch Management
        </h4>

        <div className="space-y-4">
          {/* Auto Link Issues */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Controller
              name="github.autoLinkIssues"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
              )}
            />
            <div>
              <span className="text-white font-medium">Auto-link Issues</span>
              <p className="text-sm text-gray-400">
                Automatically link commits to issues in commit messages
              </p>
            </div>
          </label>

          {/* Auto Create Branch */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Controller
              name="github.autoCreateBranch"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
              )}
            />
            <div>
              <span className="text-white font-medium">Auto-create Branches</span>
              <p className="text-sm text-gray-400">
                Create a new branch automatically when starting work on an issue
              </p>
            </div>
          </label>

          {/* Branch Prefix */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Branch Prefix
            </label>
            <Controller
              name="github.branchPrefix"
              control={control}
              render={({ field }) => (
                <input
                  type="text"
                  {...field}
                  placeholder="issue-"
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              )}
            />
            <p className="text-xs text-gray-400">
              Prefix for auto-created branches (e.g., "issue-" → "issue-123")
            </p>
          </div>
        </div>
      </div>

      {/* Pull Request Settings */}
      <div className="pt-6 border-t border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4">
          Pull Request Settings
        </h4>

        <div className="space-y-4">
          {/* PR Template */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Pull Request Template
            </label>
            <Controller
              name="github.prTemplate"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={6}
                  placeholder="## Summary&#10;&#10;## Changes&#10;&#10;## Testing"
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none font-mono text-sm"
                />
              )}
            />
            <p className="text-xs text-gray-400">
              Default template for pull request descriptions (supports Markdown)
            </p>
          </div>

          {/* Auto Assign Reviewers */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Controller
              name="github.autoAssignReviewers"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
              )}
            />
            <div>
              <span className="text-white font-medium">
                Auto-assign Reviewers
              </span>
              <p className="text-sm text-gray-400">
                Automatically assign reviewers when creating pull requests
              </p>
            </div>
          </label>

          {/* Default Reviewers */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Default Reviewers
            </label>
            <Controller
              name="github.defaultReviewers"
              control={control}
              render={({ field }) => (
                <input
                  type="text"
                  value={field.value.join(', ')}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                    )
                  }
                  placeholder="username1, username2"
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              )}
            />
            <p className="text-xs text-gray-400">
              Comma-separated list of GitHub usernames
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
