'use client';

/**
 * DDLJ Theme Initializer
 * =======================
 * Syncs the Zustand theme store with the DOM <html> class.
 * Also persists theme preference to localStorage.
 * Handles: theme mode, accent color, compact mode.
 */

import { useEffect } from 'react';
import { useDDLJStore } from '@/lib/store';
import type { AccentColor } from '@/lib/store';

// Accent color → CSS variable mapping (same as settings-panel)
const accentColorMap: Record<AccentColor, Record<string, string>> = {
  emerald: {
    '--primary': '160 84% 39%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '160 84% 39%',
    '--accent': '160 84% 39%',
    '--accent-foreground': '0 0% 100%',
  },
  blue: {
    '--primary': '217 91% 60%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '217 91% 60%',
    '--accent': '217 91% 60%',
    '--accent-foreground': '0 0% 100%',
  },
  purple: {
    '--primary': '271 91% 65%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '271 91% 65%',
    '--accent': '271 91% 65%',
    '--accent-foreground': '0 0% 100%',
  },
  amber: {
    '--primary': '38 92% 50%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '38 92% 50%',
    '--accent': '38 92% 50%',
    '--accent-foreground': '0 0% 100%',
  },
  red: {
    '--primary': '0 84% 60%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '0 84% 60%',
    '--accent': '0 84% 60%',
    '--accent-foreground': '0 0% 100%',
  },
};

export function ThemeInitializer() {
  const { theme } = useDDLJStore();

  // Sync theme mode to DOM on mount and when it changes
  useEffect(() => {
    const applyTheme = (mode: 'dark' | 'light' | 'system') => {
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (mode === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // System preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    applyTheme(theme.mode);

    // Listen for system preference changes when in 'system' mode
    if (theme.mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme.mode]);

  // Apply accent color CSS variables
  useEffect(() => {
    const mapping = accentColorMap[theme.accent];
    if (!mapping) return;
    const root = document.documentElement;
    for (const [prop, value] of Object.entries(mapping)) {
      root.style.setProperty(prop, value);
    }
  }, [theme.accent]);

  // Apply compact mode class
  useEffect(() => {
    if (theme.compactMode) {
      document.documentElement.classList.add('compact');
    } else {
      document.documentElement.classList.remove('compact');
    }
  }, [theme.compactMode]);

  return null; // This component renders nothing
}
