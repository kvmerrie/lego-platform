import type { Preview } from '@storybook/react-vite';
import { getThemeStyles } from '@lego-platform/shared/design-tokens';
import './storybook-preview.css';

const storybookThemeStyleId = 'brickhunt-storybook-theme-styles';

if (typeof globalThis !== 'undefined' && !('process' in globalThis)) {
  (
    globalThis as typeof globalThis & {
      process?: { env: Record<string, string> };
    }
  ).process = { env: {} };
}

if (typeof document !== 'undefined') {
  if (!document.getElementById(storybookThemeStyleId)) {
    const styleElement = document.createElement('style');

    styleElement.id = storybookThemeStyleId;
    styleElement.textContent = getThemeStyles();
    document.head.appendChild(styleElement);
  }

  document.documentElement.dataset.theme = 'light';
}

const preview: Preview = {
  parameters: {
    layout: 'padded',
  },
};

export default preview;
