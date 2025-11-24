# Settings UI - Quick Reference Card

One-page reference for implementing the settings UI.

---

## Architecture Decision

**Chosen**: Zod + React Hook Form + shadcn/ui (Manual)
**Rejected**: react-jsonschema-form, shadcn-ui/auto-form, custom

**Why Manual?** Complex UI needs (tabs, custom widgets, premium quality) + type safety critical + long-term maintainability

---

## File Locations

```
Frontend:
  src/lib/settings-schema.ts              # Zod schema (single source of truth)
  src/components/settings/SettingsDialog.tsx
  src/components/settings/GitHubSettings.tsx (+ 6 more tabs)
  src/components/settings/widgets/*.tsx

Backend:
  src-tauri/src/config/mod.rs             # Data structures
  src-tauri/src/config/storage.rs         # File I/O (~/.zeami/config.json)
  src-tauri/src/config/keychain.rs        # macOS Keychain (secrets)
  src-tauri/src/config/migration.rs       # Schema versioning
  src-tauri/src/config/backup.rs          # Backups
  src-tauri/src/commands/settings_commands.rs  # Tauri API
```

---

## Storage Strategy

**Config File**: `~/.zeami/config.json` (0600 permissions)
**Secrets**: macOS Keychain (`com.zeami.settings` service)
**Backups**: `~/.zeami/backups/` (keep last 5)

**What goes where:**
- Config file: All non-secret settings
- Keychain: `github.token`, `claude.apiKey`
- Never in file: Passwords, API keys, tokens

---

## Settings Categories (84 total)

1. GitHub (13): Token, repo, API, branches, PRs
2. Git (10): User, GPG, merge, auto-fetch
3. Terminal (12): Shell, theme, font, cursor
4. UI (11): Theme, colors, layout, notifications
5. Workflow (14): Auto-commit, tests, builds, hooks
6. Claude (11): API key, model, temperature, context
7. Test (13): Framework, coverage, E2E settings

---

## Key Components

### SettingsDialog.tsx
- Main dialog with 7 tabs
- React Hook Form with Zod validation
- Save/Cancel/Reset actions
- Import/Export functionality

### Custom Widgets
- `PasswordField`: Password with show/hide toggle
- `ColorPicker`: Hex input + visual picker
- `PathSelector`: Text input + file browser

---

## Tauri Commands

```typescript
// Load/Save
await invoke('load_settings') → Settings
await invoke('save_settings', { settings }) → void
await invoke('reset_settings') → Settings

// Import/Export
await invoke('export_settings', { settings, path }) → void
await invoke('import_settings', { path }) → Settings

// Validation
await invoke('test_github_token', { token }) → TokenValidation
await invoke('validate_repository', { owner, repo, token }) → RepoValidation
await invoke('validate_path', { path }) → PathValidation

// Backups
await invoke('list_backups') → BackupInfo[]
await invoke('restore_backup', { backupPath }) → Settings
await invoke('delete_backup', { backupPath }) → void
```

---

## Schema Pattern

```typescript
// Define with Zod
export const settingsSchema = z.object({
  github: z.object({
    token: z.string().regex(/^ghp_[a-zA-Z0-9]{36}$/),
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    // ...
  }),
  // ...
});

// Auto-generate TypeScript type
export type Settings = z.infer<typeof settingsSchema>;

// Defaults
export const defaultSettings: Settings = { /* ... */ };
```

---

## Validation Examples

```typescript
// GitHub token
token: z.string()
  .min(1, 'Token is required')
  .regex(/^ghp_[a-zA-Z0-9]{36}$/, 'Invalid token format')

// Repository
repository: z.string()
  .regex(/^[^/]+\/[^/]+$/, 'Must be owner/repo format')

// Email
userEmail: z.string().email('Invalid email')

// Range
fontSize: z.number().int().min(8).max(32)

// Enum
theme: z.enum(['dark', 'light', 'auto'])

// Array
excludePatterns: z.array(z.string()).default([])
```

---

## Tab Implementation Pattern

