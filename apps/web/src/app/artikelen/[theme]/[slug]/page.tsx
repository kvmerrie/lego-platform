import { MDXRemote } from 'next-mdx-remote/rsc';
import {
  getArticleMdxComponents,
  resolveArticleMdxSourceWithCuratedRelatedSetRail,
} from '../../../lib/article-mdx-components';
import { getMetadataFromSeoFields } from '../../../lib/editorial-metadata';
import { resolveArticleHeroPresentation } from '../../../lib/article-hero-presentation';
import { buildArticleThemePresentation } from '../../../lib/article-theme-presentation';
import {
  getArticleBySlug,
  listPublishedArticles,
} from '@lego-platform/content/data-access';
import { normalizeTheme } from '@lego-platform/catalog/util';
import { ContentArticlePage } from '@lego-platform/content/ui';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildArticlePath,
  buildArticleThemePath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLdScript } from '../../../lib/json-ld';
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleCanonicalUrl,
  buildArticleNewsJsonLd,
} from '../../../lib/structured-data';

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

  return getMetadataFromSeoFields(
    {
      description: contentArticle.description,
      openGraphImageUrl: resolvedHeroPresentation?.imageUrl,
      title: contentArticle.title,
    },
    {
      canonicalPath: buildArticlePath(slug, theme),
    },
  );
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

  const themeHref = buildArticleThemePath(articleThemeSlug);
  const themePresentation = buildArticleThemePresentation({
    href: themeHref,
    theme: articleWithResolvedHero.theme,
  });
  const resolvedThemeLabel = themePresentation?.label;
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
  const canonicalUrl = buildArticleCanonicalUrl(slug, theme);
  const jsonLd = [
    buildArticleNewsJsonLd({
      canonicalUrl,
      contentArticle: articleWithResolvedHero,
    }),
    buildArticleBreadcrumbJsonLd({
      articleTitle: contentArticle.title,
      articleUrl: canonicalUrl,
      themeName: resolvedThemeLabel,
      themeUrl: themeHref,
    }),
  ];

  return (
    <ShellWeb>
      <JsonLdScript data={jsonLd} />
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
