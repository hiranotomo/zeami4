import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PanelLayout {
  leftPanelSize: number;
  rightPanelSize: number;
}

interface UIState {
  // Panel layout
  panelLayout: PanelLayout;
  setPanelLayout: (layout: PanelLayout) => void;

  // Selected issue
  selectedIssueId: number | null;
  setSelectedIssueId: (id: number | null) => void;

  // Command palette
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  // Terminal
  terminalSessionId: string | null;
  setTerminalSessionId: (id: string | null) => void;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

/**
 * UI State Store (Client State)
 *
 * Manages all client-side UI state:
 * - Panel layouts and sizes
 * - Selected items
 * - Modal/dialog states
 * - User preferences
 *
 * Persisted to localStorage for state restoration
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Panel layout
      panelLayout: {
        leftPanelSize: 25,
        rightPanelSize: 25,
      },
      setPanelLayout: (layout) => set({ panelLayout: layout }),

      // Selected issue
      selectedIssueId: null,
      setSelectedIssueId: (id) => set({ selectedIssueId: id }),

      // Command palette
      isCommandPaletteOpen: false,
      openCommandPalette: () => set({ isCommandPaletteOpen: true }),
      closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
      toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

      // Terminal
      terminalSessionId: null,
      setTerminalSessionId: (id) => set({ terminalSessionId: id }),

      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'zeami-ui-state',
      // Only persist certain fields
      partialize: (state) => ({
        panelLayout: state.panelLayout,
        theme: state.theme,
      }),
    }
  )
);
