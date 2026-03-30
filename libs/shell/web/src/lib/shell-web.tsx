import type { ReactNode } from 'react';
import { platformConfig, webNavigation } from '@lego-platform/shared/config';
import styles from './shell-web.module.css';
import { ShellWebAccountStatus } from './shell-web-account-status';

function renderNavigationLinks({ variant }: { variant: 'desktop' | 'mobile' }) {
  return webNavigation.map((navigationItem) => (
    <a
      className={variant === 'desktop' ? styles.navLink : styles.mobileNavLink}
      href={navigationItem.href}
      key={navigationItem.href}
    >
      {navigationItem.label}
    </a>
  ));
}

export function ShellWeb({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBar}>
            <a className={styles.brandLink} href="/">
              <span aria-hidden="true" className={styles.brandMark}>
                B
              </span>
              <span className={styles.brandName}>
                {platformConfig.productName}
              </span>
            </a>
            <nav aria-label="Primary" className={styles.desktopNav}>
              {renderNavigationLinks({ variant: 'desktop' })}
            </nav>
            <div className={styles.headerUtilities}>
              <ShellWebAccountStatus variant="header" />
              <details className={styles.mobileMenu}>
                <summary className={styles.mobileMenuSummary}>
                  <span className={styles.mobileMenuLabel}>Menu</span>
                </summary>
                <div className={styles.mobileMenuPanel}>
                  <nav aria-label="Mobile primary" className={styles.mobileNav}>
                    {renderNavigationLinks({ variant: 'mobile' })}
                  </nav>
                  <ShellWebAccountStatus variant="menu" />
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.mainInner}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.footerCopy}>
            Curated browsing, private collector saves, and reviewed Dutch price
            guidance where available.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ShellWeb;
