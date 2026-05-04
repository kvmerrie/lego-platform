import { MDXRemote } from 'next-mdx-remote/rsc';
import {
  getArticleMdxComponents,
  resolveArticleMdxSourceWithCuratedRelatedSetRail,
} from '../../../lib/article-mdx-components';
import { getMetadataFromSeoFields } from '../../../lib/editorial-metadata';
import { resolveArticleHeroPresentation } from '../../../lib/article-hero-presentation';
import {
  getArticleBySlug,
  listPublishedArticles,
} from '@lego-platform/content/data-access';
import {
  getCatalogThemeDefinition,
  getCatalogThemeMutedTextColor,
  getCatalogThemeSurfaceTone,
  normalizeTheme,
} from '@lego-platform/catalog/util';
import { ContentArticlePage } from '@lego-platform/content/ui';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildArticleThemePath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import React, { type CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

function getArticleThemeSlug(theme?: string): string | undefined {
  return normalizeTheme(theme)?.key;
}

export async function generateStaticParams() {
  const articles = await listPublishedArticles();

  return articles
    .map((article) => {
      const theme = getArticleThemeSlug(article.theme);

      return theme ? { slug: article.slug, theme } : null;
    })
    .filter((params): params is { slug: string; theme: string } =>
      Boolean(params),
    );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; theme: string }>;
}): Promise<Metadata> {
  const { slug, theme } = await params;
  const contentArticle = await getArticleBySlug(slug);

  if (!contentArticle || getArticleThemeSlug(contentArticle.theme) !== theme) {
    return {};
  }

  const resolvedHeroPresentation =
    await resolveArticleHeroPresentation(contentArticle);

  return getMetadataFromSeoFields({
    description: contentArticle.description,
    openGraphImageUrl: resolvedHeroPresentation?.imageUrl,
    title: contentArticle.title,
  });
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string; theme: string }>;
}) {
  const { slug, theme } = await params;
  const [contentArticle, publishedArticles] = await Promise.all([
    getArticleBySlug(slug),
    listPublishedArticles(),
  ]);

  const articleThemeSlug = getArticleThemeSlug(contentArticle?.theme);

  if (!contentArticle || !articleThemeSlug || articleThemeSlug !== theme) {
    notFound();
  }

  const resolvedHeroPresentation =
    await resolveArticleHeroPresentation(contentArticle);
  const articleWithResolvedHero = resolvedHeroPresentation
    ? {
        ...contentArticle,
        heroImage: resolvedHeroPresentation.imageUrl,
        heroImageAlt: resolvedHeroPresentation.imageAlt,
        heroImageSource: resolvedHeroPresentation.source,
        themeSlug: articleThemeSlug,
      }
    : {
        ...contentArticle,
        heroImage: undefined,
        themeSlug: articleThemeSlug,
      };

  const themeDefinition = getCatalogThemeDefinition(
    articleWithResolvedHero.theme,
  );
  const normalizedTheme = normalizeTheme(articleWithResolvedHero.theme);
  const resolvedThemeLabel =
    themeDefinition?.name ??
    normalizedTheme?.displayName ??
    articleWithResolvedHero.theme;
  const themeHref = buildArticleThemePath(articleThemeSlug);
  const themePresentation =
    resolvedThemeLabel || themeHref || themeDefinition?.visual
      ? {
          href: themeHref,
          label: resolvedThemeLabel,
          style:
            themeDefinition?.visual.backgroundColor ||
            themeDefinition?.visual.textColor
              ? ({
                  ...(themeDefinition.visual.backgroundColor
                    ? {
                        '--article-theme-accent':
                          themeDefinition.visual.backgroundColor,
                        '--article-theme-surface':
                          themeDefinition.visual.backgroundColor,
                        '--catalog-theme-badge-surface':
                          themeDefinition.visual.backgroundColor,
                      }
                    : {}),
                  ...(themeDefinition.visual.textColor
                    ? {
                        '--article-theme-accent-text':
                          themeDefinition.visual.textColor,
                        '--article-theme-surface-text':
                          themeDefinition.visual.textColor,
                        '--article-theme-muted-text':
                          getCatalogThemeMutedTextColor(
                            themeDefinition.visual.textColor,
                          ),
                        '--catalog-theme-badge-text':
                          themeDefinition.visual.textColor,
                      }
                    : {}),
                } as CSSProperties)
              : undefined,
          tone: getCatalogThemeSurfaceTone(resolvedThemeLabel),
        }
      : undefined;
  const breadcrumbs = [
    {
      href: buildWebPath(webPathnames.articles),
      id: 'articles',
      label: 'Artikelen',
    },
    ...(resolvedThemeLabel && themeHref
      ? [
          {
            href: themeHref,
            id: `theme-${articleThemeSlug}`,
            label: resolvedThemeLabel,
          },
        ]
      : []),
    {
      id: `article-${contentArticle.slug}`,
      label: contentArticle.title,
    },
  ];
  const relatedArticles =
    resolvedThemeLabel && publishedArticles.length
      ? publishedArticles
          .filter((publishedArticle) => {
            const relatedThemeLabel = getArticleThemeSlug(
              publishedArticle.theme,
            );

            return (
              publishedArticle.slug !== articleWithResolvedHero.slug &&
              relatedThemeLabel === articleThemeSlug
            );
          })
          .map((publishedArticle) => ({
            ...publishedArticle,
            themeSlug: articleThemeSlug,
          }))
          .slice(0, 3)
      : [];
  const articleBodySource =
    await resolveArticleMdxSourceWithCuratedRelatedSetRail(
      articleWithResolvedHero.bodySource,
    );

  return (
    <ShellWeb>
      <ContentArticlePage
        breadcrumbs={breadcrumbs}
        body={
          <MDXRemote
            components={getArticleMdxComponents({
              articleDescription: articleWithResolvedHero.description,
              articleSlug: articleWithResolvedHero.slug,
              articleTheme: articleWithResolvedHero.theme,
              articleTitle: articleWithResolvedHero.title,
            })}
            source={articleBodySource}
          />
        }
        contentArticle={articleWithResolvedHero}
        relatedArticles={relatedArticles}
        themePresentation={themePresentation}
      />
    </ShellWeb>
  );
}
