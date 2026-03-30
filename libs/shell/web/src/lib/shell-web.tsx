import type { ReactNode } from 'react';
import {
  platformConfig,
  webNavigation,
  webNavigationSections,
} from '@lego-platform/shared/config';
import {
  ActionLink,
  Badge,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import styles from './shell-web.module.css';
import { ShellWebAccountStatus } from './shell-web-account-status';
import { ShellWebThemeToggle } from './theme-toggle';

export function ShellWeb({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Surface
        as="header"
        className={styles.header}
        elevation="floating"
        padding="lg"
        tone="accent"
      >
        <div className={styles.headerRow}>
          <div className={styles.brand}>
            <span aria-hidden="true" className={styles.brandMark}>
              B
            </span>
            <div className={styles.brandContent}>
              <SectionHeading
                className={styles.heading}
                description={platformConfig.tagline}
                eyebrow="Curated LEGO collecting"
                title={platformConfig.productName}
                titleAs="h1"
                tone="hero"
              />
              <div className={styles.badgeRow}>
                <Badge tone="accent">Browse curated sets</Badge>
                <Badge tone="info">Save privately</Badge>
              </div>
            </div>
          </div>
          <div className={styles.headerUtilities}>
            <ShellWebAccountStatus />
            <ShellWebThemeToggle className={styles.toggle} />
          </div>
        </div>
        <nav aria-label="Primary" className={styles.nav}>
          {webNavigationSections.map((navigationSection) => {
            const navigationItems = webNavigation.filter(
              (navigationItem) =>
                navigationItem.sectionId === navigationSection.id,
            );

            return (
              <div className={styles.navSection} key={navigationSection.id}>
                <div className={styles.navSectionHeader}>
                  <p className={styles.navSectionTitle}>
                    {navigationSection.title}
                  </p>
                  <p className={styles.navSectionDescription}>
                    {navigationSection.description}
                  </p>
                </div>
                <div className={styles.navSectionLinks}>
                  {navigationItems.map((navigationItem) => (
                    <ActionLink
                      className={styles.navLink}
                      href={navigationItem.href}
                      key={navigationItem.href}
                      tone="card"
                    >
                      <span className={styles.navContext}>
                        {navigationItem.contextLabel}
                      </span>
                      <span className={styles.navLabel}>
                        {navigationItem.label}
                      </span>
                      {navigationItem.description ? (
                        <span className={styles.navDescription}>
                          {navigationItem.description}
                        </span>
                      ) : null}
                    </ActionLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </Surface>
      <main className={styles.main}>{children}</main>
      <Surface
        as="footer"
        className={styles.footer}
        elevation="rested"
        tone="muted"
      >
        <p className={styles.footerCopy}>
          Static-friendly catalog reads, with private collector saves through
          the BFF.
        </p>
      </Surface>
    </div>
  );
}

export default ShellWeb;
