'use client';

/**
 * DDLJ Trading System — Theme Initializer
 * Applies stored theme preferences on mount.
 */

import { useEffect } from 'react';
import { useDDLJStore, type AccentColor } from '@/lib/store';

const accentColorMap: Record<AccentColor, Record<string, string>> = {
  emerald: { '--primary': '160 84% 39%', '--primary-foreground': '0 0% 100%', '--ring': '160 84% 39%', '--accent': '160 84% 39%', '--accent-foreground': '0 0% 100%' },
  blue: { '--primary': '217 91% 60%', '--primary-foreground': '0 0% 100%', '--ring': '217 91% 60%', '--accent': '217 91% 60%', '--accent-foreground': '0 0% 100%' },
  purple: { '--primary': '271 91% 65%', '--primary-foreground': '0 0% 100%', '--ring': '271 91% 65%', '--accent': '271 91% 65%', '--accent-foreground': '0 0% 100%' },
  amber: { '--primary': '38 92% 50%', '--primary-foreground': '0 0% 100%', '--ring': '38 92% 50%', '--accent': '38 92% 50%', '--accent-foreground': '0 0% 100%' },
  red: { '--primary': '0 84% 60%', '--primary-foreground': '0 0% 100%', '--ring': '0 84% 60%', '--accent': '0 84% 60%', '--accent-foreground': '0 0% 100%' },
};

export function ThemeInitializer() {
  const { theme } = useDDLJStore();

  useEffect(() => {
    // Apply theme mode
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme.mode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    // Apply accent color
    const mapping = accentColorMap[theme.accent];
    if (mapping) {
      for (const [prop, value] of Object.entries(mapping)) {
        document.documentElement.style.setProperty(prop, value);
      }
    }

    // Apply compact mode
    if (theme.compactMode) {
      document.documentElement.classList.add('compact');
    } else {
      document.documentElement.classList.remove('compact');
    }
  }, [theme]);

  return null;
}
