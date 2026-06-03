import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDealSortKeyForCategorySlug } from '../deal-category-routes';
import {
  generateMetadata as generateDealsMetadata,
  renderDealsPage,
} from '../page';

export const revalidate = false;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string }>;
  searchParams?: Promise<{
    page?: string | string[];
  }>;
}): Promise<Metadata> {
  const { categorySlug } = await params;
  const sortKey = getDealSortKeyForCategorySlug(categorySlug);

  if (!sortKey) {
    return {};
  }

  return generateDealsMetadata({
    searchParams,
    sortKey,
  });
}

export default async function DealCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string }>;
  searchParams?: Promise<{
    page?: string | string[];
  }>;
}) {
  const { categorySlug } = await params;
  const sortKey = getDealSortKeyForCategorySlug(categorySlug);

  if (!sortKey) {
    return notFound();
  }

  return renderDealsPage({
    searchParams,
    sortKey,
  });
}
