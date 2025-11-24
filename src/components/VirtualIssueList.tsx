import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface Issue {
  id: number;
  title: string;
  number: number;
  state: 'open' | 'closed';
  labels: string[];
}

interface VirtualIssueListProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  selectedIssueId?: number | null;
}

/**
 * Virtualized Issue List Component
 *
 * Uses TanStack Virtual for efficient rendering of large issue lists.
 * Only renders visible items in the viewport for optimal performance.
 *
 * Recommended for lists with 50+ items.
 */
export default function VirtualIssueList({
  issues,
  onSelectIssue,
  selectedIssueId,
}: VirtualIssueListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height of each issue item in pixels
    overscan: 5, // Number of items to render outside viewport
  });

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto"
      style={{ height: '100%', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const issue = issues[virtualItem.index];
          const isSelected = selectedIssueId === issue.id;

          return (
            <button
              key={virtualItem.key}
              onClick={() => onSelectIssue(issue)}
              className={`absolute top-0 left-0 w-full text-left p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                isSelected ? 'bg-gray-800' : ''
              }`}
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`${
                    issue.state === 'open' ? 'text-green-400' : 'text-purple-400'
                  } text-sm mt-1`}
                >
                  {issue.state === 'open' ? '●' : '✓'}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium truncate">
                    {issue.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-gray-500 text-xs">#{issue.number}</span>
                    {issue.labels.map((label) => (
                      <span
                        key={label}
                        className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
