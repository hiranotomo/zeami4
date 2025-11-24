import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from "./components/Dashboard";
import CommandPalette from "./components/CommandPalette";
import { useUIStore } from "./stores/useUIStore";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function AppDashboard() {
  const { isCommandPaletteOpen, toggleCommandPalette, closeCommandPalette } = useUIStore();

  // Setup keyboard shortcut for command palette (Cmd+K / Ctrl+K)
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
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">zeami4</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleCommandPalette}
                className="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <span>Commands</span>
                <kbd className="px-1.5 py-0.5 bg-gray-600 rounded text-xs">⌘K</kbd>
              </button>
              <div className="px-3 py-1 rounded text-sm bg-green-500/20 text-green-400 border border-green-500/30">
                Connected
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          <Dashboard />
        </main>

        {/* Command Palette Modal */}
        {isCommandPaletteOpen && <CommandPalette onClose={closeCommandPalette} />}
      </div>
    </QueryClientProvider>
  );
}

export default AppDashboard;
