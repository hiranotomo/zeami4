import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useState } from 'react';

interface Issue {
  id: number;
  title: string;
  number: number;
  state: 'open' | 'closed';
  labels: string[];
}

interface DashboardProps {
  className?: string;
}

export default function Dashboard({ className = '' }: DashboardProps) {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Mock data - will be replaced with TanStack Query
  const mockIssues: Issue[] = [
    { id: 1, title: '技術調査: 統合ダッシュボード実装のための技術検証', number: 15, state: 'open', labels: ['investigation'] },
    { id: 2, title: '完全自動テストスイート統合', number: 14, state: 'open', labels: ['testing'] },
    { id: 3, title: 'PTY機能独立テスト', number: 12, state: 'open', labels: ['testing'] },
  ];

  return (
    <div className={`h-full ${className}`}>
      <PanelGroup direction="horizontal" autoSaveId="zeami-dashboard-layout">
        {/* Left Panel - Issue List */}
        <Panel defaultSize={25} minSize={20} maxSize={40}>
          <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Issues</h2>
              <p className="text-sm text-gray-400 mt-1">{mockIssues.length} open</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {mockIssues.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className={`w-full text-left p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                    selectedIssue?.id === issue.id ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 text-sm mt-1">●</span>
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
              ))}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-500 transition-colors" />

        {/* Center Panel - Terminal */}
        <Panel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-gray-900">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Terminal</h2>
              {selectedIssue && (
                <p className="text-sm text-gray-400 mt-1">Working on #{selectedIssue.number}</p>
              )}
            </div>
            <div className="flex-1 p-4 font-mono text-sm">
              <div className="text-green-400">$ zeami dev start</div>
              <div className="text-gray-400 mt-2">
                Terminal output will appear here...
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-500 transition-colors" />

        {/* Right Panel - Test Results & Info */}
        <Panel defaultSize={25} minSize={20} maxSize={40}>
          <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Info</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedIssue ? (
                <div>
                  <h3 className="text-white font-medium mb-2">
                    {selectedIssue.title}
                  </h3>
                  <div className="text-sm text-gray-400 space-y-2">
                    <div>
                      <span className="text-gray-500">Number:</span> #{selectedIssue.number}
                    </div>
                    <div>
                      <span className="text-gray-500">State:</span>{' '}
                      <span className={selectedIssue.state === 'open' ? 'text-green-400' : 'text-purple-400'}>
                        {selectedIssue.state}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Labels:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedIssue.labels.map((label) => (
                          <span
                            key={label}
                            className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-white font-medium mb-2">Test Results</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-300">Unit Tests</span>
                        <span className="text-gray-500 ml-auto">12 passed</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-300">Integration Tests</span>
                        <span className="text-gray-500 ml-auto">5 passed</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-yellow-400">⚠</span>
                        <span className="text-gray-300">E2E Tests</span>
                        <span className="text-gray-500 ml-auto">pending</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  Select an issue to view details
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
