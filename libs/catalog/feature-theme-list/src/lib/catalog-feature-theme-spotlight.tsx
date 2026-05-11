import type { CatalogThemeDirectoryItem } from '@lego-platform/catalog/util';
import {
  CatalogSectionShell,
  CatalogThemeHighlight,
} from '@lego-platform/catalog/ui';
import { buildThemePath } from '@lego-platform/shared/config';
import styles from './catalog-feature-theme-spotlight.module.css';

function getThemeItemKey(
  themeItem: CatalogThemeDirectoryItem,
  index: number,
): string {
  const themeSnapshot =
    themeItem.themeSnapshot as typeof themeItem.themeSnapshot & {
      id?: string;
      sourceThemeId?: string;
    };

  return (
    themeSnapshot.slug ||
    themeSnapshot.id ||
    themeSnapshot.sourceThemeId ||
    `${themeSnapshot.name}-${index}`
  );
}

function dedupeThemeItems(
  themeItems: readonly CatalogThemeDirectoryItem[],
): CatalogThemeDirectoryItem[] {
  const seenThemeKeys = new Set<string>();

  return themeItems.filter((themeItem, index) => {
    const themeKey = getThemeItemKey(themeItem, index);

    if (seenThemeKeys.has(themeKey)) {
      return false;
    }

    seenThemeKeys.add(themeKey);

    return true;
  });
}

export function CatalogFeatureThemeSpotlight({
  themeItems = [],
}: {
  themeItems?: readonly CatalogThemeDirectoryItem[];
}) {
  const renderedThemeItems = dedupeThemeItems(themeItems);

  if (!renderedThemeItems.length) {
    return null;
  }

  return (
    <CatalogSectionShell
      as="section"
      bodyClassName={styles.grid}
      className={styles.section}
      eyebrow="Meer om te ontdekken"
      headingClassName={styles.header}
      id="theme-spotlight"
      padding="default"
      signal={`${renderedThemeItems.length} thema's als je iets anders zoekt`}
      title="Botanicals, kunst of modulaire straten?"
      tone="plain"
    >
      {renderedThemeItems.map((themeItem, index) => (
        <div
          className={styles.spotlightItem}
          key={getThemeItemKey(themeItem, index)}
        >
          <CatalogThemeHighlight
            className={styles.spotlightTile}
            href={buildThemePath(themeItem.themeSnapshot.slug)}
            visual={themeItem.visual}
            imageUrl={themeItem.imageUrl}
            showFeatureSignature={false}
            themeSnapshot={themeItem.themeSnapshot}
            trackingEvent={{
              event: 'theme_tile_click',
              properties: {
                pageSurface: 'homepage',
                rankPosition: index + 1,
                sectionId: 'theme-spotlight',
                tileType: 'theme',
                theme: themeItem.themeSnapshot.name,
              },
            }}
            variant="feature"
          />
        </div>
      ))}
    </CatalogSectionShell>
  );
}

export default CatalogFeatureThemeSpotlight;
