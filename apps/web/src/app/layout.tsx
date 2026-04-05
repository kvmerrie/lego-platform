import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import {
  getThemeBootstrapScript,
  getThemeStyles,
} from '@lego-platform/shared/design-tokens';
import {
  getDefaultAppLocaleContext,
  platformConfig,
  publicSiteRobotsPolicy,
} from '@lego-platform/shared/config';
import './global.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
  weight: ['400', '500', '600', '700', '800'],
});

const defaultMetadataTitle =
  'Brickhunt – LEGO sets kiezen, vergelijken en bewaren';
const defaultMetadataDescription =
  'Van Rivendell tot AT-AT: vind sneller LEGO-sets die je wilt bouwen, neerzetten of bewaren.';

export const metadata: Metadata = {
  title: defaultMetadataTitle,
  description: defaultMetadataDescription,
  applicationName: platformConfig.productName,
  robots: publicSiteRobotsPolicy.meta,
  openGraph: {
    title: defaultMetadataTitle,
    description: defaultMetadataDescription,
    siteName: platformConfig.productName,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultMetadataTitle,
    description: defaultMetadataDescription,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultAppLocaleContext = getDefaultAppLocaleContext();

  return (
    <html
      lang={defaultAppLocaleContext.htmlLang}
      className={plusJakartaSans.variable}
      data-theme="light"
      suppressHydrationWarning
    >
      <body className={plusJakartaSans.className}>
        <style dangerouslySetInnerHTML={{ __html: getThemeStyles() }} />
        <script
          dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }}
        />
        {children}
      </body>
    </html>
  );
}
