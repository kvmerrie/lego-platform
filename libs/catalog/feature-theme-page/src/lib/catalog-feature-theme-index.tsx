import {
  listCatalogThemeDirectoryItems,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/data-access';
import {
  CatalogSectionShell,
  CatalogThemeHighlight,
} from '@lego-platform/catalog/ui';
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
          description="Weet je al waar je naar zoekt? Begin hier en duik direct een thema in"
          eyebrow="Thema's"
          title="Alle thema's"
          titleAs="h1"
        />
        <p className={styles.introMeta}>
          {themeDirectoryItems.length} themapagina's · Ontdekken blijft beter
          voor gemengd bladeren
        </p>
      </section>
      <CatalogSectionShell
        as="section"
        bodyClassName={styles.directorySectionBody}
        bodySpacing="compact"
        description="Icons, Star Wars, Botanicals en meer. Kies hier de lijn waar je als eerste in wilt duiken."
        eyebrow="Begin hier"
        padding="default"
        signal={`${themeDirectoryItems.length} thema's`}
        spacing="default"
        title="Kies je thema"
        titleAs="h2"
        tone="default"
      >
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
      </CatalogSectionShell>
    </div>
  );
}

export default CatalogFeatureThemeIndex;
