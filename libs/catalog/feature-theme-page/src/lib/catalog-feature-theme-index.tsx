import {
  listCatalogThemeDirectoryItems,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/data-access';
import { CatalogThemeHighlight } from '@lego-platform/catalog/ui';
import { buildThemePath } from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import styles from './catalog-feature-theme-index.module.css';

export function CatalogFeatureThemeIndex({
  themeDirectoryItems = listCatalogThemeDirectoryItems(),
}: {
  themeDirectoryItems?: readonly CatalogThemeDirectoryItem[];
}) {
  if (!themeDirectoryItems.length) {
    return null;
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <SectionHeading
          description="Use the theme directory when you already know the world you want to browse, from display-first Icons shelves to franchise-heavy lanes."
          eyebrow="Themes"
          title="Browse every theme"
          titleAs="h1"
        />
        <p className={styles.introMeta}>
          {themeDirectoryItems.length} theme pages · Discover stays better for
          mixed browsing
        </p>
      </section>
      <div className={styles.grid}>
        {themeDirectoryItems.map((themeDirectoryItem) => (
          <CatalogThemeHighlight
            className={styles.directoryTile}
            href={buildThemePath(themeDirectoryItem.themeSnapshot.slug)}
            imageUrl={themeDirectoryItem.imageUrl}
            key={themeDirectoryItem.themeSnapshot.slug}
            themeSnapshot={themeDirectoryItem.themeSnapshot}
            variant="portrait"
            visual={themeDirectoryItem.visual}
          />
        ))}
      </div>
    </div>
  );
}

export default CatalogFeatureThemeIndex;
