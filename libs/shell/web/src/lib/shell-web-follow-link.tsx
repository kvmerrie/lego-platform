'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSetDealVerdict } from '@lego-platform/pricing/data-access';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';
import {
  buildBrickhuntAnalyticsAttributes,
  trackBrickhuntAnalyticsEvent,
} from '@lego-platform/shared/util';
import { getFollowedPriceSetCollection } from '@lego-platform/wishlist/data-access';
import styles from './shell-web.module.css';

export function getFollowingNavPageSurface(pathname?: string): string {
  if (!pathname || pathname === '/') {
    return 'homepage';
  }

  if (pathname === buildWebPath(webPathnames.discover)) {
    return 'discover';
  }

  if (pathname === buildWebPath(webPathnames.search)) {
    return 'search';
  }

  if (pathname === buildWebPath(webPathnames.following)) {
    return 'following';
  }

  if (pathname === '/hoe-werkt-het') {
    return 'how_it_works';
  }

  if (pathname.startsWith(`${buildWebPath(webPathnames.sets)}/`)) {
    return 'set_detail';
  }

  if (pathname.startsWith(`${buildWebPath(webPathnames.themes)}/`)) {
    return 'theme_page';
  }

  if (pathname === buildWebPath(webPathnames.themes)) {
    return 'themes';
  }

  return 'other';
}

function isVisibleFollowingNavVariant(variant: 'desktop' | 'mobile'): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const isDesktopViewport = window.matchMedia('(min-width: 64rem)').matches;

  return variant === 'desktop' ? isDesktopViewport : !isDesktopViewport;
}

export function getFollowLinkLabel({
  followedSetCount,
  interestingSetCount,
}: {
  followedSetCount?: number;
  interestingSetCount?: number;
}): string {
  if (!followedSetCount || followedSetCount < 1) {
    return 'Volgt';
  }

  if (interestingSetCount && interestingSetCount > 0) {
    return `Volgt (${followedSetCount}) · ${interestingSetCount} nu interessant`;
  }

  return `Volgt (${followedSetCount})`;
}

export function ShellWebFollowLink({
  variant,
}: {
  variant: 'desktop' | 'mobile';
}) {
  const pathname = usePathname() ?? '/';
  const [followedSetCount, setFollowedSetCount] = useState<number>();
  const [interestingSetCount, setInterestingSetCount] = useState<number>();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>();
  const exposurePathnameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    async function loadFollowedSetCount() {
      try {
        const followedPriceSetCollection =
          await getFollowedPriceSetCollection();

        if (!isMounted) {
          return;
        }

        setFollowedSetCount(followedPriceSetCollection.followedSetIds.length);
        setInterestingSetCount(
          followedPriceSetCollection.followedSetIds.filter(
            (setId) => getSetDealVerdict(setId).tone === 'positive',
          ).length,
        );
        setIsAuthenticated(followedPriceSetCollection.isAuthenticated);
      } catch {
        if (!isMounted) {
          return;
        }

        setFollowedSetCount(undefined);
        setInterestingSetCount(undefined);
        setIsAuthenticated(undefined);
      }
    }

    void loadFollowedSetCount();

    const unsubscribeAuth = subscribeToSupabaseAuthChanges(() => {
      if (!isMounted) {
        return;
      }

      void loadFollowedSetCount();
    });
    const unsubscribeAccount = subscribeToBrowserAccountDataChanges(() => {
      if (!isMounted) {
        return;
      }

      void loadFollowedSetCount();
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      unsubscribeAccount();
    };
  }, []);

  useEffect(() => {
    if (
      !interestingSetCount ||
      interestingSetCount < 1 ||
      !isVisibleFollowingNavVariant(variant) ||
      exposurePathnameRef.current === pathname
    ) {
      return;
    }

    trackBrickhuntAnalyticsEvent({
      event: 'following_nav_exposed',
      properties: {
        followedSetCount,
        interestingSetCount,
        pageSurface: getFollowingNavPageSurface(pathname),
        signedIn: isAuthenticated,
      },
    });
    exposurePathnameRef.current = pathname;
  }, [
    followedSetCount,
    interestingSetCount,
    isAuthenticated,
    pathname,
    variant,
  ]);

  return (
    <a
      className={variant === 'desktop' ? styles.navLink : styles.mobileNavLink}
      href={buildWebPath(webPathnames.following)}
      {...buildBrickhuntAnalyticsAttributes({
        event: 'open_following_click',
        properties: {
          entryPoint: 'global_header',
          followedSetCount,
          interestingSetCount,
          navigationVariant: variant,
          pageSurface: getFollowingNavPageSurface(pathname),
          signedIn: isAuthenticated,
        },
      })}
    >
      {getFollowLinkLabel({
        followedSetCount,
        interestingSetCount,
      })}
    </a>
  );
}

export default ShellWebFollowLink;
