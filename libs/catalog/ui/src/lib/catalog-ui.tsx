import Link from 'next/link';
import type {
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';

export function CatalogSetCard({
  href,
  setSummary,
}: {
  href?: string;
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
      {href ? (
        <Link className="link-button" href={href}>
          View set details
        </Link>
      ) : null}
    </article>
  );
}

export function CatalogHomepageIntro() {
  return (
    <section className="hero-panel">
      <div className="stack">
        <p className="eyebrow">Catalog discovery</p>
        <h2>Browse a focused first slice of the LEGO collector experience.</h2>
        <p className="section-copy">
          The homepage stays intentionally small: a short introduction, a
          curated featured list, and detail routes powered by stable catalog
          contracts.
        </p>
        <div className="pill-row">
          <span className="pill">Static-friendly reads</span>
          <span className="pill">Library-driven composition</span>
        </div>
      </div>
      <div className="stack">
        <p className="eyebrow">Phase-1 scope</p>
        <p className="muted">
          Keep the homepage read-focused while the detail routes prove the first
          session-backed collector actions.
        </p>
        <Link className="link-button" href="#featured-sets">
          Browse featured sets
        </Link>
      </div>
    </section>
  );
}

export function CatalogSetDetailPanel({
  catalogSetDetail,
  homeHref,
}: {
  catalogSetDetail: CatalogSetDetail;
  homeHref?: string;
}) {
  return (
    <section className="hero-panel">
      <div className="stack">
        <p className="eyebrow">Set detail</p>
        <h2>{catalogSetDetail.name}</h2>
        <p className="section-copy">{catalogSetDetail.tagline}</p>
        <div className="pill-row">
          <span className="pill">{catalogSetDetail.theme}</span>
          <span className="pill">{catalogSetDetail.releaseYear}</span>
          <span className="pill">{catalogSetDetail.priceRange}</span>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Set number</dt>
            <dd>{catalogSetDetail.id}</dd>
          </div>
          <div>
            <dt>Pieces</dt>
            <dd>{catalogSetDetail.pieces.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Collector angle</dt>
            <dd>{catalogSetDetail.collectorAngle}</dd>
          </div>
        </dl>
        {homeHref ? (
          <Link className="link-button" href={homeHref}>
            Back to featured sets
          </Link>
        ) : null}
      </div>
      <div className="surface stack">
        <p className="eyebrow">Collector highlights</p>
        <ul className="list">
          {catalogSetDetail.collectorHighlights.map((collectorHighlight) => (
            <li key={collectorHighlight}>{collectorHighlight}</li>
          ))}
        </ul>
        <p className="muted">Availability: {catalogSetDetail.availability}</p>
      </div>
    </section>
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
        Presentational building blocks for set discovery and detail storytelling.
      </h2>
    </section>
  );
}

export default CatalogUi;