```typescript
interface TabProps {
  control: Control<Settings>;
  errors?: FieldErrors<CategorySettings>;
}

export function TabComponent({ control, errors }: TabProps) {
  return (
    <div className="space-y-8">
      {/* Section header */}
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Section Title</h3>
        <p className="text-sm text-gray-400">Description</p>
      </div>

      {/* Field */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          Field Label *
        </label>
        <Controller
          name="category.field"
          control={control}
          render={({ field }) => (
            <input {...field} className="..." />
          )}
        />
        {errors?.field && (
          <p className="text-sm text-red-400">{errors.field.message}</p>
        )}
      </div>
    </div>
  );
}
```

---

## Keychain Integration

```rust
// Store secret
keychain::store_secret("github.token", "ghp_...")?;

// Retrieve secret
let token = keychain::retrieve_secret("github.token")?;

// Delete secret
keychain::delete_secret("github.token")?;

// Check if exists
if keychain::secret_exists("github.token") { ... }
```

---

## Migration Pattern

```rust
// 1. Increment version
pub const CURRENT_SCHEMA_VERSION: u32 = 2; // was 1

// 2. Add migration function
fn migrate_v1_to_v2(config: &mut Value) -> Result<()> {
    // Add new fields with defaults
    config["new_category"] = json!({ ... });

    // Rename fields
    if let Some(old) = config.get("old_field").cloned() {
        config["new_field"] = old;
        config.as_object_mut().unwrap().remove("old_field");
    }

    Ok(())
}

// 3. Update dispatcher
match current_version {
    0 => migrate_v0_to_v1(config)?,
    1 => migrate_v1_to_v2(config)?, // Add this
    _ => bail!("Unsupported version"),
}
```

---

## Testing Checklist

**Unit Tests**:
- [ ] Schema validation (valid/invalid inputs)
- [ ] Storage (save → load → verify)
- [ ] Keychain (store → retrieve → delete)
- [ ] Migration (v0 → v1 → v2)

**Integration Tests**:
- [ ] Settings persistence across restarts
- [ ] Import/export workflow
- [ ] Backup/restore workflow

**E2E Tests** (Playwright):
- [ ] Open settings dialog
- [ ] Navigate between tabs
- [ ] Fill in settings and save
- [ ] Verify persistence after reload

---

## Common Issues & Solutions

**Issue**: Keychain access denied
**Solution**: Open Keychain Access → Find entry → Access Control → Add app

**Issue**: Settings not persisting
**Solution**: Check `~/.zeami/config.json` exists and has 0600 permissions

**Issue**: Import fails
**Solution**: Verify JSON has `zeami_settings_export: true` field

**Issue**: TypeScript errors
**Solution**: Run `npm install` and ensure Zod version matches

---

## Performance Targets

- Form validation: < 1ms
- Settings load: < 10ms
- Settings save: < 50ms
- Migration: < 100ms
- Bundle size: ~80KB (Zod + RHF)

---

## Accessibility

- Tab navigation works
- Focus states visible
- Error messages read by screen readers
- Keyboard shortcuts (Cmd+,)
- ARIA labels on inputs

---

## Security Checklist

- [ ] Secrets never in plain text
- [ ] Config file has 0600 permissions
- [ ] Directory has 0700 permissions
- [ ] Export excludes secrets by default
- [ ] Input validation on all fields
- [ ] Path validation (no traversal)

---

## Next Steps After Implementation

1. Add settings search functionality
2. Implement keyboard shortcuts
3. Add help tooltips
4. Integrate with command palette
5. Add telemetry for usage tracking
6. Support settings sync across machines
7. Add preset sharing

---

## Dependencies

**Frontend**:
```json
{
  "react-hook-form": "^7.49.0",
  "zod": "^3.22.4",
  "@hookform/resolvers": "^3.3.4"
}
```

**Backend**:
```toml
security-framework = "2.9"
shellexpand = "3.1"
# + existing: serde, chrono, dirs, octocrab
```

---

## Useful Commands

```bash
# Backend
cd src-tauri
cargo test                    # Run Rust tests
cargo build                   # Build backend

# Frontend
npm install                   # Install dependencies
npm test                      # Run Jest tests
npm run tauri:dev            # Run in dev mode

# Testing
npm run test:playwright       # E2E tests
npm run test:playwright:ui    # E2E tests with UI
```

---

## Resources

- Full report: `COMPREHENSIVE_REPORT.md`
- Step-by-step guide: `IMPLEMENTATION_GUIDE.md`
- Prototype code: `prototype/`
- This reference: `QUICK_REFERENCE.md`
