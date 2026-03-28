import { listHomepageSets } from '@lego-platform/catalog/data-access';
import { CatalogSetCard } from '@lego-platform/catalog/ui';
import { SectionHeading } from '@lego-platform/shared/ui';
import styles from './catalog-feature-set-list.module.css';

export function CatalogFeatureSetList() {
  const homepageSets = listHomepageSets();

  return (
    <section className={styles.section} id="featured-sets">
      <SectionHeading
        className={styles.header}
        description="Each card links into a static-friendly detail route backed by the catalog domain contract rather than page-local data."
        eyebrow="Featured sets"
        title="Start with a focused set list that proves the read-side architecture."
      />
      <div className={styles.grid}>
        {homepageSets.map((catalogSetSummary) => (
          <CatalogSetCard
            key={catalogSetSummary.id}
            href={`/sets/${catalogSetSummary.slug}`}
            setSummary={catalogSetSummary}
          />
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureSetList;
