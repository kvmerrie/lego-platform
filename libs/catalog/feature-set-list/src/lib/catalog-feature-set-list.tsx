import { listHomepageSets } from '@lego-platform/catalog/data-access';
import { CatalogSetCard } from '@lego-platform/catalog/ui';

export function CatalogFeatureSetList() {
  const homepageSets = listHomepageSets();

  return (
    <section id="featured-sets" className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Featured sets</p>
        <h2>Start with a focused set list that proves the read-side architecture.</h2>
        <p className="section-copy">
          Each card links into a static-friendly detail route backed by the
          catalog domain contract rather than page-local data.
        </p>
      </header>
      <div className="surface-grid">
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
