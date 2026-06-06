import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  applyThemeMode,
  getPreferredThemeMode,
  persistThemeMode,
  toggleThemeMode,
} from '@lego-platform/shared/design-tokens';
import { ThemeMode } from '@lego-platform/shared/types';
import { getThemeToggleLabel } from '@lego-platform/shared/util';

interface AdminNavigationItem {
  description: string;
  label: string;
  path: string;
}

@Component({
  selector: 'lego-shell-admin',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './shell-admin.html',
  styleUrl: './shell-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellAdminComponent {
  readonly productName = 'Brickhunt';
  readonly themeMode = signal<ThemeMode>(getPreferredThemeMode());
  readonly primaryNavigationItems: readonly AdminNavigationItem[] = [
    {
      description: 'Status van intake, discovery, sync en promote',
      label: 'Dashboard',
      path: '/dashboard',
    },
    {
      description: 'Bulk onboard nieuwe sets via setnummers',
      label: 'Catalog Intake',
      path: '/catalog-intake',
    },
    {
      description: 'Review suggested en discovered kandidaten',
      label: 'Discovery',
      path: '/discovery',
    },
    {
      description: 'Synchroniseer staging en promoveer catalogus',
      label: 'Sync & Promote',
      path: '/sync-promote',
    },
    {
      description: 'Compacte operationele checks',
      label: 'Health',
      path: '/health',
    },
    {
      description: 'Homepage rails en publieke theme-presentatie',
      label: 'CMS',
      path: '/cms',
    },
  ] as const;
  readonly secondaryNavigationItems: readonly AdminNavigationItem[] = [];

  get themeToggleLabel(): string {
    return getThemeToggleLabel(this.themeMode());
  }

  toggleTheme(): void {
    this.themeMode.update(toggleThemeMode);
    applyThemeMode(this.themeMode());
    persistThemeMode(this.themeMode());
  }
}
