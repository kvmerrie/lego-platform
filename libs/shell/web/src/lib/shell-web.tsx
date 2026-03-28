import Link from 'next/link';
import type { ReactNode } from 'react';
import { platformConfig, webNavigation } from '@lego-platform/shared/config';
import { ShellWebThemeToggle } from './theme-toggle';

export function ShellWeb({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-header__row">
          <div className="stack">
            <p className="eyebrow">Phase 1 public portal</p>
            <div className="shell-brand">
              <span className="brand-mark">B</span>
              <div className="stack">
                <h1>{platformConfig.productName}</h1>
                <p className="muted">{platformConfig.tagline}</p>
              </div>
            </div>
          </div>
          <ShellWebThemeToggle />
        </div>
        <nav aria-label="Primary" className="shell-nav">
          {webNavigation.map((navigationItem) => (
            <Link href={navigationItem.href} key={navigationItem.href}>
              <span>{navigationItem.label}</span>
              <small>{navigationItem.description}</small>
            </Link>
          ))}
        </nav>
      </header>
      <main className="stack-xl">{children}</main>
      <footer className="shell-footer">
        <p>
          Phase 1 keeps catalog reads static-friendly while detail routes prove
          the first session-backed collection actions through the BFF.
        </p>
      </footer>
    </div>
  );
}

export default ShellWeb;
