import type { ReactNode } from 'react';
import {
  buildWebPath,
  getDefaultMarketAdjective,
  platformConfig,
  webNavigation,
  webPathnames,
} from '@lego-platform/shared/config';
import styles from './shell-web.module.css';
import { ShellWebAccountStatus } from './shell-web-account-status';
import { ShellWebSearchForm } from './shell-web-search-form';

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

export function ShellWeb({
  children,
  searchQuery,
}: {
  children: ReactNode;
  searchQuery?: string;
}) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBar}>
            <a
              className={styles.brandLink}
              href={buildWebPath(webPathnames.home)}
            >
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
            <ShellWebSearchForm
              className={styles.desktopSearch}
              inputId="site-search-desktop"
              query={searchQuery}
            />
            <div className={styles.headerUtilities}>
              <ShellWebAccountStatus variant="header" />
              <details className={styles.mobileMenu}>
                <summary className={styles.mobileMenuSummary}>
                  <span className={styles.mobileMenuLabel}>Menu</span>
                </summary>
                <div className={styles.mobileMenuPanel}>
                  <ShellWebSearchForm
                    className={styles.mobileSearch}
                    inputId="site-search-mobile"
                    query={searchQuery}
                  />
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
      <main className={styles.main} id="main-content" tabIndex={-1}>
        <div className={styles.mainInner}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.footerCopy}>
            Brickhunt helps you browse standout sets, compare reviewed{' '}
            {getDefaultMarketAdjective()} offers, and keep your own saves
            private.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ShellWeb;
