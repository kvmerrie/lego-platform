import type {
  CalloutEditorialSection,
  EditorialSection,
  HeroEditorialSection,
  RichTextEditorialSection,
} from '@lego-platform/content/util';
import {
  ActionLink,
  Badge,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import styles from './content-ui.module.css';

type BodyEditorialSection =
  | CalloutEditorialSection
  | HeroEditorialSection
  | RichTextEditorialSection;

function getEditorialSectionLabel(editorialSection: EditorialSection): string {
  if (editorialSection.eyebrow) {
    return editorialSection.eyebrow;
  }

  switch (editorialSection.type) {
    case 'callout':
      return 'Callout';
    case 'richText':
      return 'Editorial note';
    case 'hero':
      return 'Hero';
  }
}

function getEditorialCtaTone(
  editorialSectionType: EditorialSection['type'],
  variant: 'hero' | 'panel',
): 'accent' | 'inline' | 'secondary' {
  if (variant === 'hero' || editorialSectionType === 'callout') {
    return 'accent';
  }

  return editorialSectionType === 'richText' ? 'inline' : 'secondary';
}

function EditorialSectionCta({
  ctaHref,
  ctaLabel,
  editorialSectionType,
  variant,
}: {
  ctaHref?: string;
  ctaLabel?: string;
  editorialSectionType: EditorialSection['type'];
  variant: 'hero' | 'panel';
}) {
  if (!ctaHref || !ctaLabel) {
    return null;
  }

  return (
    <ActionLink
      className={variant === 'hero' ? styles.heroLink : styles.panelLink}
      href={ctaHref}
      tone={getEditorialCtaTone(editorialSectionType, variant)}
    >
      {ctaLabel}
    </ActionLink>
  );
}

export function EditorialHeroPanel({
  editorialSection,
}: {
  editorialSection: HeroEditorialSection;
}) {
  return (
    <Surface
      as="article"
      className={styles.heroPanel}
      elevation="floating"
      padding="lg"
      tone="accent"
    >
      <div className={styles.heroContent}>
        <SectionHeading
          description={editorialSection.body}
          eyebrow={editorialSection.eyebrow}
          title={editorialSection.title}
          titleAs="h1"
          tone="display"
        />
        <EditorialSectionCta
          ctaHref={editorialSection.ctaHref}
          ctaLabel={editorialSection.ctaLabel}
          editorialSectionType={editorialSection.type}
          variant="hero"
        />
      </div>
    </Surface>
  );
}

function EditorialBodySectionCard({
  editorialSection,
}: {
  editorialSection: BodyEditorialSection;
}) {
  const badgeTone =
    editorialSection.type === 'callout'
      ? 'accent'
      : editorialSection.type === 'richText'
        ? 'info'
        : 'neutral';

  return (
    <Surface
      as="article"
      className={styles.panel}
      elevation={editorialSection.type === 'callout' ? 'floating' : 'default'}
      tone={editorialSection.type === 'callout' ? 'accent' : 'default'}
    >
      <div className={styles.panelHeader}>
        <Badge tone={badgeTone}>
          {getEditorialSectionLabel(editorialSection)}
        </Badge>
        <h3 className={styles.panelTitle}>{editorialSection.title}</h3>
      </div>
      <p className={styles.panelBody}>{editorialSection.body}</p>
      <EditorialSectionCta
        ctaHref={editorialSection.ctaHref}
        ctaLabel={editorialSection.ctaLabel}
        editorialSectionType={editorialSection.type}
        variant="panel"
      />
    </Surface>
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
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Editorial panels that can move cleanly from static copy to CMS-backed rendering."
        eyebrow="Content UI"
        title="Warm, curated surfaces for editorial storytelling."
      />
    </Surface>
  );
}

export default ContentUi;
