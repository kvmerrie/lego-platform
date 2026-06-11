'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { OPEN_PRODUCT_REVIEWS_EVENT } from '@lego-platform/shared/config';

export function CatalogSetDetailReviewLink({
  children,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
}) {
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          window.dispatchEvent(new CustomEvent(OPEN_PRODUCT_REVIEWS_EVENT));
        }
      }}
    >
      {children}
    </a>
  );
}
