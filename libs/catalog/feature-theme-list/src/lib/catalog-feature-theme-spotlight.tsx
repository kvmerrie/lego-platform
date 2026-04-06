import {
  listHomepageThemeSpotlightItems,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/data-access';
import {
  CatalogSectionHeader,
  CatalogThemeHighlight,
} from '@lego-platform/catalog/ui';
import { buildThemePath } from '@lego-platform/shared/config';
import styles from './catalog-feature-theme-spotlight.module.css';

export function CatalogFeatureThemeSpotlight({
  themeItems = listHomepageThemeSpotlightItems(),
}: {
  themeItems?: readonly CatalogThemeDirectoryItem[];
}) {
  if (!themeItems.length) {
    return null;
  }

  return (
    <section className={styles.section} id="theme-spotlight">
      <CatalogSectionHeader
        className={styles.headerBlock}
        eyebrow="Meer om te ontdekken"
        headingClassName={styles.header}
        signal={`${themeItems.length} thema's als je iets anders zoekt`}
        title="Botanicals, kunst of modulaire straten?"
      />
      <div className={styles.grid}>
        {themeItems.map((themeItem) => (
          <div
            className={styles.spotlightItem}
            key={themeItem.themeSnapshot.name}
          >
            <CatalogThemeHighlight
              className={styles.spotlightTile}
              href={buildThemePath(themeItem.themeSnapshot.slug)}
              visual={themeItem.visual}
              imageUrl={themeItem.imageUrl}
              themeSnapshot={themeItem.themeSnapshot}
              variant="feature"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureThemeSpotlight;
