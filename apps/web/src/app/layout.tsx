import type { Metadata } from 'next';
import {
  getThemeBootstrapScript,
  getThemeStyles,
} from '@lego-platform/shared/design-tokens';
import { platformConfig } from '@lego-platform/shared/config';
import './global.css';

export const metadata: Metadata = {
  title: platformConfig.productName,
  description: platformConfig.tagline,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <style dangerouslySetInnerHTML={{ __html: getThemeStyles() }} />
        <script
          dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }}
        />
        {children}
      </body>
    </html>
  );
}
