'use client';

/**
 * DDLJ Theme Initializer
 * =======================
 * Syncs the Zustand theme store with the DOM <html> class.
 * Also persists theme preference to localStorage.
 */

import { useEffect } from 'react';
import { useDDLJStore } from '@/lib/store';

export function ThemeInitializer() {
  const { theme, setThemeMode } = useDDLJStore();

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

  return null; // This component renders nothing
}
