# Settings UI Implementation Guide

## Quick Start

This guide walks you through implementing the auto-generated settings UI for Zeami.

---

## 1. Install Dependencies

### Frontend (TypeScript/React)

```bash
cd zeami4

# Install form and validation libraries
npm install react-hook-form zod @hookform/resolvers

# Install UI components (if using shadcn/ui)
# Note: You already have Tailwind CSS configured

# Install Tauri API (already installed)
# @tauri-apps/api is already in dependencies
```

### Backend (Rust)

Update `src-tauri/Cargo.toml`:

```toml
[dependencies]
# Existing dependencies...
tauri = { version = "1.5.4", features = ["shell-open", "protocol-asset", "fs-all", "dialog-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
anyhow = "1.0"
thiserror = "1.0"
dirs = "5.0"
chrono = { version = "0.4", features = ["serde"] }

# New dependencies for settings
security-framework = "2.9"  # macOS Keychain
octocrab = "0.38"           # GitHub API (already in project)
shellexpand = "3.1"         # Shell path expansion
```

---

## 2. File Structure

Copy the prototype files to your project:

```
zeami4/
├── src/
│   ├── components/
│   │   └── settings/
│   │       ├── SettingsDialog.tsx          # Main dialog
│   │       ├── GitHubSettings.tsx          # GitHub tab
│   │       ├── GitSettings.tsx             # Git tab
│   │       ├── TerminalSettings.tsx        # Terminal tab
│   │       ├── UISettings.tsx              # UI tab
│   │       ├── WorkflowSettings.tsx        # Workflow tab
│   │       ├── ClaudeSettings.tsx          # Claude tab
│   │       ├── TestSettings.tsx            # Test tab
│   │       └── widgets/
│   │           ├── PasswordField.tsx       # Password with reveal
│   │           ├── ColorPicker.tsx         # Color picker
│   │           └── PathSelector.tsx        # File/directory picker
│   └── lib/
│       ├── settings-schema.ts              # Zod schema
│       └── settings-storage.ts             # Tauri command wrappers
│
└── src-tauri/
    └── src/
        ├── config/
        │   ├── mod.rs                      # Public API
        │   ├── storage.rs                  # File-based storage
        │   ├── keychain.rs                 # Keychain integration
        │   ├── migration.rs                # Schema migration
        │   └── backup.rs                   # Backup/restore
        └── commands/
            └── settings_commands.rs        # Tauri commands
```

---

## 3. Setup Backend (Rust)

### Step 1: Add Config Module

1. Copy all files from `prototype/src-tauri/src/config/` to `src-tauri/src/config/`
2. Copy `prototype/src-tauri/src/commands/settings_commands.rs` to `src-tauri/src/commands/`

### Step 2: Update `src-tauri/src/main.rs`

```rust
// Add at top
mod config;
mod commands;

use commands::settings_commands::*;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Existing commands...
            greet,
            create_pty_session,
            write_to_pty,
            resize_pty,
            close_pty_session,

            // New settings commands
            load_settings,
            save_settings,
            reset_settings,
            export_settings,
            import_settings,
            test_github_token,
            validate_repository,
            validate_path,
            list_backups,
            restore_backup,
            delete_backup,
            test_keychain_access,
            pick_settings_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Step 3: Build and Test

```bash
cd src-tauri
cargo build
cargo test
```

---

## 4. Setup Frontend (TypeScript/React)

### Step 1: Add Schema and Components

1. Copy `prototype/src/lib/settings-schema.ts` to `src/lib/`
2. Copy all files from `prototype/src/components/settings/` to `src/components/settings/`

### Step 2: Create Tauri Command Wrapper

Create `src/lib/settings-storage.ts`:

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { Settings } from './settings-schema';

export async function loadSettings(): Promise<Settings> {
  return await invoke('load_settings');
}

export async function saveSettings(settings: Settings): Promise<void> {
  await invoke('save_settings', { settings });
}

export async function resetSettings(): Promise<Settings> {
  return await invoke('reset_settings');
}

export async function exportSettings(
  settings: Settings,
  path: string
): Promise<void> {
  await invoke('export_settings', { settings, path });
}

export async function importSettings(path: string): Promise<Settings> {
  return await invoke('import_settings', { path });
}

export async function testGitHubToken(token: string) {
  return await invoke('test_github_token', { token });
}

export async function validateRepository(
  owner: string,
  repo: string,
  token: string
) {
  return await invoke('validate_repository', { owner, repo, token });
}

export async function validatePath(path: string) {
  return await invoke('validate_path', { path });
}
```

