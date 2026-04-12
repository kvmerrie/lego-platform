import type { ReactNode } from 'react';
import {
  buildWebPath,
  platformConfig,
  webNavigation,
  webPathnames,
} from '@lego-platform/shared/config';
import { Container, Icon } from '@lego-platform/shared/ui';
import styles from './shell-web.module.css';
import { ShellWebAnalyticsListener } from './shell-web-analytics-listener';
import { ShellWebFollowLink } from './shell-web-follow-link';
import { ShellWebHeaderReveal } from './shell-web-header-reveal';
import { ShellWebMobileTabBar } from './shell-web-mobile-tab-bar';
import { ShellWebMobileViewportOffset } from './shell-web-mobile-viewport-offset';
import { ShellWebSearchOverlayScrollRestore } from './shell-web-search-overlay-scroll-restore';
import { ShellWebSearchForm } from './shell-web-search-form';

function renderDesktopNavigationLinks() {
  return [
    ...webNavigation.map((navigationItem) => (
      <a
        className={styles.navLink}
        href={navigationItem.href}
        key={navigationItem.href}
      >
        {navigationItem.label}
      </a>
    )),
    <ShellWebFollowLink key="following-desktop" variant="desktop" />,
  ];
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

function renderDesktopActionLinks() {
  return shellActionLinks.map((actionLink) => (
    <a
      aria-label={actionLink.ariaLabel}
      className={styles.iconActionLink}
      href={actionLink.href}
      key={actionLink.href}
    >
      <Icon name={actionLink.iconName} size={17} />
    </a>
  ));
}

export function ShellWeb({
  children,
  searchQuery,
  showMobileSearchOverlay = true,
}: {
  children: ReactNode;
  searchQuery?: string;
  showMobileSearchOverlay?: boolean;
}) {
  return (
    <div className={styles.shell}>
      <ShellWebAnalyticsListener />
      <ShellWebHeaderReveal />
      <ShellWebMobileViewportOffset />
      <ShellWebSearchOverlayScrollRestore />
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
                {renderDesktopNavigationLinks()}
              </nav>
            </div>
            <div className={styles.headerSecondary}>
              <ShellWebSearchForm
                className={styles.desktopSearch}
                inputId="site-search-desktop"
                query={searchQuery}
              />
              <nav aria-label="Snelle acties" className={styles.desktopActions}>
                {renderDesktopActionLinks()}
              </nav>
              <a
                aria-label="Ga naar account"
                className={`${styles.iconActionLink} ${styles.mobileAccountLink}`}
                href={buildWebPath(webPathnames.account)}
              >
                <Icon name="user" size={17} />
              </a>
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
            Brickhunt laat snel zien welke doos je wilt hebben en waar de prijs
            nu goed zit.
          </p>
        </Container>
      </footer>
      {showMobileSearchOverlay ? (
        <ShellWebSearchForm
          hideTrigger
          inputId="site-search-mobile-shell"
          query={searchQuery}
          variant="mobile-overlay"
        />
      ) : null}
      <ShellWebMobileTabBar />
    </div>
  );
}

export default ShellWeb;
