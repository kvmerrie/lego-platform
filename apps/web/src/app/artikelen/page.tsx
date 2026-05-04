import { getMetadataFromSeoFields } from '../lib/editorial-metadata';
import { resolveArticleHeroPresentation } from '../lib/article-hero-presentation';
import {
  getCatalogThemeDisplayName,
  normalizeTheme,
} from '@lego-platform/catalog/util';
import {
  getPopularArticles,
  listPublishedArticles,
} from '@lego-platform/content/data-access';
import {
  ContentArticleCompactRail,
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

export const revalidate = 60;

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
  const normalizedTheme = normalizeTheme(contentArticle.theme);

  return {
    ...contentArticle,
    theme:
      getCatalogThemeDisplayName(contentArticle.theme) ??
      normalizedTheme?.displayName ??
      contentArticle.theme,
    themeSlug: normalizedTheme?.key ?? contentArticle.themeSlug,
  };
}

async function resolveArticleListItemImage(
  contentArticle: ContentArticleListItem,
): Promise<ContentArticleListItem> {
  if (contentArticle.cardImage) {
    return contentArticle;
  }

  const resolvedHeroPresentation =
    await resolveArticleHeroPresentation(contentArticle);

  return resolvedHeroPresentation
    ? {
        ...contentArticle,
        cardImage: resolvedHeroPresentation.imageUrl,
        cardImageAlt: resolvedHeroPresentation.imageAlt,
        cardImageSource: resolvedHeroPresentation.source,
        heroImage:
          contentArticle.heroImage ?? resolvedHeroPresentation.imageUrl,
        heroImageAlt: contentArticle.heroImage
          ? contentArticle.heroImageAlt
          : resolvedHeroPresentation.imageAlt,
        heroImageSource: contentArticle.heroImage
          ? contentArticle.heroImageSource
          : resolvedHeroPresentation.source,
      }
    : contentArticle;
}

export default async function ArticlesIndexPage() {
  const [publishedArticles, popularArticles] = await Promise.all([
    listPublishedArticles(),
    getPopularArticles({
      days: 7,
      limit: 6,
    }),
  ]);
  const contentArticles = sortArticlesByArticleDateDesc(
    publishedArticles.filter(
      (contentArticle) => contentArticle.status === 'published',
    ),
  );
  const [resolvedContentArticles, resolvedPopularArticles] = await Promise.all([
    Promise.all(contentArticles.map(resolveArticleListItemImage)),
    Promise.all(popularArticles.map(resolveArticleListItemImage)),
  ]);
  const normalizedContentArticles = resolvedContentArticles.map(
    normalizeArticleThemeDisplay,
  );
  const normalizedPopularArticles = resolvedPopularArticles.map(
    normalizeArticleThemeDisplay,
  );
  const [featuredArticle, ...recentArticles] = normalizedContentArticles;
  const topRecentArticles = recentArticles.slice(0, 3);
  const remainingArticles = recentArticles.slice(3);
  const topRecentSlugs = new Set([
    featuredArticle?.slug,
    ...topRecentArticles.map((article) => article.slug),
  ]);
  const filteredPopularArticles = normalizedPopularArticles.filter(
    (article) => !topRecentSlugs.has(article.slug),
  );

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
              <div className={styles.latestStack}>
                <ContentArticleFeaturedCard contentArticle={featuredArticle} />
                {topRecentArticles.length ? (
                  <ContentArticleGrid contentArticles={topRecentArticles} />
                ) : null}
              </div>
            </section>

            {filteredPopularArticles.length ? (
              <ContentArticleCompactRail
                contentArticles={filteredPopularArticles}
                maxItems={6}
                title="Populair deze week"
              />
            ) : null}

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
