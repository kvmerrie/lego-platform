import { listHomepageThemeSnapshots } from '@lego-platform/catalog/data-access';
import { CatalogThemeHighlight } from '@lego-platform/catalog/ui';
import type { CatalogThemeSnapshot } from '@lego-platform/catalog/util';
import { buildThemePath } from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import styles from './catalog-feature-theme-list.module.css';

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
          description="Jump straight into the strongest theme pages first, from flagship display worlds to franchise-heavy shelves."
          eyebrow="Explore"
          title="Explore by theme"
        />
        <p className={styles.signalRow}>
          {themeSnapshots.length} theme pages worth opening
        </p>
      </div>
      <div className={styles.rail}>
        {themeSnapshots.map((themeSnapshot) => (
          <CatalogThemeHighlight
            href={buildThemePath(themeSnapshot.slug)}
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
