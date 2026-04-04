'use client';

import { useEffect, useState } from 'react';
import {
  applyThemeMode,
  getPreferredThemeMode,
  persistThemeMode,
  toggleThemeMode,
} from '@lego-platform/shared/design-tokens';
import { Button } from '@lego-platform/shared/ui';
import { ThemeMode } from '@lego-platform/shared/types';
import { getThemeToggleLabel } from '@lego-platform/shared/util';

export function ShellWebThemeToggle({ className }: { className?: string }) {
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
    <Button
      aria-label={getThemeToggleLabel(themeMode)}
      aria-pressed={themeMode === 'dark'}
      className={className}
      title={getThemeToggleLabel(themeMode)}
      tone="ghost"
      type="button"
      onClick={handleToggleTheme}
    >
      {themeMode === 'dark' ? 'Donkere modus' : 'Lichte modus'}
    </Button>
  );
}
