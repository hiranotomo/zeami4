# State Management Architecture

**Tech Stack:** TanStack Query v5 + Zustand
**Pattern:** Server State vs Client State Separation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        React Components                      │
│  Dashboard.tsx, CommandPalette.tsx, Terminal.tsx, etc.      │
└─────────┬──────────────────────────────────┬────────────────┘
          │                                  │
          │                                  │
    ┌─────▼──────────┐              ┌───────▼────────────┐
    │ Client State   │              │   Server State     │
    │   (Zustand)    │              │ (TanStack Query)   │
    └─────┬──────────┘              └───────┬────────────┘
          │                                  │
          │                                  │
    ┌─────▼──────────────┐          ┌───────▼────────────────┐
    │  localStorage      │          │   Tauri IPC Commands   │
    │  • panel layout    │          │   • fetch_issues       │
    │  • theme           │          │   • create_issue       │
    │  • preferences     │          │   • update_issue       │
    └────────────────────┘          │   • close_issue        │
                                    └───────┬────────────────┘
                                            │
                                    ┌───────▼────────────────┐
                                    │   Rust Backend         │
                                    │   • GitHub API         │
                                    │   • Git Operations     │
                                    │   • File System        │
                                    └────────────────────────┘
```

---

## State Categories

### 1. Client State (Zustand)

**Definition:** UI state that exists only in the browser, not synced with server

**Examples:**
- Selected issue ID
- Panel sizes and positions
- Command palette open/closed
- Theme preference
- Terminal session ID
- Modal/dialog states
- Focused element

**Storage:** localStorage (persisted across sessions)

**Store File:** `/src/stores/useUIStore.ts`

**Usage Pattern:**
```tsx
// In component
const { selectedIssueId, setSelectedIssueId } = useUIStore();

// Update state
setSelectedIssueId(15);

// Persisted automatically
```

---

### 2. Server State (TanStack Query)

**Definition:** Data fetched from backend (GitHub API, file system, etc.)

**Examples:**
- Issue list from GitHub
- Single issue details
- Pull request data
- Git commit history
- Test results
- File contents

**Storage:** In-memory cache (with stale/cache time configuration)

**Hooks File:** `/src/hooks/useIssues.ts`

**Usage Pattern:**
```tsx
// Fetch issues
const { data: issues, isLoading, error } = useIssues({ state: 'open' });

// Create issue (mutation)
const createIssue = useCreateIssue();
createIssue.mutate({ title: 'New Issue', body: 'Description' });
```

---

## Data Flow Patterns

### Pattern 1: Fetch Data

```
1. Component mounts
   ↓
2. TanStack Query checks cache
   ↓
3. If stale or missing:
   ↓
4. invoke('fetch_issues', { filters })
   ↓
5. Rust backend calls GitHub API
   ↓
6. Response cached (5 min stale time)
   ↓
7. Component receives data
```

### Pattern 2: Update Data (Optimistic)

```
1. User clicks "Close Issue"
   ↓
2. useMutation triggers onMutate
   ↓
3. Update cache optimistically (UI updates immediately)
   ↓
4. invoke('close_issue', { issueNumber })
   ↓
5. If success: keep optimistic update
6. If error: rollback to previous state
   ↓
7. onSettled: invalidate queries (refetch)
```

### Pattern 3: Client State Drives Server State

```
1. User selects issue (Zustand)
   ↓
2. selectedIssueId stored in useUIStore
   ↓
3. useIssue(selectedIssueId) hook reacts
   ↓
4. Fetch issue details if not cached
   ↓
5. Display in UI
```

---

## Query Key Strategy

**Hierarchical Structure:**

```tsx
issueKeys = {
  all: ['issues'],
  lists: ['issues', 'list'],
  list: (filters) => ['issues', 'list', filters],
  details: ['issues', 'detail'],
  detail: (id) => ['issues', 'detail', id],
}
```

**Benefits:**
- Easy cache invalidation (`invalidateQueries(['issues'])`)
- Granular cache control
- TypeScript-safe

**Invalidation Examples:**
```tsx
// Invalidate ALL issue-related queries
queryClient.invalidateQueries({ queryKey: issueKeys.all });

// Invalidate only issue lists
queryClient.invalidateQueries({ queryKey: issueKeys.lists() });

// Invalidate specific issue
queryClient.invalidateQueries({ queryKey: issueKeys.detail(15) });
```

---

## Cache Configuration

### Global Defaults

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // Don't refetch on tab switch
      retry: 1,                     // Retry failed requests once
      staleTime: 1000 * 60 * 5,     // 5 minutes (data considered fresh)
      gcTime: 1000 * 60 * 30,       // 30 minutes (garbage collection)
    },
  },
});
```

### Per-Query Overrides

```tsx
useQuery({
  queryKey: issueKeys.detail(issueNumber),
  queryFn: fetchIssue,
  staleTime: 1000 * 60 * 10,  // 10 minutes for issue details
  enabled: issueNumber > 0,   // Only fetch if valid ID
});
```

---

## Zustand Store Structure

### Single Store with Slices (Recommended)

