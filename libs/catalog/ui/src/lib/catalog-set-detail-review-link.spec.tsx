/** @vitest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OPEN_PRODUCT_REVIEWS_EVENT,
  PRODUCT_REVIEWS_SECTION_ID,
} from '@lego-platform/shared/config';
import { CatalogSetDetailReviewLink } from './catalog-set-detail-review-link';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('CatalogSetDetailReviewLink', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('keeps the product reviews hash href and dispatches the open event on click', async () => {
    const openListener = vi.fn();
    window.addEventListener(OPEN_PRODUCT_REVIEWS_EVENT, openListener);

    await act(async () => {
      root.render(
        <CatalogSetDetailReviewLink href={`#${PRODUCT_REVIEWS_SECTION_ID}`}>
          (19)
        </CatalogSetDetailReviewLink>,
      );
    });

    const link = container.querySelector<HTMLAnchorElement>('a');

    expect(link?.getAttribute('href')).toBe('#productbeoordelingen');

    await act(async () => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(openListener).toHaveBeenCalledTimes(1);

    await act(async () => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(openListener).toHaveBeenCalledTimes(2);

    window.removeEventListener(OPEN_PRODUCT_REVIEWS_EVENT, openListener);
  });
});
