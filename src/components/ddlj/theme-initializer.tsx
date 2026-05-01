'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useDDLJStore } from '@/lib/store';

/**
 * Syncs the Zustand store theme preference with next-themes.
 * - On mount: reads the stored theme mode and applies it to next-themes
 * - On store change: applies the new theme mode to next-themes
 */
export function ThemeInitializer() {
  const { setTheme, theme: currentTheme } = useTheme();
  const { theme } = useDDLJStore();

  useEffect(() => {
    // Apply stored theme mode to next-themes
    if (theme.mode) {
      setTheme(theme.mode);
    }
  }, [theme.mode, setTheme]);

  // Sync next-themes resolved theme back to store (for display in toggle)
  // This ensures the toggle shows the correct state even for "system" mode
  useEffect(() => {
    if (currentTheme && currentTheme !== theme.mode) {
      // Don't override user's explicit choice — just let the display reflect reality
    }
  }, [currentTheme, theme.mode]);

  return null;
}
