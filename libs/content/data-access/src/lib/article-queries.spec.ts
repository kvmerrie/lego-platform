import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getPublishedArticleBySlug,
  listPublishedArticles,
  listPublishedArticleSlugs,
  resetContentArticleQueryStateForTests,
  type ContentArticleSourceFile,
} from './article-queries';

const sampleArticleFiles: readonly ContentArticleSourceFile[] = [
  {
    filename: 'published-article.mdx',
    source: `---
title: "Star Wars Day 2026"
slug: "star-wars-day-2026"
description: "Waar wil je nu op letten?"
date: "2026-04-24"
updatedAt: "2026-04-25"
theme: "Star Wars"
heroImage: "/articles/star-wars-day-2026/hero.jpg"
heroImageAlt: "Star Wars hero"
status: "published"
---

## Intro

Dit is een gepubliceerd artikel.
`,
  },
  {
    filename: 'draft-article.mdx',
    source: `---
title: "Draft guide"
slug: "draft-guide"
description: "Nog niet live"
date: "2026-04-23"
heroImage: "/articles/draft-guide/hero.jpg"
heroImageAlt: "Draft hero"
cardImage: "/articles/draft-guide/card.jpg"
cardImageAlt: "Draft card"
status: "draft"
---

## Concept

Nog niet publiceren.
`,
  },
];

const workspaceRoot = process.cwd();

describe('content article queries', () => {
  afterEach(() => {
    resetContentArticleQueryStateForTests();
    vi.restoreAllMocks();
  });

  test('lists only published articles and falls back cardImage to heroImage', async () => {
    const result = await listPublishedArticles({
      articleFiles: sampleArticleFiles,
      assetExistsFn: async (absolutePath) =>
        absolutePath.endsWith('star-wars-day-2026/hero.jpg'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cardImage: '/articles/star-wars-day-2026/hero.jpg',
      cardImageAlt: 'Star Wars hero',
      heroImage: '/articles/star-wars-day-2026/hero.jpg',
      slug: 'star-wars-day-2026',
      status: 'published',
      theme: 'Star Wars',
      title: 'Star Wars Day 2026',
      updatedAt: '2026-04-25',
    });
  });

  test('hides draft slugs and draft detail pages from public queries', async () => {
    const slugs = await listPublishedArticleSlugs({
      articleFiles: sampleArticleFiles,
      assetExistsFn: async () => true,
    });
    const publishedArticle = await getPublishedArticleBySlug(
      'star-wars-day-2026',
      {
        articleFiles: sampleArticleFiles,
        assetExistsFn: async () => true,
      },
    );
    const draftArticle = await getPublishedArticleBySlug('draft-guide', {
      articleFiles: sampleArticleFiles,
      assetExistsFn: async () => true,
    });

    expect(slugs).toEqual(['star-wars-day-2026']);
    expect(publishedArticle?.slug).toBe('star-wars-day-2026');
    expect(draftArticle).toBeNull();
  });

  test('drops missing image paths instead of returning broken image urls', async () => {
    const [result] = await listPublishedArticles({
      articleFiles: sampleArticleFiles,
      assetExistsFn: async () => false,
    });

    expect(result?.heroImage).toBeUndefined();
    expect(result?.cardImage).toBeUndefined();
  });

  test('discovers the published star-wars-day article from the repo content directory', async () => {
    const publishedArticles = await listPublishedArticles();
    const publishedArticle =
      await getPublishedArticleBySlug('star-wars-day-2026');
    const slugs = await listPublishedArticleSlugs();

    expect(slugs).toContain('star-wars-day-2026');
    expect(
      publishedArticles.some(
        (contentArticle) => contentArticle.slug === 'star-wars-day-2026',
      ),
    ).toBe(true);
    expect(publishedArticle).toMatchObject({
      slug: 'star-wars-day-2026',
      status: 'published',
      title: 'Star Wars Day 2026 (May the 4th)',
    });
  });

  test('still discovers published articles when cwd resolves from apps/web', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(
      path.join(workspaceRoot, 'apps', 'web'),
    );

    const publishedArticle =
      await getPublishedArticleBySlug('star-wars-day-2026');

    expect(publishedArticle?.slug).toBe('star-wars-day-2026');
  });

  test('warns once and returns an empty result when the content directory is missing', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const result = await listPublishedArticles({
      contentDirectory: '/tmp/brickhunt-missing-articles-dir',
    });

    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Content articles directory not found at "/tmp/brickhunt-missing-articles-dir".',
      ),
    );
  });
});
