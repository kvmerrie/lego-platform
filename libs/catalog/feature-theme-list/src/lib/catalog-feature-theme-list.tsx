import {
  listHomepageThemeDirectoryItems,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/data-access';
import { CatalogThemeHighlight } from '@lego-platform/catalog/ui';
import { buildThemePath } from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import styles from './catalog-feature-theme-list.module.css';

export function CatalogFeatureThemeList({
  themeItems = listHomepageThemeDirectoryItems(),
}: {
  themeItems?: readonly CatalogThemeDirectoryItem[];
}) {
  if (!themeItems.length) {
    return null;
  }

  return (
    <section className={styles.section} id="explore-themes">
      <div className={styles.headerBlock}>
        <SectionHeading
          className={styles.header}
          description="Start with the strongest theme lanes first, then jump into a focused page when one world pulls you in."
          eyebrow="Browse themes"
          title="Explore by theme"
        />
        <p className={styles.signalRow}>
          {themeItems.length} theme pages ready to browse
        </p>
      </div>
      <div className={styles.rail}>
        {themeItems.map((themeItem) => (
          <CatalogThemeHighlight
            href={buildThemePath(themeItem.themeSnapshot.slug)}
            imageUrl={themeItem.imageUrl}
            key={themeItem.themeSnapshot.name}
            themeSnapshot={themeItem.themeSnapshot}
            variant="tile"
          />
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureThemeList;
