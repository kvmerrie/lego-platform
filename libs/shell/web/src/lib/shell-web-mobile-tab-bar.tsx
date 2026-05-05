'use client';

import Link from 'next/link';
import {
  BadgeEuro,
  Blocks,
  Heart,
  Newspaper,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import styles from './shell-web.module.css';
import { dispatchOpenMobileSearchOverlayEvent } from './shell-web-search-overlay-events';

export type ShellWebMobileTabId =
  | 'articles'
  | 'deals'
  | 'following'
  | 'search'
  | 'themes';

interface ShellWebMobileTabItem {
  href: string;
  icon: LucideIcon;
  id: ShellWebMobileTabId;
  label: string;
}

const searchPath = buildWebPath(webPathnames.search);
const followingPath = buildWebPath(webPathnames.following);
const wishlistPath = buildWebPath(webPathnames.wishlist);
const dealsPath = buildWebPath(webPathnames.deals);
const searchOverlayPath = `${searchPath}?overlay=1`;
const articlesPath = buildWebPath(webPathnames.articles);
const articlesPathPrefix = `${articlesPath}/`;
const themesPath = buildWebPath(webPathnames.themes);
const themesPathPrefix = `${themesPath}/`;

const mobileTabItems: readonly ShellWebMobileTabItem[] = [
  {
    href: articlesPath,
    icon: Newspaper,
    id: 'articles',
    label: 'Nieuws',
  },
  {
    href: dealsPath,
    icon: BadgeEuro,
    id: 'deals',
    label: 'Deals',
  },
  {
    href: searchOverlayPath,
    icon: Search,
    id: 'search',
    label: 'Zoeken',
  },
  {
    href: themesPath,
    icon: Blocks,
    id: 'themes',
    label: "Thema's",
  },
  {
    href: followingPath,
    icon: Heart,
    id: 'following',
    label: 'Volgt',
  },
] as const;

export function getActiveMobileTabId({
  pathname,
}: {
  pathname?: string;
}): ShellWebMobileTabId | undefined {
  if (!pathname) {
    return undefined;
  }

  if (pathname === searchPath) {
    return 'search';
  }

  if (pathname === followingPath || pathname === wishlistPath) {
    return 'following';
  }

  if (pathname === articlesPath || pathname.startsWith(articlesPathPrefix)) {
    return 'articles';
  }

  if (pathname === themesPath || pathname.startsWith(themesPathPrefix)) {
    return 'themes';
  }

  if (pathname === dealsPath) {
    return 'deals';
  }

  return undefined;
}

function renderMobileTabBar(activeTabId?: ShellWebMobileTabId) {
  return (
    <nav aria-label="Mobiele tabnavigatie" className={styles.mobileTabBar}>
      <ul className={styles.mobileTabList}>
        {mobileTabItems.map((mobileTabItem) => {
          const TabIcon = mobileTabItem.icon;
          const isActive = mobileTabItem.id === activeTabId;

          return (
            <li className={styles.mobileTabItem} key={mobileTabItem.id}>
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={`${styles.mobileTabLink}${
                  isActive ? ` ${styles.mobileTabLinkActive}` : ''
                }`}
                href={mobileTabItem.href}
                onClick={(event) => {
                  if (
                    mobileTabItem.id !== 'search' ||
                    typeof window === 'undefined'
                  ) {
                    return;
                  }

                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }

                  event.preventDefault();
                  dispatchOpenMobileSearchOverlayEvent(window);
                }}
                scroll={mobileTabItem.id === 'search' ? false : undefined}
              >
                <TabIcon
                  aria-hidden="true"
                  className={styles.mobileTabIcon}
                  fill="none"
                  size={19}
                  strokeWidth={isActive ? 2.2 : 2.05}
                />
                <span className={styles.mobileTabLabel}>
                  {mobileTabItem.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ShellWebMobileTabBar() {
  const pathname = usePathname() ?? buildWebPath(webPathnames.home);

  return renderMobileTabBar(
    getActiveMobileTabId({
      pathname,
    }),
  );
}

export default ShellWebMobileTabBar;
