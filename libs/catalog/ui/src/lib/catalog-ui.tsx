import {
  CatalogSetSummary,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';

export function CatalogSetCard({
  setSummary,
}: {
  setSummary: CatalogSetSummary;
}) {
  return (
    <article className="surface stack">
      <p className="eyebrow">{setSummary.theme}</p>
      <h3 className="surface-title">{setSummary.name}</h3>
      <p className="muted">{setSummary.collectorAngle}</p>
      <dl className="detail-list">
        <div>
          <dt>Pieces</dt>
          <dd>{setSummary.pieces.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Release</dt>
          <dd>{setSummary.releaseYear}</dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd>{setSummary.priceRange}</dd>
        </div>
      </dl>
    </article>
  );
}

export function CatalogThemeHighlight({
  themeSnapshot,
}: {
  themeSnapshot: CatalogThemeSnapshot;
}) {
  return (
    <article className="surface stack">
      <p className="eyebrow">{themeSnapshot.name}</p>
      <h3 className="surface-title">{themeSnapshot.signatureSet}</h3>
      <p className="muted">{themeSnapshot.momentum}</p>
      <p className="pill">{themeSnapshot.setCount} tracked sets</p>
    </article>
  );
}

export function CatalogUi() {
  return (
    <section className="surface stack">
      <p className="eyebrow">Catalog UI</p>
      <h2 className="surface-title">
        Presentational building blocks for set and theme storytelling.
      </h2>
    </section>
  );
}

export default CatalogUi;
