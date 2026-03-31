import { CatalogFeatureThemeIndex } from '@lego-platform/catalog/feature-theme-page';
import { ShellWeb } from '@lego-platform/shell/web';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LEGO themes | Brick Ledger',
  description:
    'Browse every public LEGO theme in Brick Ledger, then open focused theme pages for calmer catalog exploration.',
};

export default function ThemesPage() {
  return (
    <ShellWeb>
      <CatalogFeatureThemeIndex />
    </ShellWeb>
  );
}
