import { CatalogFeatureThemeIndex } from '@lego-platform/catalog/feature-theme-page';
import { ShellWeb } from '@lego-platform/shell/web';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brickhunt – LEGO thema’s ontdekken',
  description:
    'Blader door alle publieke LEGO thema’s op Brickhunt en open rustige themapagina’s om sets gerichter te ontdekken.',
};

export default function ThemesPage() {
  return (
    <ShellWeb>
      <CatalogFeatureThemeIndex />
    </ShellWeb>
  );
}
