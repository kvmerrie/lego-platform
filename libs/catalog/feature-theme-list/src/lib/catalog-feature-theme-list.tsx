import type { CatalogThemeDirectoryItem } from '@lego-platform/catalog/util';
import {
  CatalogSectionShell,
  CatalogThemeHighlight,
} from '@lego-platform/catalog/ui';
import {
  buildThemePath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { ActionLink } from '@lego-platform/shared/ui';
import { buildBrickhuntAnalyticsAttributes } from '@lego-platform/shared/util';
import styles from './catalog-feature-theme-list.module.css';

export function CatalogFeatureThemeList({
  themeItems = [],
  tone = 'default',
}: {
  themeItems?: readonly CatalogThemeDirectoryItem[];
  tone?: 'default' | 'inverse';
}) {
  if (!themeItems.length) {
    return null;
  }

  return (
    <CatalogSectionShell
      as="section"
      bodyClassName={styles.body}
      className={styles.section}
      eyebrow="Kies je hoek"
      headingClassName={styles.header}
      id="explore-themes"
      padding="default"
      signal={`${themeItems.length} thema’s om mee te starten + alle thema’s`}
      title="Fantasy, Star Wars of strak design?"
      tone={tone === 'inverse' ? 'inverse' : 'plain'}
    >
      <div className={styles.railViewport}>
        <div className={styles.railTrack}>
          {themeItems.map((themeItem, index) => (
            <CatalogThemeHighlight
              href={buildThemePath(themeItem.themeSnapshot.slug)}
              visual={themeItem.visual}
              imageUrl={themeItem.imageUrl}
              key={themeItem.themeSnapshot.name}
              themeSnapshot={themeItem.themeSnapshot}
              trackingEvent={{
                event: 'theme_tile_click',
                properties: {
                  pageSurface: 'homepage',
                  rankPosition: index + 1,
                  sectionId: 'explore-themes',
                  tileType: 'theme',
                  theme: themeItem.themeSnapshot.name,
                },
              }}
              variant="portrait"
            />
          ))}
          <div className={styles.allThemesTile}>
            <ActionLink
              className={styles.allThemesLink}
              href={buildWebPath(webPathnames.themes)}
              tone="card"
              {...buildBrickhuntAnalyticsAttributes({
                event: 'theme_tile_click',
                properties: {
                  pageSurface: 'homepage',
                  rankPosition: themeItems.length + 1,
                  sectionId: 'explore-themes',
                  tileType: 'all_themes',
                  theme: null,
                },
              })}
            >
              <p className={styles.allThemesEyebrow}>Verder</p>
              <h3 className={styles.allThemesTitle}>Alle thema&apos;s</h3>
              <p className={styles.allThemesCopy}>Zie alles bij elkaar</p>
            </ActionLink>
          </div>
        </div>
      </div>
    </CatalogSectionShell>
  );
}

export default CatalogFeatureThemeList;
