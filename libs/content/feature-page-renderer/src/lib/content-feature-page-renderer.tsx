import { EditorialPanel, EditorialHeroPanel } from '@lego-platform/content/ui';
import { getHeroSection } from '@lego-platform/content/util';
import type { EditorialPage } from '@lego-platform/content/util';

export function ContentFeaturePageRenderer({
  editorialPage,
}: {
  editorialPage: EditorialPage;
}) {
  const heroSection = getHeroSection(editorialPage.sections);
  const supportingSections = heroSection
    ? editorialPage.sections.slice(1)
    : editorialPage.sections;

  return (
    <section
      aria-label={editorialPage.title}
      className="section-stack"
      id={editorialPage.pageType === 'homepage' ? 'editorial-homepage' : 'content'}
    >
      {heroSection ? <EditorialHeroPanel editorialSection={heroSection} /> : null}
      {supportingSections.length ? (
        <div className="surface-grid">
          {supportingSections.map((editorialSection) => (
            <EditorialPanel
              editorialSection={editorialSection}
              key={editorialSection.id}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default ContentFeaturePageRenderer;
