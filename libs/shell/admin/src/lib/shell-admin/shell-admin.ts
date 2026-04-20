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
  readonly primaryNavigationItems = [
    {
      description: 'Wat vandaag aandacht nodig heeft',
      label: 'Workbench',
      path: '/workbench',
    },
    {
      description: 'Voeg een set toe en zet de eerste offer live',
      label: 'New set',
      path: '/new-set',
    },
    {
      description: 'Vind en beheer elke set in de catalogus',
      label: 'Sets',
      path: '/sets',
    },
  ] as const;
  readonly secondaryNavigationItems = [
    {
      description: 'Korte uitleg van de operatorflow',
      label: 'Zo werkt het',
      path: '/workflow',
    },
    {
      description: 'Zoek meerdere missende sets en start één bulk intake-run',
      label: 'Bulk onboarding',
      path: '/bulk-onboarding',
    },
    {
      description: 'Handmatige seed-URL’s beheren',
      label: 'Offer seeds',
      path: '/offer-seeds',
    },
    {
      description: 'Merchantinstellingen en bronstatus',
      label: 'Merchants',
      path: '/merchants',
    },
    {
      description: 'Brede dekkingchecks en uitzonderingen',
      label: 'Coverage diagnostics',
      path: '/coverage',
    },
    {
      description: 'Rauwere operationele checks',
      label: 'Operations',
      path: '/operations',
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
