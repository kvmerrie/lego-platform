import { Injectable, signal } from '@angular/core';
import {
  buildSupabaseAuthCallbackUrl,
  completeSupabaseAuthCallback,
  getBrowserAccessToken,
  getBrowserSupabaseClient,
  isBrowserSupabaseAuthAvailable,
  signInWithSupabaseOtp,
  signOutSupabaseBrowserSession,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';

type AdminAuthState =
  | {
      email: string | null;
      status: 'authenticated';
    }
  | {
      email: string | null;
      status: 'forbidden';
    }
  | {
      message: string;
      status: 'error';
    }
  | {
      status: 'loading';
    }
  | {
      status: 'signed_out';
    };

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  readonly state = signal<AdminAuthState>({
    status: 'loading',
  });
  readonly loginNotice = signal<string | null>(null);

  private unsubscribeFromAuthChanges: (() => void) | undefined;

  async initialize(): Promise<void> {
    if (!isBrowserSupabaseAuthAvailable()) {
      this.state.set({
        message:
          'Admin login is niet geconfigureerd. Controleer de Supabase browser-env.',
        status: 'error',
      });
      return;
    }

    this.unsubscribeFromAuthChanges ??= subscribeToSupabaseAuthChanges(() => {
      void this.refreshSession();
    });

    if (window.location.pathname === '/auth/callback') {
      try {
        const { nextPath } = await completeSupabaseAuthCallback();

        window.history.replaceState(null, '', nextPath);
        this.loginNotice.set('Je bent ingelogd.');
      } catch (error) {
        this.state.set({
          message:
            error instanceof Error
              ? error.message
              : 'Inloggen kon niet worden afgerond.',
          status: 'error',
        });
        return;
      }
    }

    await this.refreshSession();
  }

  async refreshSession(): Promise<void> {
    if (!isBrowserSupabaseAuthAvailable()) {
      this.state.set({
        message:
          'Admin login is niet geconfigureerd. Controleer de Supabase browser-env.',
        status: 'error',
      });
      return;
    }

    const {
      data: { session },
    } = await getBrowserSupabaseClient().auth.getSession();

    if (!session?.access_token) {
      this.state.set({
        status: 'signed_out',
      });
      return;
    }

    await this.verifyAdminAccess({
      accessToken: session.access_token,
      email: session.user.email ?? null,
    });
  }

  private async verifyAdminAccess({
    accessToken,
    email,
  }: {
    accessToken: string;
    email: string | null;
  }): Promise<void> {
    try {
      const response = await fetch('/api/v1/admin/runtime-config', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        this.state.set({
          email,
          status: 'authenticated',
        });
        return;
      }

      if (response.status === 401) {
        this.state.set({
          status: 'signed_out',
        });
        return;
      }

      if (response.status === 403) {
        this.state.set({
          email,
          status: 'forbidden',
        });
        return;
      }

      this.state.set({
        message: `Adminrechten konden niet worden gecontroleerd. API status: ${response.status}.`,
        status: 'error',
      });
    } catch {
      this.state.set({
        message:
          'Adminrechten konden niet worden gecontroleerd. Controleer of de admin API bereikbaar is.',
        status: 'error',
      });
    }
  }

  async signInWithEmail(email: string): Promise<void> {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      this.loginNotice.set('Vul je e-mailadres in.');
      return;
    }

    const response = await signInWithSupabaseOtp({
      email: normalizedEmail,
      emailRedirectTo: buildSupabaseAuthCallbackUrl(window.location),
    });

    if (response.error) {
      this.loginNotice.set(response.error.message);
      return;
    }

    this.loginNotice.set('Check je mail voor de admin loginlink.');
  }

  async signOut(): Promise<void> {
    await signOutSupabaseBrowserSession();
    this.loginNotice.set('Je bent uitgelogd.');
    this.state.set({
      status: 'signed_out',
    });
  }

  async getAccessToken(): Promise<string | undefined> {
    return getBrowserAccessToken();
  }
}
