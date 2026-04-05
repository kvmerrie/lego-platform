import { CatalogFeatureThemeIndex } from '@lego-platform/catalog/feature-theme-page';
import { ShellWeb } from '@lego-platform/shell/web';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brickhunt – LEGO thema’s ontdekken',
  description:
    'Kies een LEGO-thema en zie snel welke sets je daar niet wilt missen.',
};

export default function ThemesPage() {
  return (
    <ShellWeb>
      <CatalogFeatureThemeIndex />
    </ShellWeb>
  );
}
