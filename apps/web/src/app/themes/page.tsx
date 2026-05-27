import { CatalogFeatureThemeIndex } from '@lego-platform/catalog/feature-theme-page';
import { listCatalogThemeDirectoryItems } from '@lego-platform/catalog/data-access-web';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildCanonicalUrl,
  buildWebPath,
  cacheTags,
  webPathnames,
} from '@lego-platform/shared/config';
import type { Metadata } from 'next';
import { getCachedPublicLandingPageData } from '../lib/public-landing-page-cache';

export const revalidate = false;
const THEME_INDEX_CACHE_TAGS = [
  cacheTags.catalog(),
  cacheTags.sets(),
  cacheTags.themes(),
] as const;

export const metadata: Metadata = {
  title: 'Brickhunt – LEGO thema’s ontdekken',
  description:
    'Kies een LEGO-thema en zie snel welke sets je daar niet wilt missen.',
  alternates: {
    canonical: buildCanonicalUrl(buildWebPath(webPathnames.themes)),
  },
  openGraph: {
    title: 'Brickhunt – LEGO thema’s ontdekken',
    description:
      'Kies een LEGO-thema en zie snel welke sets je daar niet wilt missen.',
    type: 'website',
    url: buildCanonicalUrl(buildWebPath(webPathnames.themes)),
  },
};

export default async function ThemesPage() {
  const themeDirectoryItems = await getCachedPublicLandingPageData({
    load: () => listCatalogThemeDirectoryItems(),
    page: 'theme-index',
    revalidateSeconds: revalidate,
    tags: THEME_INDEX_CACHE_TAGS,
  });

  return (
    <ShellWeb>
      <CatalogFeatureThemeIndex themeDirectoryItems={themeDirectoryItems} />
    </ShellWeb>
  );
}
