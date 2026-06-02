import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';
import { App } from './app';

describe('App admin auth gate', () => {
  it('shows a login-required state when public Supabase env is configured but there is no session', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AdminAuthService,
          useValue: {
            initialize: async () => undefined,
            loginNotice: signal(null),
            signInWithEmail: async () => undefined,
            signOut: async () => undefined,
            state: signal({
              status: 'signed_out',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Login vereist');
    expect(text).toContain('Stuur loginlink');
  });

  it('shows a setup error when public Supabase env is missing', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AdminAuthService,
          useValue: {
            initialize: async () => undefined,
            loginNotice: signal(null),
            signInWithEmail: async () => undefined,
            signOut: async () => undefined,
            state: signal({
              message:
                'Admin login is niet geconfigureerd. Controleer de Supabase browser-env.',
              status: 'error',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Login vereist');
    expect(text).toContain(
      'Admin login is niet geconfigureerd. Controleer de Supabase browser-env.',
    );
    expect(text).not.toContain('Stuur loginlink');
  });

  it('shows a not-authorized state for a signed-in non-admin user', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AdminAuthService,
          useValue: {
            initialize: async () => undefined,
            loginNotice: signal(null),
            signInWithEmail: async () => undefined,
            signOut: async () => undefined,
            state: signal({
              email: 'collector@example.com',
              status: 'forbidden',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('collector@example.com');
    expect(text).toContain('heeft geen toegang tot Brickhunt Admin');
    expect(text).toContain('Log uit');
    expect(text).not.toContain('Stuur loginlink');
  });
});
