'use client';

import { useEffect, useState } from 'react';
import {
  applyThemeMode,
  getPreferredThemeMode,
  persistThemeMode,
  toggleThemeMode,
} from '@lego-platform/shared/design-tokens';
import { getThemeToggleLabel } from '@lego-platform/shared/ui';
import { ThemeMode } from '@lego-platform/shared/types';

export function ShellWebThemeToggle() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  useEffect(() => {
    const preferredThemeMode = getPreferredThemeMode();

    setThemeMode(preferredThemeMode);
    applyThemeMode(preferredThemeMode);
  }, []);

  function handleToggleTheme() {
    const nextThemeMode = toggleThemeMode(themeMode);

    setThemeMode(nextThemeMode);
    applyThemeMode(nextThemeMode);
    persistThemeMode(nextThemeMode);
  }

  return (
    <button className="theme-toggle" type="button" onClick={handleToggleTheme}>
      {getThemeToggleLabel(themeMode)}
    </button>
  );
}
