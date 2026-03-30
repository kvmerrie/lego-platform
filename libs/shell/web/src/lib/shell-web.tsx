import type { ReactNode } from 'react';
import { platformConfig, webNavigation } from '@lego-platform/shared/config';
import { VisuallyHidden } from '@lego-platform/shared/ui';
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

function renderSearchForm({
  className,
  query,
}: {
  className?: string;
  query?: string;
}) {
  return (
    <form action="/search" className={className} role="search">
      <VisuallyHidden>Search the catalog</VisuallyHidden>
      <input
        aria-label="Search sets by name or set number"
        className={styles.searchInput}
        defaultValue={query}
        name="q"
        placeholder="Search sets or number"
        type="search"
      />
      <button className={styles.searchSubmit} type="submit">
        Search
      </button>
    </form>
  );
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
            {renderSearchForm({
              className: styles.desktopSearch,
              query: searchQuery,
            })}
            <div className={styles.headerUtilities}>
              <ShellWebAccountStatus variant="header" />
              <details className={styles.mobileMenu}>
                <summary className={styles.mobileMenuSummary}>
                  <span className={styles.mobileMenuLabel}>Menu</span>
                </summary>
                <div className={styles.mobileMenuPanel}>
                  {renderSearchForm({
                    className: styles.mobileSearch,
                    query: searchQuery,
                  })}
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
