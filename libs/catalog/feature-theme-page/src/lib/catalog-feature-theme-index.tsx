import type { CSSProperties, ReactNode } from 'react';
import {
  type CatalogThemeDirectoryItem,
  type CatalogThemeVisual,
} from '@lego-platform/catalog/util';
import {
  CatalogPageIntro,
  CatalogSectionShell,
  CatalogThemeHighlight,
} from '@lego-platform/catalog/ui';
import {
  buildThemePath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import { getAccessibleForegroundColor } from '@lego-platform/shared/util';
import styles from './catalog-feature-theme-index.module.css';

export function CatalogFeatureThemeIndex({
  beforeDirectory,
  themeDirectoryItems = [],
  visual,
}: {
  beforeDirectory?: ReactNode;
  themeDirectoryItems?: readonly CatalogThemeDirectoryItem[];
  visual?: CatalogThemeVisual;
}) {
  if (!themeDirectoryItems.length) {
    return null;
  }

  const introTextColor = getAccessibleForegroundColor(visual?.backgroundColor);
  const introStyle = visual?.backgroundColor
    ? ({
        ...(visual.backgroundColor
          ? {
              '--theme-index-surface': visual.backgroundColor,
            }
          : {}),
        ...(introTextColor
          ? {
              '--theme-index-muted': introTextColor,
              '--theme-index-text': introTextColor,
            }
          : {}),
      } as CSSProperties)
    : undefined;

  return (
    <div className={styles.page}>
      <CatalogPageIntro
        breadcrumbs={{
          ariaLabel: 'Paginapad',
          items: [
            {
              href: buildWebPath(webPathnames.home),
              id: 'home',
              label: 'Start',
            },
            { id: 'theme-directory', label: "Thema's" },
          ],
        }}
        className={styles.intro}
        contentClassName={styles.introContent}
        style={introStyle}
      >
        <SectionHeading
          description="Weet je al waar je naar zoekt? Begin hier en duik direct een thema in"
          title="Alle thema's"
          titleAs="h1"
        />
        <p className={styles.introMeta}>
          {themeDirectoryItems.length} themapagina's · Ontdekken blijft beter
          voor gemengd bladeren
        </p>
      </CatalogPageIntro>
      {beforeDirectory}
      <CatalogSectionShell
        as="section"
        bodyClassName={styles.directorySectionBody}
        bodySpacing="compact"
        description="Icons, Star Wars, Botanicals en meer. Kies hier de lijn waar je als eerste in wilt duiken."
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
