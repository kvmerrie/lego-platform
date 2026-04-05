import type { ReactNode } from 'react';
import {
  buildWebPath,
  platformConfig,
  webNavigation,
  webPathnames,
} from '@lego-platform/shared/config';
import { Container, Icon } from '@lego-platform/shared/ui';
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
    ariaLabel: 'Ga naar account',
    href: buildWebPath(webPathnames.account),
    iconName: 'user' as const,
    label: 'Account',
  },
  {
    ariaLabel: 'Ga naar lijsten',
    href: buildWebPath(webPathnames.wishlist),
    iconName: 'heart' as const,
    label: 'Lijsten',
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
        Ga direct naar de hoofdinhoud
      </a>
      <header className={styles.header}>
        <Container className={styles.headerInner}>
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
              <nav aria-label="Hoofdnavigatie" className={styles.desktopNav}>
                {renderNavigationLinks({ variant: 'desktop' })}
              </nav>
            </div>
            <div className={styles.headerSecondary}>
              <ShellWebSearchForm
                className={styles.desktopSearch}
                inputId="site-search-desktop"
                query={searchQuery}
              />
              <ShellWebSearchForm
                className={styles.mobileSearchTrigger}
                inputId="site-search-mobile"
                query={searchQuery}
                variant="mobile-overlay"
              />
              <nav aria-label="Snelle acties" className={styles.desktopActions}>
                {renderActionLinks({ variant: 'desktop' })}
              </nav>
              <details className={styles.mobileMenu}>
                <summary className={styles.mobileMenuSummary}>
                  <span className={styles.mobileMenuLabel}>Menu</span>
                </summary>
                <div className={styles.mobileMenuPanel}>
                  <nav
                    aria-label="Mobiele hoofdnavigatie"
                    className={styles.mobileNav}
                  >
                    {renderNavigationLinks({ variant: 'mobile' })}
                  </nav>
                  <nav
                    aria-label="Collectoracties"
                    className={styles.mobileUtilityLinks}
                  >
                    {renderActionLinks({ variant: 'mobile' })}
                  </nav>
                </div>
              </details>
            </div>
          </div>
        </Container>
      </header>
      <main className={styles.main} id="main-content" tabIndex={-1}>
        <Container className={styles.mainInner}>{children}</Container>
      </main>
      <footer className={styles.footer}>
        <Container className={styles.footerInner}>
          <p className={styles.footerCopy}>
            Brickhunt laat snel zien welke walker, toren of bloemenboeket je
            wilt hebben, en waar de prijs nu goed zit.
          </p>
        </Container>
      </footer>
    </div>
  );
}

export default ShellWeb;
