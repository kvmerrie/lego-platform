import { listLandingPageSections } from '@lego-platform/content/data-access';
import { EditorialPanel } from '@lego-platform/content/ui';

export function ContentFeaturePageRenderer() {
  const landingPageSections = listLandingPageSections();
  const [heroSection, ...supportingSections] = landingPageSections;

  return (
    <section id="content" className="section-stack">
      <article className="hero-panel">
        <div className="stack">
          <p className="eyebrow">{heroSection.eyebrow}</p>
          <h1>{heroSection.title}</h1>
          <p className="section-copy">{heroSection.copy}</p>
          {heroSection.ctaLabel && heroSection.ctaHref ? (
            <a className="link-button" href={heroSection.ctaHref}>
              {heroSection.ctaLabel}
            </a>
          ) : null}
        </div>
      </article>
      <div className="surface-grid">
        {supportingSections.map((supportingSection) => (
          <EditorialPanel
            key={supportingSection.id}
            editorialSection={supportingSection}
          />
        ))}
      </div>
    </section>
  );
}

export default ContentFeaturePageRenderer;
