import Link from 'next/link';
import type {
  CalloutEditorialSection,
  EditorialSection,
  HeroEditorialSection,
  RichTextEditorialSection,
} from '@lego-platform/content/util';

function EditorialSectionCta({
  ctaHref,
  ctaLabel,
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  if (!ctaHref || !ctaLabel) {
    return null;
  }

  return (
    <Link className="link-button" href={ctaHref}>
      {ctaLabel}
    </Link>
  );
}

export function EditorialHeroPanel({
  editorialSection,
}: {
  editorialSection: HeroEditorialSection;
}) {
  return (
    <article className="hero-panel">
      <div className="stack">
        {editorialSection.eyebrow ? (
          <p className="eyebrow">{editorialSection.eyebrow}</p>
        ) : null}
        <h1>{editorialSection.title}</h1>
        <p className="section-copy">{editorialSection.body}</p>
        <EditorialSectionCta
          ctaHref={editorialSection.ctaHref}
          ctaLabel={editorialSection.ctaLabel}
        />
      </div>
    </article>
  );
}

function EditorialBodySectionCard({
  editorialSection,
}: {
  editorialSection:
    | CalloutEditorialSection
    | HeroEditorialSection
    | RichTextEditorialSection;
}) {
  return (
    <article className="surface stack">
      <p className="eyebrow">
        {editorialSection.eyebrow ?? editorialSection.type}
      </p>
      <h3 className="surface-title">{editorialSection.title}</h3>
      <p>{editorialSection.body}</p>
      <EditorialSectionCta
        ctaHref={editorialSection.ctaHref}
        ctaLabel={editorialSection.ctaLabel}
      />
    </article>
  );
}

export function EditorialPanel({
  editorialSection,
}: {
  editorialSection: EditorialSection;
}) {
  return <EditorialBodySectionCard editorialSection={editorialSection} />;
}

export function ContentUi() {
  return (
    <section className="surface stack">
      <p className="eyebrow">Content UI</p>
      <h2 className="surface-title">
        Editorial panels that can move cleanly from static copy to CMS-backed
        rendering.
      </h2>
    </section>
  );
}

export default ContentUi;
