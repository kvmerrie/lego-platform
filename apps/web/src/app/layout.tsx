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

const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

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
  other: {
    'tradetracker-site-verification':
      '8858de23ea80b4b082e07071ae75490ea2ef4c72',
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
      {gtmId ? (
        <Script
          id="gtm-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `,
          }}
        />
      ) : null}

      <body className={plusJakartaSans.className}>
        <style dangerouslySetInnerHTML={{ __html: getThemeStyles() }} />
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {getThemeBootstrapScript()}
        </Script>

        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        ) : null}

        {children}
      </body>
    </html>
  );
}
