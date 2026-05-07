import { CatalogFeatureThemeIndex } from '@lego-platform/catalog/feature-theme-page';
import { listCatalogThemeDirectoryItems } from '@lego-platform/catalog/data-access-web';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildCanonicalUrl,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import type { Metadata } from 'next';

export const revalidate = 21_600;

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
  const themeDirectoryItems = await listCatalogThemeDirectoryItems();

  return (
    <ShellWeb>
      <CatalogFeatureThemeIndex themeDirectoryItems={themeDirectoryItems} />
    </ShellWeb>
  );
}
