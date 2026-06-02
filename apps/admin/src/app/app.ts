import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellAdminComponent } from '@lego-platform/shell/admin';
import { AdminAuthService } from './admin-auth.service';

@Component({
  imports: [ShellAdminComponent, RouterOutlet],
  selector: 'lego-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly adminAuth = inject(AdminAuthService);
  readonly loginEmail = signal('kvmerrie@gmail.com');

  constructor() {
    void this.adminAuth.initialize();
  }

  get authErrorMessage(): string {
    const state = this.adminAuth.state();

    return state.status === 'error' ? state.message : '';
  }

  get forbiddenEmail(): string {
    const state = this.adminAuth.state();

    return state.status === 'forbidden' ? (state.email ?? 'dit account') : '';
  }

  updateLoginEmail(event: Event): void {
    const input = event.target as HTMLInputElement | null;

    this.loginEmail.set(input?.value ?? '');
  }

  signIn(): void {
    void this.adminAuth.signInWithEmail(this.loginEmail());
  }

  signOut(): void {
    void this.adminAuth.signOut();
  }
}