### Step 3: Integrate into App

Update `src/App.tsx` to add settings button:

```typescript
import { useState } from 'react';
import { SettingsDialog } from './components/settings/SettingsDialog';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">zeami4</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            data-testid="settings-button"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Your existing app content */}

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
```

---

## 5. Add Remaining Setting Tabs

The prototype includes `GitHubSettings.tsx`. You need to create the remaining tabs following the same pattern:

### Template for Other Tabs

```typescript
// Example: GitSettings.tsx
import { Control, FieldErrors, Controller } from 'react-hook-form';
import { Settings, GitSettings as GitSettingsType } from '../../lib/settings-schema';

interface GitSettingsProps {
  control: Control<Settings>;
  errors?: FieldErrors<GitSettingsType>;
}

export function GitSettings({ control, errors }: GitSettingsProps) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Git Configuration</h3>
        <p className="text-sm text-gray-400">
          Configure Git user settings and commit preferences.
        </p>
      </div>

      {/* User Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          User Name *
        </label>
        <Controller
          name="git.userName"
          control={control}
          render={({ field }) => (
            <input
              type="text"
              {...field}
              placeholder="Your Name"
              className="w-full px-4 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          )}
        />
        {errors?.userName && (
          <p className="text-sm text-red-400">{errors.userName.message}</p>
        )}
      </div>

      {/* Add more fields... */}
    </div>
  );
}
```

Create similar files for:
- `TerminalSettings.tsx`
- `UISettings.tsx` (use ColorPicker widget for accent color)
- `WorkflowSettings.tsx`
- `ClaudeSettings.tsx` (use PasswordField for API key)
- `TestSettings.tsx`

---

## 6. Testing

### Backend Tests

```bash
cd src-tauri
cargo test
```

### Frontend Tests

Create `src/components/settings/SettingsDialog.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from './SettingsDialog';

// Mock Tauri API
jest.mock('@tauri-apps/api/tauri', () => ({
  invoke: jest.fn(),
}));

describe('SettingsDialog', () => {
  it('renders when open', () => {
    render(<SettingsDialog isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <SettingsDialog isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('switches tabs correctly', async () => {
    render(<SettingsDialog isOpen={true} onClose={() => {}} />);

    const gitTab = screen.getByText('Git');
    await userEvent.click(gitTab);

    expect(screen.getByText('Git Configuration')).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

Create `tests/settings.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('settings dialog workflow', async ({ page }) => {
  await page.goto('http://localhost:1420'); // Tauri dev server

  // Open settings
  await page.click('[data-testid="settings-button"]');
  await expect(page.locator('text=Settings')).toBeVisible();

  // Navigate to GitHub tab
  await page.click('text=GitHub');
  await expect(page.locator('text=GitHub Integration')).toBeVisible();

  // Fill in repository
  await page.fill('[name="github.repository"]', 'owner/repo');

  // Save settings
  await page.click('text=Save Changes');
  await expect(page.locator('text=Saved!')).toBeVisible();

  // Close and reopen to verify persistence
  await page.click('[data-testid="close-settings"]');
  await page.click('[data-testid="settings-button"]');

  const repoInput = await page.inputValue('[name="github.repository"]');
  expect(repoInput).toBe('owner/repo');
});
```

---

## 7. Command Palette Integration

Add settings commands to your command palette:

```typescript
// src/lib/command-palette.ts
export const settingsCommands = [
  {
    id: 'settings.open',
    label: 'Open Settings',
    shortcut: 'Cmd+,',
    action: () => openSettings(),
  },
  {
    id: 'settings.github',
    label: 'Settings: GitHub',
    action: () => openSettings('github'),
  },
  {
    id: 'settings.terminal',
    label: 'Settings: Terminal',
    action: () => openSettings('terminal'),
  },
  {
    id: 'settings.export',
    label: 'Export Settings',
    action: () => exportSettingsDialog(),
  },
  {
    id: 'settings.import',
    label: 'Import Settings',
    action: () => importSettingsDialog(),
  },
];
```

---

## 8. Keyboard Shortcuts

Add global keyboard shortcuts:

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

export function useKeyboardShortcuts(callbacks: {
  onOpenSettings: () => void;
}) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd+, or Ctrl+, to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        callbacks.onOpenSettings();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [callbacks]);
}

// In App.tsx:
useKeyboardShortcuts({
  onOpenSettings: () => setShowSettings(true),
});
```

