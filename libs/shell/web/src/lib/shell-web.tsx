import type { ReactNode } from 'react';
import { platformConfig, webNavigation } from '@lego-platform/shared/config';
import {
  ActionLink,
  Badge,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import styles from './shell-web.module.css';
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
                eyebrow="Collector warmth with retail precision"
                title={platformConfig.productName}
                titleAs="h1"
                tone="hero"
              />
              <div className={styles.badgeRow}>
                <Badge tone="accent">Phase 1 public portal</Badge>
                <Badge tone="info">Static-friendly discovery</Badge>
              </div>
            </div>
          </div>
          <ShellWebThemeToggle className={styles.toggle} />
        </div>
        <nav aria-label="Primary" className={styles.nav}>
          {webNavigation.map((navigationItem) => (
            <ActionLink
              className={styles.navLink}
              href={navigationItem.href}
              key={navigationItem.href}
              tone="card"
            >
              <span className={styles.navLabel}>{navigationItem.label}</span>
              {navigationItem.description ? (
                <span className={styles.navDescription}>
                  {navigationItem.description}
                </span>
              ) : null}
            </ActionLink>
          ))}
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
          Phase 1 keeps catalog reads static-friendly while detail routes prove
          the first session-backed collection actions through the BFF.
        </p>
      </Surface>
    </div>
  );
}

export default ShellWeb;
