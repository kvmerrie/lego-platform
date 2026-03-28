import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import { buildCatalogMetrics } from '@lego-platform/catalog/util';
import { CatalogSetCard } from '@lego-platform/catalog/ui';

export function CatalogFeatureSetList() {
  const catalogSetSummaries = listCatalogSetSummaries();
  const catalogMetrics = buildCatalogMetrics(catalogSetSummaries);

  return (
    <section id="catalog" className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Catalog</p>
        <h2>
          Curated flagship sets ready for static rendering and future ISR
          expansion.
        </h2>
        <p className="section-copy">
          The catalog layer is intentionally library-driven so future CMS,
          pricing, and affiliate integrations can plug into stable boundaries.
        </p>
      </header>
      <div className="metric-grid">
        {catalogMetrics.map((catalogMetric) => (
          <article className="metric-card" key={catalogMetric.label}>
            <p className="eyebrow">{catalogMetric.label}</p>
            <h3 className="metric-value">{catalogMetric.value}</h3>
            <p className="muted">{catalogMetric.detail}</p>
          </article>
        ))}
      </div>
      <div className="surface-grid">
        {catalogSetSummaries.map((catalogSetSummary) => (
          <CatalogSetCard
            key={catalogSetSummary.id}
            setSummary={catalogSetSummary}
          />
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureSetList;
