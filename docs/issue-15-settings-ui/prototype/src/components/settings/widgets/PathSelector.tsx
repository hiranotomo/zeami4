/**
 * PathSelector Widget
 *
 * File/directory path selector with file picker dialog.
 */

import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';

interface PathSelectorProps {
  value: string;
  onChange: (value: string) => void;
  type: 'file' | 'directory';
  label?: string;
  placeholder?: string;
  error?: string;
  validateExists?: boolean;
}

export function PathSelector({
  value,
  onChange,
  type,
  label,
  placeholder,
  error,
  validateExists = true,
}: PathSelectorProps) {
  const openPicker = async () => {
    try {
      const selected = await open({
        directory: type === 'directory',
        multiple: false,
        defaultPath: value || undefined,
      });

      if (selected && typeof selected === 'string') {
        onChange(selected);
      }
    } catch (error) {
      console.error('Failed to open file picker:', error);
    }
  };

  const validatePath = async () => {
    if (!value || !validateExists) return;

    try {
      const result = await invoke<{ exists: boolean; isDirectory: boolean }>(
        'validate_path',
        { path: value }
      );

      if (!result.exists) {
        return 'Path does not exist';
      }

      if (type === 'directory' && !result.isDirectory) {
        return 'Path is not a directory';
      }

      if (type === 'file' && result.isDirectory) {
        return 'Path is not a file';
      }
    } catch (error) {
      return 'Failed to validate path';
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-white">{label}</label>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={validatePath}
          placeholder={placeholder}
          className={`flex-1 px-4 py-2 bg-gray-800 text-white rounded border ${
            error ? 'border-red-500' : 'border-gray-700'
          } focus:border-blue-500 focus:outline-none font-mono text-sm`}
        />

        <button
          type="button"
          onClick={openPicker}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          Browse
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
