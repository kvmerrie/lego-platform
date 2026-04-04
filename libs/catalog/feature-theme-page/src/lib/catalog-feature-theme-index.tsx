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
          description="Gebruik het themaoverzicht als je al weet in welke wereld je wilt bladeren, van displaygerichte Icons-planken tot franchise-zware themalijnen."
          eyebrow="Thema's"
          title="Blader door alle thema's"
          titleAs="h1"
        />
        <p className={styles.introMeta}>
          {themeDirectoryItems.length} themapagina's · Ontdekken blijft beter
          voor gemengd bladeren
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
