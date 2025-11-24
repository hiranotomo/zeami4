# Component Integration Quick Reference

**For:** Implementing the 3-column dashboard with all UI components
**Tech Stack:** react-resizable-panels + shadcn/ui + cmdk + TanStack Virtual

---

## Installation Checklist

```bash
# Core dependencies (already installed)
npm install react-resizable-panels @tanstack/react-query @tanstack/react-virtual zustand cmdk

# shadcn/ui setup (when ready)
npx shadcn-ui@latest init
npx shadcn-ui@latest add card badge tabs command dialog toast
```

---

## Component Integration Examples

### 1. Dashboard Layout (3-Column)

**File:** `/src/components/Dashboard.tsx`

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export default function Dashboard() {
  return (
    <PanelGroup direction="horizontal" autoSaveId="zeami-dashboard-layout">
      {/* Left Panel - Issue List */}
      <Panel defaultSize={25} minSize={20} maxSize={40}>
        <IssuePanel />
      </Panel>

      <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-500 transition-colors" />

      {/* Center Panel - Terminal */}
      <Panel defaultSize={50} minSize={30}>
        <TerminalPanel />
      </Panel>

      <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-500 transition-colors" />

      {/* Right Panel - Info/Tests */}
      <Panel defaultSize={25} minSize={20} maxSize={40}>
        <InfoPanel />
      </Panel>
    </PanelGroup>
  );
}
```

**Key Props:**
- `autoSaveId`: Enables localStorage persistence
- `defaultSize`: Initial size (percentage)
- `minSize`/`maxSize`: Constraints (percentage)
- `direction`: "horizontal" | "vertical"

---

### 2. Issue List with Virtual Scrolling

**File:** `/src/components/IssueList.tsx`

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useIssues } from '@/hooks/useIssues';
import { useUIStore } from '@/stores/useUIStore';

export default function IssueList() {
  const parentRef = useRef<HTMLDivElement>(null);
  const { data: issues = [], isLoading } = useIssues({ state: 'open' });
  const { selectedIssueId, setSelectedIssueId } = useUIStore();

  const rowVirtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  if (isLoading) return <Skeleton />;

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const issue = issues[virtualItem.index];
          return (
            <IssueCard
              key={issue.id}
              issue={issue}
              isSelected={selectedIssueId === issue.id}
              onClick={() => setSelectedIssueId(issue.id)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
```

**When to Use Virtual Scrolling:**
- ✅ 100+ issues in repository
- ✅ Complex issue cards (images, rich content)
- ❌ Small lists (<50 items) - adds unnecessary complexity

---

### 3. Command Palette

**File:** `/src/components/CommandPalette.tsx`

```tsx
import { Command } from 'cmdk';
import { useUIStore } from '@/stores/useUIStore';

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20">
      <Command className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 max-w-2xl w-full">
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command..."
          className="w-full px-4 py-3 bg-transparent text-white outline-none"
        />

        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty>No results found.</Command.Empty>

          <Command.Group heading="Issues">
            <Command.Item onSelect={() => { /* action */ }}>
              Create new issue
            </Command.Item>
            <Command.Item onSelect={() => { /* action */ }}>
              Close current issue
            </Command.Item>
          </Command.Group>

          <Command.Separator className="h-px bg-gray-700 my-2" />

          <Command.Group heading="Settings">
            <Command.Item onSelect={() => { /* action */ }}>
              Configure GitHub token
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
```

**Keyboard Setup (in App.tsx):**

```tsx
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggleCommandPalette();
    }
  };
  document.addEventListener('keydown', down);
  return () => document.removeEventListener('keydown', down);
}, []);
```

---

### 4. TanStack Query Integration

**File:** `/src/hooks/useIssues.ts`

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';

// Query Keys (hierarchical)
export const issueKeys = {
  all: ['issues'] as const,
  lists: () => [...issueKeys.all, 'list'] as const,
  list: (filters: IssueFilters) => [...issueKeys.lists(), filters] as const,
  details: () => [...issueKeys.all, 'detail'] as const,
  detail: (id: number) => [...issueKeys.details(), id] as const,
};

