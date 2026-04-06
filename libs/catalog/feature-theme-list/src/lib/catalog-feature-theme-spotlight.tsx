import {
  listHomepageThemeSpotlightItems,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/data-access';
import { CatalogThemeHighlight } from '@lego-platform/catalog/ui';
import { buildThemePath } from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
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
      <div className={styles.headerBlock}>
        <SectionHeading
          className={styles.header}
          eyebrow="Meer om te ontdekken"
          title="Botanicals, kunst of modulaire straten?"
        />
        <p className={styles.signalRow}>
          {themeItems.length} thema&apos;s als je iets anders zoekt
        </p>
      </div>
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
