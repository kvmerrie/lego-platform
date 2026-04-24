import { getMetadataFromSeoFields } from '../lib/editorial-metadata';
import { listPublishedArticles } from '@lego-platform/content/data-access';
import { ContentArticleGrid } from '@lego-platform/content/ui';
import { ShellWeb } from '@lego-platform/shell/web';
import { SectionHeading, Surface } from '@lego-platform/shared/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = getMetadataFromSeoFields({
  description:
    'Praktische LEGO-artikelen die helpen kiezen, vergelijken en het koopmoment beter timen.',
  title: 'Artikelen',
});

export default async function ArticlesIndexPage() {
  const contentArticles = await listPublishedArticles();

  return (
    <ShellWeb>
      <section aria-label="Artikelen">
        <SectionHeading
          description="Guides, koopmomenten en themastukken die helpen kiezen welke doos je nu wilt pakken."
          eyebrow="Artikelen"
          title="Lees wat nu de moeite waard is"
          titleAs="h1"
        />
        {contentArticles.length ? (
          <div style={{ marginTop: 'var(--lego-space-6)' }}>
            <ContentArticleGrid contentArticles={contentArticles} />
          </div>
        ) : (
          <Surface
            as="section"
            elevation="rested"
            style={{ marginTop: 'var(--lego-space-6)' }}
            tone="muted"
          >
            Nog geen gepubliceerde artikelen. Zodra de eerste gids live staat,
            vind je hem hier.
          </Surface>
        )}
      </section>
    </ShellWeb>
  );
}
