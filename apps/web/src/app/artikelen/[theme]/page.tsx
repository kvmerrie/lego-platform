import { getMetadataFromSeoFields } from '../../lib/editorial-metadata';
import { resolveArticleHeroPresentation } from '../../lib/article-hero-presentation';
import { buildArticleThemePresentation } from '../../lib/article-theme-presentation';
import { listPublishedArticles } from '@lego-platform/content/data-access';
import {
  getCatalogThemeDisplayName,
  normalizeTheme,
} from '@lego-platform/catalog/util';
import {
  ContentArticleGrid,
  EditorialHeroPanel,
  type ContentArticleThemePresentation,
} from '@lego-platform/content/ui';
import type { ContentArticleListItem } from '@lego-platform/content/util';
import { ShellWeb } from '@lego-platform/shell/web';
import { buildArticleThemePath } from '@lego-platform/shared/config';
import { Surface } from '@lego-platform/shared/ui';
import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import styles from '../page.module.css';

export const revalidate = 60;
export const dynamicParams = true;

type ArticleListItemWithThemePresentation = ContentArticleListItem & {
  themePresentation?: ContentArticleThemePresentation;
};

function getArticleThemeSlug(theme?: string): string | undefined {
  return normalizeTheme(theme)?.key;
}

function sortArticlesByArticleDateDesc(
  contentArticles: readonly ContentArticleListItem[],
): ArticleListItemWithThemePresentation[] {
  return [...contentArticles].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
}

function normalizeArticleThemeDisplay(
  contentArticle: ContentArticleListItem,
): ArticleListItemWithThemePresentation {
  const normalizedTheme = normalizeTheme(contentArticle.theme);
  const displayTheme =
    getCatalogThemeDisplayName(contentArticle.theme) ??
    normalizedTheme?.displayName ??
    contentArticle.theme;

  return {
    ...contentArticle,
    theme: displayTheme,
    themeSlug: normalizedTheme?.key ?? contentArticle.themeSlug,
    themePresentation: buildArticleThemePresentation({
      href: normalizedTheme
        ? buildArticleThemePath(normalizedTheme.key)
        : undefined,
      theme: contentArticle.theme,
    }),
  };
}

async function resolveArticleListItemImage(
  contentArticle: ArticleListItemWithThemePresentation,
): Promise<ArticleListItemWithThemePresentation> {
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

export async function generateStaticParams() {
  const articles = await listPublishedArticles();
  const themes = new Set(
    articles
      .map((article) => getArticleThemeSlug(article.theme))
      .filter((theme): theme is string => Boolean(theme)),
  );

  return [...themes].map((theme) => ({ theme }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ theme: string }>;
}): Promise<Metadata> {
  const { theme } = await params;
  const articles = await listPublishedArticles();
  const themeArticle = articles.find(
    (article) => getArticleThemeSlug(article.theme) === theme,
  );

  if (!themeArticle) {
    return {};
  }

  const themeLabel =
    getCatalogThemeDisplayName(themeArticle.theme) ??
    normalizeTheme(themeArticle.theme)?.displayName ??
    themeArticle.theme ??
    'LEGO';

  return getMetadataFromSeoFields({
    description: `Lees het nieuwste LEGO nieuws over ${themeLabel}.`,
    title: `${themeLabel} nieuws`,
  });
}

export default async function ArticleThemePage({
  params,
}: {
  params: Promise<{ theme: string }>;
}) {
  const { theme } = await params;
  const articles = await listPublishedArticles();
  const themeArticles = sortArticlesByArticleDateDesc(
    articles.filter((article) => getArticleThemeSlug(article.theme) === theme),
  );

  if (!themeArticles.length) {
    notFound();
  }

  const [firstArticle] = themeArticles;
  const themeLabel =
    getCatalogThemeDisplayName(firstArticle?.theme) ??
    normalizeTheme(firstArticle?.theme)?.displayName ??
    firstArticle?.theme ??
    'LEGO';
  const resolvedArticles = (
    await Promise.all(themeArticles.map(resolveArticleListItemImage))
  ).map(normalizeArticleThemeDisplay);

  return (
    <ShellWeb>
      <main className={styles.articlesPage}>
        <EditorialHeroPanel
          editorialSection={{
            body: `Nieuwe artikelen, releases en updates binnen ${themeLabel}.`,
            eyebrow: 'ARTIKELEN',
            id: `articles-${theme}`,
            title: `${themeLabel} nieuws`,
            type: 'hero',
          }}
        />

        <section className={styles.section} aria-labelledby="theme-title">
          <h2 className={styles.sectionTitle} id="theme-title">
            Nieuw binnen {themeLabel}
          </h2>
          <ContentArticleGrid contentArticles={resolvedArticles} />
        </section>

        {!resolvedArticles.length ? (
          <Surface
            as="section"
            className={styles.emptyState}
            elevation="rested"
          >
            Nog geen artikelen beschikbaar
          </Surface>
        ) : null}
      </main>
    </ShellWeb>
  );
}
