import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';

interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string; avatar_url: string }>;
  created_at: string;
  updated_at: string;
}

interface IssueFilters {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
}

/**
 * TanStack Query Hooks for GitHub Issues (Server State)
 *
 * These hooks manage all server state related to GitHub Issues:
 * - Fetching issues from GitHub API (via Tauri IPC)
 * - Caching and automatic revalidation
 * - Mutations (create, update, close issues)
 * - Optimistic updates
 */

// Query Keys
export const issueKeys = {
  all: ['issues'] as const,
  lists: () => [...issueKeys.all, 'list'] as const,
  list: (filters: IssueFilters) => [...issueKeys.lists(), filters] as const,
  details: () => [...issueKeys.all, 'detail'] as const,
  detail: (id: number) => [...issueKeys.details(), id] as const,
};

/**
 * Fetch all issues with optional filters
 */
export function useIssues(filters: IssueFilters = {}) {
  return useQuery({
    queryKey: issueKeys.list(filters),
    queryFn: async () => {
      // Call Tauri command to fetch issues from GitHub API
      const issues = await invoke<Issue[]>('fetch_issues', { filters });
      return issues;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
  });
}

/**
 * Fetch a single issue by number
 */
export function useIssue(issueNumber: number) {
  return useQuery({
    queryKey: issueKeys.detail(issueNumber),
    queryFn: async () => {
      const issue = await invoke<Issue>('fetch_issue', { issueNumber });
      return issue;
    },
    enabled: issueNumber > 0, // Only fetch if we have a valid issue number
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create a new issue
 */
export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; body: string; labels?: string[] }) => {
      const issue = await invoke<Issue>('create_issue', data);
      return issue;
    },
    onSuccess: () => {
      // Invalidate and refetch issues list
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
    },
  });
}

/**
 * Update an issue
 */
export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { issueNumber: number; title?: string; body?: string; state?: 'open' | 'closed' }) => {
      const issue = await invoke<Issue>('update_issue', data);
      return issue;
    },
    onSuccess: (data) => {
      // Update cached issue
      queryClient.setQueryData(issueKeys.detail(data.number), data);
      // Invalidate lists to reflect changes
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
    },
  });
}

/**
 * Close an issue (optimistic update)
 */
export function useCloseIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issueNumber: number) => {
      const issue = await invoke<Issue>('close_issue', { issueNumber });
      return issue;
    },
    // Optimistic update
    onMutate: async (issueNumber) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: issueKeys.detail(issueNumber) });

      // Snapshot previous value
      const previousIssue = queryClient.getQueryData(issueKeys.detail(issueNumber));

      // Optimistically update
      queryClient.setQueryData(issueKeys.detail(issueNumber), (old: Issue | undefined) => {
        if (!old) return old;
        return { ...old, state: 'closed' as const };
      });

      return { previousIssue };
    },
    onError: (_err, issueNumber, context) => {
      // Rollback on error
      if (context?.previousIssue) {
        queryClient.setQueryData(issueKeys.detail(issueNumber), context.previousIssue);
      }
    },
    onSettled: (_data, _err, issueNumber) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(issueNumber) });
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
    },
  });
}
