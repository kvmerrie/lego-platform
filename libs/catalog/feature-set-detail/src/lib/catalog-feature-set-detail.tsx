import { getFeaturedCatalogSet } from '@lego-platform/catalog/data-access';

export function CatalogFeatureSetDetail() {
  const featuredCatalogSet = getFeaturedCatalogSet();

  return (
    <section className="hero-panel">
      <div className="stack">
        <p className="eyebrow">Featured set</p>
        <h2>{featuredCatalogSet.name}</h2>
        <p className="section-copy">{featuredCatalogSet.tagline}</p>
        <div className="pill-row">
          <span className="pill">{featuredCatalogSet.theme}</span>
          <span className="pill">{featuredCatalogSet.releaseYear}</span>
          <span className="pill">{featuredCatalogSet.priceRange}</span>
        </div>
      </div>
      <div className="surface stack">
        <p className="eyebrow">Collector highlights</p>
        <ul className="list">
          {featuredCatalogSet.collectorHighlights.map((collectorHighlight) => (
            <li key={collectorHighlight}>{collectorHighlight}</li>
          ))}
        </ul>
        <p className="muted">Availability: {featuredCatalogSet.availability}</p>
      </div>
    </section>
  );
}

export default CatalogFeatureSetDetail;
