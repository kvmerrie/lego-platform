import { EditorialSection } from '@lego-platform/content/util';

export function EditorialPanel({
  editorialSection,
}: {
  editorialSection: EditorialSection;
}) {
  return (
    <article className="surface stack">
      <p className="eyebrow">{editorialSection.eyebrow}</p>
      <h3 className="surface-title">{editorialSection.title}</h3>
      <p>{editorialSection.copy}</p>
      {editorialSection.ctaLabel && editorialSection.ctaHref ? (
        <a className="link-button" href={editorialSection.ctaHref}>
          {editorialSection.ctaLabel}
        </a>
      ) : null}
    </article>
  );
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
