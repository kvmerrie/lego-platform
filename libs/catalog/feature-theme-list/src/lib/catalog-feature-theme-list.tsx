import {
  listHomepageThemeDirectoryItems,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/data-access';
import {
  CatalogSectionShell,
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
    <CatalogSectionShell
      as="section"
      bodyClassName={styles.rail}
      className={styles.section}
      eyebrow="Kies je hoek"
      headingClassName={styles.header}
      id="explore-themes"
      padding="none"
      signal={`${themeItems.length} thema’s met een totaal ander displaygevoel`}
      title="Fantasy, Star Wars of strak design?"
      tone={tone === 'inverse' ? 'inverse' : 'plain'}
    >
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
    </CatalogSectionShell>
  );
}

export default CatalogFeatureThemeList;
