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
  tone = 'default',
}: {
  themeItems?: readonly CatalogThemeDirectoryItem[];
  tone?: 'default' | 'inverse';
}) {
  if (!themeItems.length) {
    return null;
  }

  return (
    <section
      className={`${styles.section} ${
        tone === 'inverse' ? styles.sectionInverse : ''
      }`}
      id="explore-themes"
    >
      <div className={styles.headerBlock}>
        <SectionHeading
          className={styles.header}
          eyebrow="LEGO-werelden"
          title="Rivendell, toren of supercar?"
        />
        <p className={styles.signalRow}>
          {themeItems.length} werelden, {themeItems.length} totaal andere dozen
        </p>
      </div>
      <div className={styles.rail}>
        {themeItems.map((themeItem) => (
          <CatalogThemeHighlight
            href={buildThemePath(themeItem.themeSnapshot.slug)}
            visual={themeItem.visual}
            imageUrl={themeItem.imageUrl}
            key={themeItem.themeSnapshot.name}
            themeSnapshot={themeItem.themeSnapshot}
            variant="portrait"
          />
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureThemeList;
