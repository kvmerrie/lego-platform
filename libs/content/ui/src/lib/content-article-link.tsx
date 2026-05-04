'use client';

import type { MouseEvent, ReactNode } from 'react';
import { ActionLink } from '@lego-platform/shared/ui';

declare global {
  interface Window {
    gtag?: (
      command: 'event',
      eventName: string,
      eventParameters:
        | {
            slug: string;
            theme?: string;
          }
        | {
            article_slug?: string;
            set_id: string;
            set_name: string;
            source: 'article';
          },
    ) => void;
  }
}

export function trackContentArticleClick({
  slug,
  theme,
}: {
  slug: string;
  theme?: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'article_click', {
      slug,
      theme,
    });
  }

  try {
    void window
      .fetch('/api/events/article-click', {
        body: JSON.stringify({
          slug,
        }),
        headers: {
          'content-type': 'application/json',
        },
        keepalive: true,
        method: 'POST',
      })
      .catch(() => undefined);
  } catch {
    // Tracking must never block navigation.
  }
}

export function trackArticleSetClick({
  articleSlug,
  setId,
  setName,
}: {
  articleSlug?: string;
  setId: string;
  setName: string;
}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', 'set_click', {
    article_slug: articleSlug,
    set_id: setId,
    set_name: setName,
    source: 'article',
  });
}

export function ContentArticleLink({
  children,
  className,
  href,
  slug,
  theme,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  slug: string;
  theme?: string;
}) {
  function handleClick(_: MouseEvent<HTMLAnchorElement>) {
    trackContentArticleClick({
      slug,
      theme,
    });
  }

  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}

export function ContentArticleSetLink({
  articleSlug,
  children,
  className,
  href,
  setId,
  setName,
}: {
  articleSlug?: string;
  children: ReactNode;
  className?: string;
  href: string;
  setId: string;
  setName: string;
}) {
  function handleClick(_: MouseEvent<HTMLAnchorElement>) {
    trackArticleSetClick({
      articleSlug,
      setId,
      setName,
    });
  }

  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}

export function ContentArticleSetActionLink({
  articleSlug,
  children,
  href,
  setId,
  setName,
}: {
  articleSlug?: string;
  children: ReactNode;
  href: string;
  setId: string;
  setName: string;
}) {
  function handleClick(_: MouseEvent<HTMLAnchorElement>) {
    trackArticleSetClick({
      articleSlug,
      setId,
      setName,
    });
  }

  return (
    <ActionLink href={href} onClick={handleClick} tone="accent">
      {children}
    </ActionLink>
  );
}

export default ContentArticleLink;
