import type {
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import { ActionLink, Badge, SectionHeading, Surface } from '@lego-platform/shared/ui';
import styles from './catalog-ui.module.css';

function CatalogSetMetadata({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <dl className={styles.metaGrid}>
      {items.map((item) => (
        <div className={styles.metaItem} key={item.label}>
          <dt className={styles.metaLabel}>{item.label}</dt>
          <dd className={styles.metaValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CatalogSetCard({
  href,
  setSummary,
}: {
  href?: string;
  setSummary: CatalogSetSummary;
}) {
  return (
    <Surface as="article" className={styles.setCard}>
      <div className={styles.cardHeader}>
        <Badge tone="accent">{setSummary.theme}</Badge>
        <h3 className={styles.cardTitle}>{setSummary.name}</h3>
      </div>
      <p className={styles.cardCopy}>{setSummary.collectorAngle}</p>
      <CatalogSetMetadata
        items={[
          { label: 'Pieces', value: setSummary.pieces.toLocaleString() },
          { label: 'Release', value: setSummary.releaseYear },
          { label: 'Range', value: setSummary.priceRange },
        ]}
      />
      {href ? (
        <ActionLink className={styles.actionLink} href={href} tone="secondary">
          View set details
        </ActionLink>
      ) : null}
    </Surface>
  );
}

export function CatalogHomepageIntro() {
  return (
    <Surface
      as="section"
      className={styles.heroPanel}
      elevation="floating"
      padding="lg"
      tone="accent"
    >
      <div className={styles.heroPrimary}>
        <SectionHeading
          description="The homepage stays intentionally small: a short introduction, a curated featured list, and detail routes powered by stable catalog contracts."
          eyebrow="Catalog discovery"
          title="Browse a focused first slice of the LEGO collector experience."
          tone="hero"
        />
        <div className={styles.badgeRow}>
          <Badge tone="accent">Static-friendly reads</Badge>
          <Badge tone="info">Library-driven composition</Badge>
        </div>
      </div>
      <div className={styles.heroSecondary}>
        <SectionHeading
          description="Keep the homepage read-focused while the detail routes prove the first session-backed collector actions."
          eyebrow="Phase-1 scope"
          title="A narrow slice built for confidence."
          titleAs="h2"
        />
        <ActionLink className={styles.actionLink} href="#featured-sets" tone="accent">
          Browse featured sets
        </ActionLink>
      </div>
    </Surface>
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
    <section className={styles.heroPanel}>
      <Surface
        as="section"
        className={styles.heroPrimary}
        elevation="floating"
        padding="lg"
        tone="accent"
      >
        <SectionHeading
          description={catalogSetDetail.tagline}
          eyebrow="Set detail"
          title={catalogSetDetail.name}
          titleAs="h2"
          tone="hero"
        />
        <div className={styles.badgeRow}>
          <Badge tone="accent">{catalogSetDetail.theme}</Badge>
          <Badge>{catalogSetDetail.releaseYear}</Badge>
          <Badge tone="info">{catalogSetDetail.priceRange}</Badge>
        </div>
        <CatalogSetMetadata
          items={[
            { label: 'Set number', value: catalogSetDetail.id },
            { label: 'Pieces', value: catalogSetDetail.pieces.toLocaleString() },
            { label: 'Collector angle', value: catalogSetDetail.collectorAngle },
          ]}
        />
        {homeHref ? (
          <ActionLink className={styles.actionLink} href={homeHref} tone="secondary">
            Back to featured sets
          </ActionLink>
        ) : null}
      </Surface>
      <Surface
        as="aside"
        className={styles.highlightsCard}
        elevation="rested"
        tone="muted"
      >
        <div className={styles.cardHeader}>
          <Badge tone="info">Collector highlights</Badge>
          <p className={styles.availability}>
            Availability: {catalogSetDetail.availability}
          </p>
        </div>
        <ul className={styles.highlightsList}>
          {catalogSetDetail.collectorHighlights.map((collectorHighlight) => (
            <li key={collectorHighlight}>{collectorHighlight}</li>
          ))}
        </ul>
      </Surface>
    </section>
  );
}

export function CatalogThemeHighlight({
  themeSnapshot,
}: {
  themeSnapshot: CatalogThemeSnapshot;
}) {
  return (
    <Surface as="article" className={styles.themeCard} tone="muted">
      <div className={styles.themeHeader}>
        <Badge tone="accent">{themeSnapshot.name}</Badge>
        <h3 className={styles.cardTitle}>{themeSnapshot.signatureSet}</h3>
      </div>
      <p className={styles.mutedCopy}>{themeSnapshot.momentum}</p>
      <Badge tone="info">{themeSnapshot.setCount} tracked sets</Badge>
    </Surface>
  );
}

export function CatalogUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Presentational building blocks for set discovery and detail storytelling."
        eyebrow="Catalog UI"
        title="Retail-grade catalog surfaces with collector-friendly metadata."
      />
    </Surface>
  );
}

export default CatalogUi;
