import { getEditorialQueryMode } from '../../lib/editorial-query-mode';
import { getMetadataFromSeoFields } from '../../lib/editorial-metadata';
import {
  getEditorialPageBySlug,
  listEditorialPageSlugs,
} from '@lego-platform/content/data-access';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import { ShellWeb } from '@lego-platform/shell/web';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const revalidate = 300;

export async function generateStaticParams() {
  const editorialPageSlugs = await listEditorialPageSlugs({
    mode: 'delivery',
  });

  return editorialPageSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const queryMode = await getEditorialQueryMode();
  const editorialPage = await getEditorialPageBySlug(slug, {
    mode: queryMode,
  });

  if (!editorialPage) {
    return {};
  }

  return getMetadataFromSeoFields(editorialPage.seo);
}

export default async function EditorialPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const queryMode = await getEditorialQueryMode();
  const editorialPage = await getEditorialPageBySlug(slug, {
    mode: queryMode,
  });

  if (!editorialPage) {
    notFound();
  }

  return (
    <ShellWeb>
      <ContentFeaturePageRenderer editorialPage={editorialPage} />
    </ShellWeb>
  );
}