// Fetch issues
export function useIssues(filters: IssueFilters = {}) {
  return useQuery({
    queryKey: issueKeys.list(filters),
    queryFn: async () => {
      const issues = await invoke<Issue[]>('fetch_issues', { filters });
      return issues;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create issue
export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; body: string }) => {
      return await invoke<Issue>('create_issue', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
    },
  });
}

// Close issue (with optimistic update)
export function useCloseIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issueNumber: number) => {
      return await invoke<Issue>('close_issue', { issueNumber });
    },
    onMutate: async (issueNumber) => {
      await queryClient.cancelQueries({ queryKey: issueKeys.detail(issueNumber) });
      const previousIssue = queryClient.getQueryData(issueKeys.detail(issueNumber));

      queryClient.setQueryData(issueKeys.detail(issueNumber), (old: Issue | undefined) => {
        if (!old) return old;
        return { ...old, state: 'closed' as const };
      });

      return { previousIssue };
    },
    onError: (_err, issueNumber, context) => {
      if (context?.previousIssue) {
        queryClient.setQueryData(issueKeys.detail(issueNumber), context.previousIssue);
      }
    },
    onSettled: (_data, _err, issueNumber) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(issueNumber) });
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
    },
  });
}
```

**Usage in Component:**

```tsx
function IssueDetail({ issueNumber }: { issueNumber: number }) {
  const { data: issue, isLoading, error } = useIssue(issueNumber);
  const closeIssue = useCloseIssue();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorBoundary error={error} />;

  return (
    <div>
      <h2>{issue.title}</h2>
      <button onClick={() => closeIssue.mutate(issueNumber)}>
        Close Issue
      </button>
    </div>
  );
}
```

---

### 5. Zustand Store

**File:** `/src/stores/useUIStore.ts`

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Selected issue
  selectedIssueId: number | null;
  setSelectedIssueId: (id: number | null) => void;

  // Command palette
  isCommandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedIssueId: null,
      setSelectedIssueId: (id) => set({ selectedIssueId: id }),

      isCommandPaletteOpen: false,
      toggleCommandPalette: () =>
        set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
      closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'zeami-ui-state',
      partialize: (state) => ({
        theme: state.theme, // Only persist theme
      }),
    }
  )
);
```

**Usage (Selective Subscription):**

```tsx
// ❌ Bad: Re-renders on ANY state change
const store = useUIStore();

// ✅ Good: Re-renders only when selectedIssueId changes
const selectedIssueId = useUIStore((state) => state.selectedIssueId);
const setSelectedIssueId = useUIStore((state) => state.setSelectedIssueId);
```

---

### 6. App Setup with Providers

