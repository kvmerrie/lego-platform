import type { Metadata } from 'next';
import Script from 'next/script';
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
  'Van Rivendell tot AT-AT: vind sneller de LEGO-doos die je wilt hebben.';

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
      <Script
        id="gtm-script"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id=GTM-KLWBFMT2'+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-KLWBFMT2');
          `,
        }}
      />
      <body className={plusJakartaSans.className}>
        <style dangerouslySetInnerHTML={{ __html: getThemeStyles() }} />
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {getThemeBootstrapScript()}
        </Script>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KLWBFMT2"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
