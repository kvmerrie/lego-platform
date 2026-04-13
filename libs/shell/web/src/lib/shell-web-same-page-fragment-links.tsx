'use client';

import { useEffect } from 'react';

function normalizePathname(pathname: string): string {
  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/, '');
}

function isPlainPrimaryClick(event: MouseEvent): boolean {
  return !(
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function getAnchorFromClickTarget(
  eventTarget: EventTarget | null,
): HTMLAnchorElement | null {
  if (eventTarget instanceof HTMLAnchorElement) {
    return eventTarget;
  }

  if (eventTarget instanceof Element) {
    const closestAnchor = eventTarget.closest('a[href]');

    return closestAnchor instanceof HTMLAnchorElement ? closestAnchor : null;
  }

  if (eventTarget instanceof Node) {
    const closestAnchor = eventTarget.parentElement?.closest('a[href]');

    return closestAnchor instanceof HTMLAnchorElement ? closestAnchor : null;
  }

  return null;
}

export function isSamePageFragmentUrl({
  currentUrl,
  targetUrl,
}: {
  currentUrl: URL;
  targetUrl: URL;
}): boolean {
  return (
    Boolean(targetUrl.hash && targetUrl.hash !== '#') &&
    currentUrl.origin === targetUrl.origin &&
    normalizePathname(currentUrl.pathname) ===
      normalizePathname(targetUrl.pathname) &&
    currentUrl.search === targetUrl.search
  );
}

export function getFragmentScrollBehavior({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}): ScrollBehavior {
  return prefersReducedMotion ? 'auto' : 'smooth';
}

function resolveFragmentTarget(hash: string): HTMLElement | null {
  const targetId = decodeURIComponent(hash.replace(/^#/, ''));

  if (!targetId) {
    return null;
  }

  return document.getElementById(targetId);
}

export function ShellWebSamePageFragmentLinks() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!isPlainPrimaryClick(event)) {
        return;
      }

      const anchor = getAnchorFromClickTarget(event.target);

      if (!anchor) {
        return;
      }

      if (anchor.target && anchor.target !== '_self' && anchor.target !== '') {
        return;
      }

      if (anchor.hasAttribute('download')) {
        return;
      }

      const href = anchor.getAttribute('href');

      if (!href || !href.includes('#')) {
        return;
      }

      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(anchor.href, currentUrl.href);

      if (!isSamePageFragmentUrl({ currentUrl, targetUrl })) {
        return;
      }

      const target = resolveFragmentTarget(targetUrl.hash);

      if (!target) {
        return;
      }

      event.preventDefault();

      const nextHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

      if (targetUrl.hash !== currentUrl.hash) {
        window.history.pushState(window.history.state, '', nextHref);
      } else {
        window.history.replaceState(window.history.state, '', nextHref);
      }

      target.scrollIntoView({
        behavior: getFragmentScrollBehavior({
          prefersReducedMotion: window.matchMedia(
            '(prefers-reduced-motion: reduce)',
          ).matches,
        }),
        block: 'start',
        inline: 'nearest',
      });
    }

    document.addEventListener('click', handleDocumentClick, {
      capture: true,
    });

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  return null;
}

export default ShellWebSamePageFragmentLinks;
