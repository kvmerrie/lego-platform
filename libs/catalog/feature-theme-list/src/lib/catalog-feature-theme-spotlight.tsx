import {
  listHomepageThemeSpotlightItems,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/data-access';
import {
  CatalogSectionShell,
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
    <CatalogSectionShell
      as="section"
      bodyClassName={styles.grid}
      className={styles.section}
      eyebrow="Meer om te ontdekken"
      headingClassName={styles.header}
      id="theme-spotlight"
      padding="relaxed"
      signal={`${themeItems.length} thema's als je iets anders zoekt`}
      title="Botanicals, kunst of modulaire straten?"
      tone="plain"
    >
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
    </CatalogSectionShell>
  );
}

export default CatalogFeatureThemeSpotlight;
