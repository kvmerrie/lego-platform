import { getMetadataFromSeoFields } from '../lib/editorial-metadata';
import { getCatalogThemeDisplayName } from '@lego-platform/catalog/util';
import { listPublishedArticles } from '@lego-platform/content/data-access';
import {
  ContentArticleFeaturedCard,
  ContentArticleGrid,
  EditorialHeroPanel,
} from '@lego-platform/content/ui';
import type { ContentArticleListItem } from '@lego-platform/content/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { Surface } from '@lego-platform/shared/ui';
import React from 'react';
import type { Metadata } from 'next';
import styles from './page.module.css';

const articlesHero = {
  body: 'Blijf op de hoogte van nieuwe LEGO-sets, deals en aankondigingen.',
  eyebrow: 'ARTIKELEN',
  id: 'articles-hero',
  title: 'LEGO nieuws & updates',
  type: 'hero',
} as const;

export const metadata: Metadata = getMetadataFromSeoFields({
  description:
    'Blijf op de hoogte van nieuwe LEGO-sets, deals en aankondigingen.',
  title: 'LEGO nieuws & updates',
});

function sortArticlesByArticleDateDesc(
  contentArticles: readonly ContentArticleListItem[],
): ContentArticleListItem[] {
  return [...contentArticles].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
}

function normalizeArticleThemeDisplay(
  contentArticle: ContentArticleListItem,
): ContentArticleListItem {
  return {
    ...contentArticle,
    theme:
      getCatalogThemeDisplayName(contentArticle.theme) ?? contentArticle.theme,
  };
}

export default async function ArticlesIndexPage() {
  const contentArticles = sortArticlesByArticleDateDesc(
    (await listPublishedArticles()).filter(
      (contentArticle) => contentArticle.status === 'published',
    ),
  ).map(normalizeArticleThemeDisplay);
  const [featuredArticle, ...remainingArticles] = contentArticles;

  return (
    <ShellWeb>
      <main className={styles.articlesPage}>
        <EditorialHeroPanel editorialSection={articlesHero} />

        {featuredArticle ? (
          <>
            <section className={styles.section} aria-labelledby="latest-title">
              <h2 className={styles.sectionTitle} id="latest-title">
                Net binnen
              </h2>
              <ContentArticleFeaturedCard contentArticle={featuredArticle} />
            </section>

            {remainingArticles.length ? (
              <section
                className={styles.section}
                aria-labelledby="more-articles-title"
              >
                <h2 className={styles.sectionTitle} id="more-articles-title">
                  Meer LEGO nieuws
                </h2>
                <ContentArticleGrid contentArticles={remainingArticles} />
              </section>
            ) : null}
          </>
        ) : (
          <Surface
            as="section"
            className={styles.emptyState}
            elevation="rested"
            tone="muted"
          >
            Nog geen artikelen beschikbaar
          </Surface>
        )}
      </main>
    </ShellWeb>
  );
}
