import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import {
  getThemeBootstrapScript,
  getThemeStyles,
} from '@lego-platform/shared/design-tokens';
import {
  getDefaultAppLocaleContext,
  platformConfig,
} from '@lego-platform/shared/config';
import './global.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: platformConfig.productName,
  description: platformConfig.tagline,
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
