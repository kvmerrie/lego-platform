import { EditorialPanel, EditorialHeroPanel } from '@lego-platform/content/ui';
import { getHeroSection } from '@lego-platform/content/util';
import type { EditorialPage } from '@lego-platform/content/util';
import styles from './content-feature-page-renderer.module.css';

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
      className={styles.page}
      id={editorialPage.pageType === 'homepage' ? 'editorial-homepage' : 'content'}
    >
      {heroSection ? <EditorialHeroPanel editorialSection={heroSection} /> : null}
      {supportingSections.length ? (
        <div className={styles.grid}>
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
