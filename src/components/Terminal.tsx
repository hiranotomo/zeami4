import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

interface TerminalProps {
  onConnectionChange?: (connected: boolean) => void;
}

function Terminal({ onConnectionChange }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!terminalRef.current || isInitialized) return;

    // Initialize xterm.js
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#f7768e',
        black: '#32344a',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#ad8ee6',
        cyan: '#449dab',
        white: '#787c99',
        brightBlack: '#444b6a',
        brightRed: '#ff7a93',
        brightGreen: '#b9f27c',
        brightYellow: '#ff9e64',
        brightBlue: '#7da6ff',
        brightMagenta: '#bb9af7',
        brightCyan: '#0db9d7',
        brightWhite: '#acb0d0',
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    setIsInitialized(true);

    // Welcome message
    xterm.writeln('Welcome to zeami4 Terminal');
    xterm.writeln('');
    xterm.writeln('This is a basic terminal skeleton.');
    xterm.writeln('PTY integration will be implemented in the next phase.');
    xterm.writeln('');

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Simulate connection
    if (onConnectionChange) {
      onConnectionChange(true);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      if (onConnectionChange) {
        onConnectionChange(false);
      }
    };
  }, [isInitialized, onConnectionChange]);

  return (
    <div className="w-full h-full p-4">
      <div
        ref={terminalRef}
        className="w-full h-full rounded-lg overflow-hidden"
      />
    </div>
  );
}

export default Terminal;
