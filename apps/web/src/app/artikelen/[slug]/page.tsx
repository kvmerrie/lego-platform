import { MDXRemote } from 'next-mdx-remote/rsc';
import { getArticleMdxComponents } from '../../lib/article-mdx-components';
import { getMetadataFromSeoFields } from '../../lib/editorial-metadata';
import { resolveArticleHeroPresentation } from '../../lib/article-hero-presentation';
import {
  getArticleBySlug,
  listPublishedArticles,
  listPublishedArticleSlugs,
} from '@lego-platform/content/data-access';
import {
  getCatalogThemeDefinition,
  getCatalogThemeMutedTextColor,
  getCatalogThemeSurfaceTone,
} from '@lego-platform/catalog/util';
import { ContentArticlePage } from '@lego-platform/content/ui';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildThemePath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import React, { type CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const slugs = await listPublishedArticleSlugs();

  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const contentArticle = await getArticleBySlug(slug);

  if (!contentArticle) {
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [contentArticle, publishedArticles] = await Promise.all([
    getArticleBySlug(slug),
    listPublishedArticles(),
  ]);

  if (!contentArticle) {
    notFound();
  }

  const resolvedHeroPresentation =
    await resolveArticleHeroPresentation(contentArticle);
  const articleWithResolvedHero = resolvedHeroPresentation
    ? {
        ...contentArticle,
        heroImage: resolvedHeroPresentation.imageUrl,
        heroImageAlt: resolvedHeroPresentation.imageAlt,
      }
    : {
        ...contentArticle,
        heroImage: undefined,
      };

  const themeDefinition = getCatalogThemeDefinition(
    articleWithResolvedHero.theme,
  );
  const resolvedThemeLabel =
    themeDefinition?.name ?? articleWithResolvedHero.theme;
  const themeHref = themeDefinition
    ? buildThemePath(themeDefinition.slug)
    : undefined;
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
            id: `theme-${themeDefinition?.slug ?? resolvedThemeLabel}`,
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
            const relatedThemeLabel =
              getCatalogThemeDefinition(publishedArticle.theme)?.name ??
              publishedArticle.theme;

            return (
              publishedArticle.slug !== articleWithResolvedHero.slug &&
              relatedThemeLabel === resolvedThemeLabel
            );
          })
          .slice(0, 3)
      : [];

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
            source={articleWithResolvedHero.bodySource}
          />
        }
        contentArticle={articleWithResolvedHero}
        relatedArticles={relatedArticles}
        themePresentation={themePresentation}
      />
    </ShellWeb>
  );
}
