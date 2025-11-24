import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface TerminalProps {
  onConnectionChange?: (connected: boolean) => void;
}

interface PtyOutputPayload {
  session_id: string;
  data: string;
  closed: boolean;
}

interface CreateSessionResponse {
  session_id: string;
}

function Terminal({ onConnectionChange }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!terminalRef.current || isInitialized) return;

    let cleanup: (() => void) | undefined;

    const initTerminal = async () => {
      console.log('Terminal initialization started');

      // Initialize xterm.js
      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        scrollback: 10000,
        convertEol: false,
        allowTransparency: false,
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

      xterm.open(terminalRef.current!);

      // Wait for next tick to ensure DOM is fully rendered
      await new Promise(resolve => setTimeout(resolve, 0));

      fitAddon.fit();

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      // Handle user input - send to PTY
      xterm.onData((data) => {
        if (sessionIdRef.current) {
          invoke('write_to_pty', {
            sessionId: sessionIdRef.current,
            data: data,
          }).catch((error) => {
            console.error('Failed to write to PTY:', error);
            xterm.writeln(`\r\nError: ${error}`);
          });
        }
      });

      // Listen for PTY output from backend
      const unlisten = await listen<PtyOutputPayload>('pty-output', (event) => {
        const { data, closed } = event.payload;

        if (closed) {
          xterm.writeln('\r\n\r\nSession closed.');
          if (onConnectionChange) {
            onConnectionChange(false);
          }
        } else {
          xterm.write(data);
        }
      });

      unlistenRef.current = unlisten;

      // Ensure terminal is properly sized before creating PTY
      fitAddon.fit();

      // Get terminal size after final fit
      const rows = xterm.rows;
      const cols = xterm.cols;

      console.log(`Creating PTY with size: ${cols}x${rows}`);

      try {
        // Create PTY session on backend
        const response = await invoke<CreateSessionResponse>('create_pty_session', {
          shell: null, // Use default shell
          rows: rows,
          cols: cols,
        });

        sessionIdRef.current = response.session_id;

        if (onConnectionChange) {
          onConnectionChange(true);
        }
      } catch (error) {
        console.error('Failed to create PTY session:', error);
        xterm.writeln(`Failed to create terminal session: ${error}`);
        if (onConnectionChange) {
          onConnectionChange(false);
        }
      }

      // Handle window resize
      const handleResize = () => {
        if (fitAddonRef.current && xtermRef.current && sessionIdRef.current) {
          fitAddonRef.current.fit();
          const newRows = xtermRef.current.rows;
          const newCols = xtermRef.current.cols;

          invoke('resize_pty', {
            sessionId: sessionIdRef.current,
            rows: newRows,
            cols: newCols,
          }).catch((error) => {
            console.error('Failed to resize PTY:', error);
          });
        }
      };

      window.addEventListener('resize', handleResize);

      setIsInitialized(true);

      // Cleanup function
      cleanup = () => {
        console.log('Cleaning up terminal session');

        window.removeEventListener('resize', handleResize);

        if (unlistenRef.current) {
          unlistenRef.current();
          unlistenRef.current = null;
        }

        if (sessionIdRef.current) {
          const sessionId = sessionIdRef.current;
          sessionIdRef.current = null;
          invoke('close_pty_session', {
            sessionId: sessionId,
          }).catch((error) => {
            console.error('Failed to close PTY session:', error);
          });
        }

        if (xtermRef.current) {
          xtermRef.current.dispose();
          xtermRef.current = null;
        }

        if (onConnectionChange) {
          onConnectionChange(false);
        }
      };
    };

    initTerminal();

    // Return cleanup function for useEffect
    return () => {
      if (cleanup) {
        cleanup();
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