**File:** `/src/App.tsx`

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Dashboard from './components/Dashboard';
import CommandPalette from './components/CommandPalette';
import { useUIStore } from './stores/useUIStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function App() {
  const { isCommandPaletteOpen, closeCommandPalette, toggleCommandPalette } = useUIStore();

  // Global keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [toggleCommandPalette]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex flex-col bg-gray-900">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Dashboard />
        </main>
      </div>

      {isCommandPaletteOpen && <CommandPalette onClose={closeCommandPalette} />}

      {/* DevTools (remove in production) */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## Common Patterns

### Pattern: Fetch on Selection

```tsx
function IssueList() {
  const { data: issues = [] } = useIssues();
  const { selectedIssueId, setSelectedIssueId } = useUIStore();

  // Automatically fetch selected issue details
  const { data: selectedIssue } = useIssue(selectedIssueId ?? 0, {
    enabled: selectedIssueId !== null,
  });

  return (
    <div>
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onClick={() => setSelectedIssueId(issue.id)}
        />
      ))}
    </div>
  );
}
```

### Pattern: Prefetch on Hover

```tsx
const queryClient = useQueryClient();

<IssueCard
  onMouseEnter={() => {
    queryClient.prefetchQuery({
      queryKey: issueKeys.detail(issue.number),
      queryFn: () => invoke('fetch_issue', { issueNumber: issue.number }),
    });
  }}
/>
```

### Pattern: Background Sync

```tsx
useQuery({
  queryKey: issueKeys.lists(),
  queryFn: fetchIssues,
  refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  refetchIntervalInBackground: true,
});
```

---

## Styling Guidelines

### Tailwind Classes (Dark Theme)

```tsx
// Panel backgrounds
className="bg-gray-900"

// Borders
className="border-gray-700"

// Hover states
className="hover:bg-gray-800 transition-colors"

// Text colors
className="text-white"           // Primary text
className="text-gray-400"        // Secondary text
className="text-gray-500"        // Tertiary text

// Status colors
className="text-green-400"       // Open issues
className="text-purple-400"      // Closed issues
className="text-blue-400"        // Labels
className="text-red-400"         // Errors
className="text-yellow-400"      // Warnings
```

### Consistent Spacing

```tsx
// Panel padding
className="p-4"

// Section spacing
className="space-y-4"

// Gap between elements
className="gap-2"  // Small gap
className="gap-4"  // Medium gap
```

---

## Performance Checklist

- ✅ Use `React.memo()` for expensive components
- ✅ Use selective Zustand subscriptions
- ✅ Implement virtual scrolling for large lists (100+ items)
- ✅ Prefetch data on hover/focus
- ✅ Use query key structure for granular cache invalidation
- ✅ Add proper loading skeletons
- ✅ Debounce search inputs (command palette)
- ✅ Use `enabled` flag in queries to prevent unnecessary fetches

---

## Accessibility Checklist

- ✅ All interactive elements focusable (Tab navigation)
- ✅ Keyboard shortcuts documented (Help dialog)
- ✅ ARIA labels for icon-only buttons
- ✅ Focus indicators visible (outline-blue-500)
- ✅ Color contrast ratio ≥ 4.5:1
- ✅ Screen reader announcements for state changes
- ✅ Escape key closes modals/dialogs

---

## Testing Strategy

### Component Tests

```tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import IssueList from './IssueList';

test('renders issue list', async () => {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <IssueList />
    </QueryClientProvider>
  );

  expect(await screen.findByText('Issue #15')).toBeInTheDocument();
});
```

### Hook Tests

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useIssues } from './useIssues';

test('fetches issues', async () => {
  const { result } = renderHook(() => useIssues());

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(3);
});
```

---

## Troubleshooting

### Issue: Panel sizes reset on reload

**Solution:** Add `autoSaveId` prop to `<PanelGroup>`

```tsx
<PanelGroup autoSaveId="unique-id">
```

### Issue: Query not refetching

**Solution:** Check `staleTime` and manually invalidate

```tsx
queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
```

### Issue: Zustand store not persisting

**Solution:** Check `partialize` function and localStorage

```tsx
partialize: (state) => ({
  theme: state.theme, // Explicitly list persisted fields
}),
```

### Issue: Command palette not closing on Escape

**Solution:** Add keyboard event handler

```tsx
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeCommandPalette();
    }
  };
  document.addEventListener('keydown', down);
  return () => document.removeEventListener('keydown', down);
}, []);
```

---

## Next Steps

1. ✅ Review this guide
2. ✅ Implement 3-column layout first (highest priority)
3. ✅ Add TanStack Query + Zustand (state foundation)
4. ⏳ Implement command palette (DX improvement)
5. ⏳ Add virtual scrolling (only if needed)
6. ⏳ Integrate shadcn/ui components (polish UI)

---

## Reference Files

- **Dashboard Layout:** `/src/components/Dashboard.tsx`
- **Command Palette:** `/src/components/CommandPalette.tsx`
- **Virtual List:** `/src/components/VirtualIssueList.tsx`
- **TanStack Query Hooks:** `/src/hooks/useIssues.ts`
- **Zustand Store:** `/src/stores/useUIStore.ts`
- **App Setup:** `/src/App.dashboard.tsx`
