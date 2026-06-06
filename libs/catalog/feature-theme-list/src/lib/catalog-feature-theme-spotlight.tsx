import type { CatalogHomepageSpotlightItem } from '@lego-platform/catalog/util';
import {
  CatalogSectionShell,
  CatalogVisualTile,
} from '@lego-platform/catalog/ui';
import styles from './catalog-feature-theme-spotlight.module.css';

function getSpotlightItemKey(
  item: CatalogHomepageSpotlightItem,
  index: number,
): string {
  return item.id || `${item.referenceType}:${item.referenceId ?? index}`;
}

function dedupeSpotlightItems(
  items: readonly CatalogHomepageSpotlightItem[],
): CatalogHomepageSpotlightItem[] {
  const seenKeys = new Set<string>();

  return items.filter((item, index) => {
    const key = getSpotlightItemKey(item, index);

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);

    return true;
  });
}

export function CatalogFeatureThemeSpotlight({
  description,
  eyebrow = 'Meer om te ontdekken',
  signal,
  themeItems = [],
  title = 'Botanicals, kunst of modulaire straten?',
}: {
  description?: string;
  eyebrow?: string;
  signal?: string;
  themeItems?: readonly CatalogHomepageSpotlightItem[];
  title?: string;
}) {
  const renderedThemeItems = dedupeSpotlightItems(themeItems);

  if (!renderedThemeItems.length) {
    return null;
  }

  return (
    <CatalogSectionShell
      as="section"
      bodyClassName={styles.grid}
      className={styles.section}
      description={description}
      eyebrow={eyebrow}
      headingClassName={styles.header}
      id="theme-spotlight"
      padding="default"
      signal={
        signal ??
        `${renderedThemeItems.length} thema's als je iets anders zoekt`
      }
      title={title}
      tone="plain"
    >
      {renderedThemeItems.map((themeItem, index) => (
        <div
          className={styles.spotlightItem}
          key={getSpotlightItemKey(themeItem, index)}
        >
          <CatalogVisualTile
            className={styles.spotlightTile}
            dataTile={themeItem.id}
            href={themeItem.href}
            imageAlt={themeItem.alt ?? `${themeItem.title} LEGO`}
            imageUrl={themeItem.imageUrl}
            meta={themeItem.description}
            title={themeItem.title}
            trackingEvent={{
              event: 'theme_tile_click',
              properties: {
                pageSurface: 'homepage',
                rankPosition: index + 1,
                sectionId: 'theme-spotlight',
                tileType: themeItem.referenceType,
                theme: themeItem.referenceId ?? themeItem.title,
              },
            }}
            visual={themeItem.visual}
          />
        </div>
      ))}
    </CatalogSectionShell>
  );
}

export default CatalogFeatureThemeSpotlight;
