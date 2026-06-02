import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  applyThemeMode,
  ensureThemeStyles,
  getPreferredThemeMode,
  persistThemeMode,
} from '@lego-platform/shared/design-tokens';
import { appRoutes } from './app.routes';
import { adminAuthInterceptor } from './admin-auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([adminAuthInterceptor])),
    provideRouter(appRoutes),
    provideAppInitializer(() => {
      ensureThemeStyles();

      const preferredThemeMode = getPreferredThemeMode();

      applyThemeMode(preferredThemeMode);
      persistThemeMode(preferredThemeMode);
    }),
  ],
};
