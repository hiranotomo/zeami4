/**
 * SettingsDialog Component
 *
 * Main settings dialog with tabbed interface for all setting categories.
 * Uses React Hook Form + Zod for validation.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Settings,
  settingsSchema,
  defaultSettings,
  presets,
} from '../../lib/settings-schema';
import { GitHubSettings } from './GitHubSettings';
import { GitSettings } from './GitSettings';
import { TerminalSettings } from './TerminalSettings';
import { UISettings } from './UISettings';
import { WorkflowSettings } from './WorkflowSettings';
import { ClaudeSettings } from './ClaudeSettings';
import { TestSettings } from './TestSettings';

// Tauri commands for settings persistence
import { invoke } from '@tauri-apps/api/tauri';

type TabId =
  | 'github'
  | 'git'
  | 'terminal'
  | 'ui'
  | 'workflow'
  | 'claude'
  | 'test';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'github', label: 'GitHub', icon: '🐙' },
  { id: 'git', label: 'Git', icon: '🌿' },
  { id: 'terminal', label: 'Terminal', icon: '💻' },
  { id: 'ui', label: 'UI', icon: '🎨' },
  { id: 'workflow', label: 'Workflow', icon: '⚡' },
  { id: 'claude', label: 'Claude', icon: '🤖' },
  { id: 'test', label: 'Test', icon: '🧪' },
];

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('github');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );

  // Initialize form with React Hook Form + Zod validation
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
    watch,
  } = useForm<Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultSettings,
  });

  // Load settings from Tauri backend
  const loadSettings = async () => {
    try {
      const settings = await invoke<Settings>('load_settings');
      reset(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Fallback to defaults
      reset(defaultSettings);
    }
  };

  // Save settings to Tauri backend
  const onSubmit = async (data: Settings) => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await invoke('save_settings', { settings: data });
      setSaveStatus('success');

      // Auto-hide success message after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Load preset configuration
  const loadPreset = (presetName: keyof typeof presets) => {
    const preset = presets[presetName];
    reset(preset);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    if (
      confirm(
        'Are you sure you want to reset all settings to defaults? This cannot be undone.'
      )
    ) {
      reset(defaultSettings);
    }
  };

  // Export settings to JSON file
  const exportSettings = async () => {
    try {
      const settings = watch();
      await invoke('export_settings', {
        settings,
        path: '~/Downloads/zeami-settings.json',
      });
      alert('Settings exported to ~/Downloads/zeami-settings.json');
    } catch (error) {
      console.error('Failed to export settings:', error);
      alert('Failed to export settings');
    }
  };

  // Import settings from JSON file
  const importSettings = async () => {
    try {
      // Open file picker dialog
      const path = await invoke<string>('pick_settings_file');
      const settings = await invoke<Settings>('import_settings', { path });

      // Validate imported settings
      const validated = settingsSchema.parse(settings);
      reset(validated);

      alert('Settings imported successfully');
    } catch (error) {
      console.error('Failed to import settings:', error);
      alert('Failed to import settings: Invalid format');
    }
  };

  // Load settings on mount
  useState(() => {
    if (isOpen) {
      loadSettings();
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-5xl h-[90vh] bg-gray-900 rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <div className="flex items-center gap-3">
            {/* Save Status */}
            {saveStatus === 'success' && (
              <span className="text-sm text-green-400">Saved!</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-400">Save failed</span>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Tabs */}
          <div className="w-48 bg-gray-800 border-r border-gray-700 overflow-y-auto">
            <nav className="py-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full px-6 py-3 text-left flex items-center gap-3 transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-700 text-white border-l-4 border-blue-500'
                      : 'text-gray-400 hover:bg-gray-750 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Preset Selector */}
            <div className="px-4 py-4 border-t border-gray-700">
              <label className="block text-xs text-gray-400 mb-2">
                Load Preset
              </label>
              <select
                onChange={(e) => loadPreset(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded text-sm"
              >
                <option value="">Choose preset...</option>
                <option value="minimal">Minimal</option>
                <option value="recommended">Recommended</option>
                <option value="powerUser">Power User</option>
                <option value="teamCollaboration">Team Collaboration</option>
              </select>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit(onSubmit)} className="p-6">
              {/* Render active tab content */}
              {activeTab === 'github' && (
                <GitHubSettings control={control} errors={errors.github} />
              )}
              {activeTab === 'git' && (
                <GitSettings control={control} errors={errors.git} />
              )}
              {activeTab === 'terminal' && (
                <TerminalSettings control={control} errors={errors.terminal} />
              )}
              {activeTab === 'ui' && (
                <UISettings control={control} errors={errors.ui} />
              )}
              {activeTab === 'workflow' && (
                <WorkflowSettings control={control} errors={errors.workflow} />
              )}
              {activeTab === 'claude' && (
                <ClaudeSettings control={control} errors={errors.claude} />
              )}
              {activeTab === 'test' && (
                <TestSettings control={control} errors={errors.test} />
              )}
            </form>
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-800">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportSettings}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Export
            </button>
            <button
              type="button"
              onClick={importSettings}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Import
            </button>
            <button
              type="button"
              onClick={resetToDefaults}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit(onSubmit)}
              disabled={!isDirty || isSaving}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
