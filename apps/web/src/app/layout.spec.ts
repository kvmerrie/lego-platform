import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const layoutSourcePath = fileURLToPath(
  new URL('./layout.tsx', import.meta.url),
);

describe('RootLayout theme tokens', () => {
  it('renders shared LEGO design tokens from the document head', () => {
    const layoutSource = readFileSync(layoutSourcePath, 'utf8');
    const headStart = layoutSource.indexOf('<head>');
    const headEnd = layoutSource.indexOf('</head>');
    const bodyStart = layoutSource.indexOf('<body');
    const bodyEnd = layoutSource.indexOf('</body>');
    const headSource = layoutSource.slice(headStart, headEnd);
    const bodySource = layoutSource.slice(bodyStart, bodyEnd);

    expect(headSource).toContain('data-lego-theme-styles="true"');
    expect(headSource).toContain('getThemeStyles()');
    expect(bodySource).not.toContain('getThemeStyles()');
  });

  it('exposes the Bing Webmaster Tools verification only for production metadata', () => {
    const layoutSource = readFileSync(layoutSourcePath, 'utf8');

    expect(layoutSource).toContain(
      "const bingWebmasterVerificationCode = 'D679C68888AADBE90DEA7E0E035F8053';",
    );
    expect(layoutSource).toContain('verification: isProduction');
    expect(layoutSource).toContain(
      "'msvalidate.01': bingWebmasterVerificationCode,",
    );
  });
});
