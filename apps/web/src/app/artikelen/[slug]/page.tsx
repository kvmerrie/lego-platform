import { MDXRemote } from 'next-mdx-remote/rsc';
import { getArticleMdxComponents } from '../../lib/article-mdx-components';
import { getMetadataFromSeoFields } from '../../lib/editorial-metadata';
import {
  getPublishedArticleBySlug,
  listPublishedArticleSlugs,
} from '@lego-platform/content/data-access';
import { ContentArticlePage } from '@lego-platform/content/ui';
import { ShellWeb } from '@lego-platform/shell/web';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamicParams = false;

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
  const contentArticle = await getPublishedArticleBySlug(slug);

  if (!contentArticle) {
    return {};
  }

  return getMetadataFromSeoFields({
    description: contentArticle.description,
    openGraphImageUrl: contentArticle.heroImage,
    title: contentArticle.title,
  });
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const contentArticle = await getPublishedArticleBySlug(slug);

  if (!contentArticle) {
    notFound();
  }

  return (
    <ShellWeb>
      <ContentArticlePage
        body={
          <MDXRemote
            components={getArticleMdxComponents()}
            source={contentArticle.bodySource}
          />
        }
        contentArticle={contentArticle}
      />
    </ShellWeb>
  );
}
