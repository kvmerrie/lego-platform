import type { ReactNode } from 'react';
import { platformConfig, webNavigation } from '@lego-platform/shared/config';
import { ActionLink, Surface } from '@lego-platform/shared/ui';
import styles from './shell-web.module.css';
import { ShellWebThemeToggle } from './theme-toggle';

export function ShellWeb({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Surface as="header" className={styles.header} padding="lg">
        <div className={styles.headerRow}>
          <div className={styles.brandBlock}>
            <p className={styles.eyebrow}>Phase 1 public portal</p>
            <div className={styles.brand}>
              <span aria-hidden="true" className={styles.brandMark}>
                B
              </span>
              <div className={styles.brandText}>
                <h1 className={styles.brandTitle}>{platformConfig.productName}</h1>
                <p className={styles.tagline}>{platformConfig.tagline}</p>
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
      <Surface as="footer" className={styles.footer}>
        <p className={styles.footerCopy}>
          Phase 1 keeps catalog reads static-friendly while detail routes prove
          the first session-backed collection actions through the BFF.
        </p>
      </Surface>
    </div>
  );
}

export default ShellWeb;
