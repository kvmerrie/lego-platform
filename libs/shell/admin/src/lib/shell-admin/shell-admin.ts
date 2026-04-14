import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { platformConfig } from '@lego-platform/shared/config';
import {
  applyThemeMode,
  getPreferredThemeMode,
  persistThemeMode,
  toggleThemeMode,
} from '@lego-platform/shared/design-tokens';
import { ThemeMode } from '@lego-platform/shared/types';
import { getThemeToggleLabel } from '@lego-platform/shared/util';

@Component({
  selector: 'lego-shell-admin',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './shell-admin.html',
  styleUrl: './shell-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellAdminComponent {
  readonly productName = platformConfig.productName;
  readonly themeMode = signal<ThemeMode>(getPreferredThemeMode());
  readonly navigationItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
    },
    {
      label: 'Merchants',
      path: '/merchants',
    },
    {
      label: 'Offer seeds',
      path: '/offer-seeds',
    },
    {
      label: 'Coverage',
      path: '/coverage',
    },
  ] as const;

  get themeToggleLabel(): string {
    return getThemeToggleLabel(this.themeMode());
  }

  toggleTheme(): void {
    this.themeMode.update(toggleThemeMode);
    applyThemeMode(this.themeMode());
    persistThemeMode(this.themeMode());
  }
}
