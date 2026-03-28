import { getMetadataFromSeoFields } from './lib/editorial-metadata';
import { CatalogFeatureSetList } from '@lego-platform/catalog/feature-set-list';
import { getHomepagePage } from '@lego-platform/content/data-access';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import { ShellWeb } from '@lego-platform/shell/web';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const homepagePage = await getHomepagePage();

  return getMetadataFromSeoFields(homepagePage.seo);
}

export default async function HomePage() {
  const homepagePage = await getHomepagePage();

  return (
    <ShellWeb>
      <ContentFeaturePageRenderer editorialPage={homepagePage} />
      <CatalogFeatureSetList />
    </ShellWeb>
  );
}
