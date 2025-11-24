import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useUIStore } from '../stores/useUIStore';

interface CommandPaletteProps {
  onClose: () => void;
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const { setTheme, theme } = useUIStore();

  // Handle keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [onClose]);

  const handleCommand = (callback: () => void) => {
    callback();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20">
      <Command
        className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className="border-b border-gray-700">
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 outline-none"
          />
        </div>

        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="px-4 py-8 text-center text-gray-500">
            No results found.
          </Command.Empty>

          <Command.Group heading="Issues" className="px-2 py-2 text-xs text-gray-500 font-semibold">
            <Command.Item
              onSelect={() => handleCommand(() => console.log('Create issue'))}
              className="px-4 py-2 rounded hover:bg-gray-700 cursor-pointer text-white"
            >
              <div className="flex items-center gap-3">
                <span className="text-green-400">+</span>
                <span>Create new issue</span>
              </div>
            </Command.Item>
            <Command.Item
              onSelect={() => handleCommand(() => console.log('Close issue'))}
              className="px-4 py-2 rounded hover:bg-gray-700 cursor-pointer text-white"
            >
              <div className="flex items-center gap-3">
                <span className="text-purple-400">×</span>
                <span>Close current issue</span>
              </div>
            </Command.Item>
            <Command.Item
              onSelect={() => handleCommand(() => console.log('Link issue'))}
              className="px-4 py-2 rounded hover:bg-gray-700 cursor-pointer text-white"
            >
              <div className="flex items-center gap-3">
                <span className="text-blue-400">🔗</span>
                <span>Link to branch</span>
              </div>
            </Command.Item>
          </Command.Group>

          <Command.Separator className="h-px bg-gray-700 my-2" />

          <Command.Group heading="Settings" className="px-2 py-2 text-xs text-gray-500 font-semibold">
            <Command.Item
              onSelect={() => handleCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
              className="px-4 py-2 rounded hover:bg-gray-700 cursor-pointer text-white"
            >
              <div className="flex items-center gap-3">
                <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span>Toggle theme</span>
                <span className="ml-auto text-xs text-gray-500">
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              </div>
            </Command.Item>
            <Command.Item
              onSelect={() => handleCommand(() => console.log('Configure GitHub token'))}
              className="px-4 py-2 rounded hover:bg-gray-700 cursor-pointer text-white"
            >
              <div className="flex items-center gap-3">
                <span className="text-yellow-400">🔑</span>
                <span>Configure GitHub token</span>
              </div>
            </Command.Item>
          </Command.Group>

          <Command.Separator className="h-px bg-gray-700 my-2" />

          <Command.Group heading="Terminal" className="px-2 py-2 text-xs text-gray-500 font-semibold">
            <Command.Item
              onSelect={() => handleCommand(() => console.log('New terminal'))}
              className="px-4 py-2 rounded hover:bg-gray-700 cursor-pointer text-white"
            >
              <div className="flex items-center gap-3">
                <span className="text-green-400">+</span>
                <span>New terminal session</span>
              </div>
            </Command.Item>
            <Command.Item
              onSelect={() => handleCommand(() => console.log('Clear terminal'))}
              className="px-4 py-2 rounded hover:bg-gray-700 cursor-pointer text-white"
            >
              <div className="flex items-center gap-3">
                <span className="text-red-400">⌫</span>
                <span>Clear terminal</span>
              </div>
            </Command.Item>
          </Command.Group>
        </Command.List>

        <div className="border-t border-gray-700 px-4 py-2 text-xs text-gray-500 flex items-center gap-4">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">↓</kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">↵</kbd>
            <span>select</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">esc</kbd>
            <span>close</span>
          </div>
        </div>
      </Command>
    </div>
  );
}