```tsx
interface UIState {
  // Panel layout slice
  panelLayout: { leftPanelSize: number; rightPanelSize: number };
  setPanelLayout: (layout: PanelLayout) => void;

  // Selection slice
  selectedIssueId: number | null;
  setSelectedIssueId: (id: number | null) => void;

  // Command palette slice
  isCommandPaletteOpen: boolean;
  toggleCommandPalette: () => void;

  // Terminal slice
  terminalSessionId: string | null;
  setTerminalSessionId: (id: string | null) => void;

  // Theme slice
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}
```

### Persistence Strategy

```tsx
persist(
  (set) => ({ /* state */ }),
  {
    name: 'zeami-ui-state',
    partialize: (state) => ({
      // Only persist these fields
      panelLayout: state.panelLayout,
      theme: state.theme,
      // DON'T persist selectedIssueId (reset on reload)
    }),
  }
)
```

---

## Error Handling

### TanStack Query Errors

```tsx
const { data, error, isError } = useIssues();

if (isError) {
  return <ErrorBoundary error={error} />;
}
```

### Mutation Errors with Toast

```tsx
const createIssue = useCreateIssue();

createIssue.mutate(
  { title, body },
  {
    onSuccess: () => {
      toast.success('Issue created!');
    },
    onError: (error) => {
      toast.error(`Failed to create issue: ${error.message}`);
    },
  }
);
```

### Tauri IPC Errors

```rust
// In Rust command
#[tauri::command]
async fn fetch_issues() -> Result<Vec<Issue>, String> {
    match github_api::fetch_issues().await {
        Ok(issues) => Ok(issues),
        Err(e) => Err(format!("GitHub API error: {}", e)),
    }
}
```

```tsx
// In React hook
queryFn: async () => {
  try {
    const issues = await invoke<Issue[]>('fetch_issues');
    return issues;
  } catch (error) {
    // TanStack Query will handle retry and error state
    throw new Error(`Failed to fetch issues: ${error}`);
  }
}
```

---

## Performance Optimizations

### 1. Selective Subscriptions (Zustand)

```tsx
// ❌ Bad: Re-renders on ANY state change
const store = useUIStore();

// ✅ Good: Re-renders only when selectedIssueId changes
const selectedIssueId = useUIStore((state) => state.selectedIssueId);
```

### 2. Query Deduplication (TanStack Query)

```tsx
// Multiple components call useIssues() simultaneously
// TanStack Query deduplicates → only 1 API call
function ComponentA() {
  const { data } = useIssues();
}

function ComponentB() {
  const { data } = useIssues(); // Uses same query instance
}
```

### 3. Prefetching

```tsx
const queryClient = useQueryClient();

// Prefetch issue details on hover
<IssueListItem
  onMouseEnter={() => {
    queryClient.prefetchQuery({
      queryKey: issueKeys.detail(issue.number),
      queryFn: () => fetchIssue(issue.number),
    });
  }}
/>
```

### 4. Background Refetching

```tsx
useQuery({
  queryKey: issueKeys.lists(),
  queryFn: fetchIssues,
  refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes in background
});
```

---

## Testing Strategies

### Zustand Store Tests

```tsx
import { renderHook, act } from '@testing-library/react';
import { useUIStore } from './useUIStore';

test('should toggle command palette', () => {
  const { result } = renderHook(() => useUIStore());

  act(() => {
    result.current.toggleCommandPalette();
  });

  expect(result.current.isCommandPaletteOpen).toBe(true);
});
```

### TanStack Query Tests

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useIssues } from './useIssues';

test('should fetch issues', async () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useIssues(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(3);
});
```

---

## Migration from Existing Code

### Step 1: Install Dependencies

```bash
npm install @tanstack/react-query @tanstack/react-virtual zustand
```

### Step 2: Wrap App with QueryClientProvider

```tsx
// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
```

### Step 3: Move API Calls to TanStack Query Hooks

```tsx
// Before
const [issues, setIssues] = useState([]);
useEffect(() => {
  invoke('fetch_issues').then(setIssues);
}, []);

// After
const { data: issues } = useIssues();
```

### Step 4: Move UI State to Zustand

```tsx
// Before
const [selectedIssueId, setSelectedIssueId] = useState(null);

// After
const { selectedIssueId, setSelectedIssueId } = useUIStore();
```

---

## Best Practices

### DO ✅

- Use TanStack Query for ALL server data
- Use Zustand for ALL client/UI state
- Structure query keys hierarchically
- Implement optimistic updates for mutations
- Persist only necessary UI state (theme, layout)
- Use selective subscriptions in Zustand

### DON'T ❌

- Don't mix server state and client state
- Don't store API responses in Zustand
- Don't use `useState` for cross-component state
- Don't forget to handle loading/error states
- Don't invalidate queries unnecessarily (performance impact)
- Don't store sensitive data in localStorage

---

## Debugging Tools

### TanStack Query DevTools

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**Features:**
- View all queries and their state
- See cache contents
- Manually trigger refetch
- Inspect query timelines

### Zustand DevTools

```tsx
import { devtools } from 'zustand/middleware';

export const useUIStore = create<UIState>()(
  devtools(
    persist(/* ... */),
    { name: 'UIStore' }
  )
);
```

**Features:**
- Redux DevTools integration
- Time-travel debugging
- State snapshots

---

## References

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [State Management Best Practices](https://kentcdodds.com/blog/application-state-management-with-react)
- [Server State vs Client State](https://tkdodo.eu/blog/practical-react-query)
