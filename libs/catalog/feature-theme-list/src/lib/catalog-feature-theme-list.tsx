import { listHomepageThemeSnapshots } from '@lego-platform/catalog/data-access';
import { CatalogThemeHighlight } from '@lego-platform/catalog/ui';
import {
  buildCatalogThemeBrowseId,
  type CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import styles from './catalog-feature-theme-list.module.css';

function getThemeBrowseHref(themeName: string): string {
  return `${buildWebPath(webPathnames.discover)}#${buildCatalogThemeBrowseId(
    themeName,
  )}`;
}

export function CatalogFeatureThemeList({
  themeSnapshots = listHomepageThemeSnapshots(),
}: {
  themeSnapshots?: readonly CatalogThemeSnapshot[];
}) {
  if (!themeSnapshots.length) {
    return null;
  }

  return (
    <section className={styles.section} id="explore-themes">
      <div className={styles.headerBlock}>
        <SectionHeading
          className={styles.header}
          description="Jump straight into the strongest lanes first, from flagship display worlds to franchise-heavy shelves."
          eyebrow="Explore"
          title="Explore by theme"
        />
        <p className={styles.signalRow}>
          {themeSnapshots.length} browse lanes worth opening
        </p>
      </div>
      <div className={styles.rail}>
        {themeSnapshots.map((themeSnapshot) => (
          <CatalogThemeHighlight
            href={getThemeBrowseHref(themeSnapshot.name)}
            key={themeSnapshot.name}
            themeSnapshot={themeSnapshot}
            variant="tile"
          />
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureThemeList;
