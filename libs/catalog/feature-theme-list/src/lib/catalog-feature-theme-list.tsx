import {
  listHomepageThemeDirectoryItems,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/data-access';
import {
  CatalogSectionHeader,
  CatalogThemeHighlight,
} from '@lego-platform/catalog/ui';
import { buildThemePath } from '@lego-platform/shared/config';
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
      <CatalogSectionHeader
        className={styles.headerBlock}
        eyebrow="Kies je hoek"
        headingClassName={styles.header}
        signal={`${themeItems.length} thema’s met een totaal ander displaygevoel`}
        title="Fantasy, Star Wars of strak design?"
        tone={tone === 'inverse' ? 'inverse' : 'default'}
      />
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
