import type { ReactNode } from 'react';
import {
  buildWebPath,
  getDefaultMarketAdjective,
  platformConfig,
  webNavigation,
  webPathnames,
} from '@lego-platform/shared/config';
import { Icon } from '@lego-platform/shared/ui';
import styles from './shell-web.module.css';
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

const shellActionLinks = [
  {
    ariaLabel: 'Open profile',
    href: buildWebPath(webPathnames.account),
    iconName: 'user' as const,
    label: 'Profile',
  },
  {
    ariaLabel: 'Open saved lists',
    href: buildWebPath(webPathnames.wishlist),
    iconName: 'heart' as const,
    label: 'Lists',
  },
] as const;

function renderActionLinks({ variant }: { variant: 'desktop' | 'mobile' }) {
  return shellActionLinks.map((actionLink) =>
    variant === 'desktop' ? (
      <a
        aria-label={actionLink.ariaLabel}
        className={styles.iconActionLink}
        href={actionLink.href}
        key={actionLink.href}
      >
        <Icon name={actionLink.iconName} size={17} />
      </a>
    ) : (
      <a
        className={styles.mobileUtilityLink}
        href={actionLink.href}
        key={actionLink.href}
      >
        <Icon name={actionLink.iconName} size={18} />
        <span className={styles.mobileUtilityText}>{actionLink.label}</span>
      </a>
    ),
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
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBar}>
            <div className={styles.headerPrimary}>
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
            </div>
            <div className={styles.headerSecondary}>
              <ShellWebSearchForm
                className={styles.desktopSearch}
                inputId="site-search-desktop"
                query={searchQuery}
              />
              <nav aria-label="Quick actions" className={styles.desktopActions}>
                {renderActionLinks({ variant: 'desktop' })}
              </nav>
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
                  <nav
                    aria-label="Collector actions"
                    className={styles.mobileUtilityLinks}
                  >
                    {renderActionLinks({ variant: 'mobile' })}
                  </nav>
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
