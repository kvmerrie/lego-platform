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
  publicWebBaseUrls,
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
const isProduction = process.env.VERCEL_ENV === 'production';

export const metadata: Metadata = {
  metadataBase: new URL(publicWebBaseUrls.production),
  title: defaultMetadataTitle,
  description: defaultMetadataDescription,
  applicationName: platformConfig.productName,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
  },
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
  other: isProduction
    ? {
        'tradetracker-site-verification':
          '8858de23ea80b4b082e07071ae75490ea2ef4c72', // TradeTracker
        ed72dd3c8e4430c: 'b7c0d46716f70588d904b1e98442871a', // Daisycon
      }
    : undefined,
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
      <head>
        <style
          data-lego-theme-styles="true"
          dangerouslySetInnerHTML={{ __html: getThemeStyles() }}
        />
      </head>

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