---

## 9. Migration Strategy

When updating the settings schema:

1. **Increment schema version** in `config/mod.rs`:
   ```rust
   pub const CURRENT_SCHEMA_VERSION: u32 = 2; // was 1
   ```

2. **Add migration function** in `config/migration.rs`:
   ```rust
   fn migrate_v1_to_v2(config: &mut Value) -> Result<()> {
       // Add new fields
       if let Some(workflow) = config.get_mut("workflow") {
           workflow["new_field"] = json!("default_value");
       }

       // Rename fields
       if let Some(old_field) = config.get("old_field").cloned() {
           config["new_field"] = old_field;
           config.as_object_mut().unwrap().remove("old_field");
       }

       Ok(())
   }
   ```

3. **Update migration dispatcher**:
   ```rust
   pub fn migrate_config(old_version: u32, config: &mut Value) -> Result<()> {
       let mut current_version = old_version;

       while current_version < CURRENT_SCHEMA_VERSION {
           match current_version {
               0 => migrate_v0_to_v1(config)?,
               1 => migrate_v1_to_v2(config)?, // Add this
               _ => bail!("Unsupported version"),
           }
           current_version += 1;
       }

       Ok(())
   }
   ```

4. **Test migration**:
   ```bash
   cargo test test_migrate_v1_to_v2
   ```

---

## 10. Production Checklist

Before deploying:

- [ ] All settings tabs implemented
- [ ] Validation working (GitHub token, repository, paths)
- [ ] Keychain integration tested on macOS
- [ ] Import/export working
- [ ] Backup/restore tested
- [ ] Migration tested with old config files
- [ ] Keyboard shortcuts working
- [ ] E2E tests passing
- [ ] Error handling comprehensive
- [ ] Loading states implemented
- [ ] Accessibility (tab order, ARIA labels)
- [ ] Documentation updated

---

## 11. Troubleshooting

### Keychain Access Denied

If you get "Keychain access denied" errors:

1. Open Keychain Access app
2. Find "com.zeami.settings" entries
3. Right-click → Get Info → Access Control
4. Add your app to allowed apps

### Settings Not Persisting

Check:
1. Config file exists: `~/.zeami/config.json`
2. File permissions: `ls -la ~/.zeami/config.json` (should be `-rw-------`)
3. Check logs in Rust backend

### Import Fails

Verify:
1. JSON is valid: `cat file.json | jq`
2. File has `zeami_settings_export: true`
3. Schema version is compatible

---

## 12. Next Steps

1. **Implement all tab components** (currently only GitHub is complete)
2. **Add custom validation** (e.g., test shell path exists)
3. **Implement preset sharing** (export/import presets)
4. **Add settings search** (quick find any setting)
5. **Telemetry** (track which settings are most used)
6. **Documentation** (help tooltips, links to docs)

---

## Support

For questions or issues:
- Check existing GitHub issues
- Review the comprehensive report in `COMPREHENSIVE_REPORT.md`
- Consult the prototype code in `prototype/`
