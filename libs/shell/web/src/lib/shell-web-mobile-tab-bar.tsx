'use client';

import Link from 'next/link';
import {
  BadgeEuro,
  Blocks,
  Heart,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import styles from './shell-web.module.css';
import { dispatchOpenMobileSearchOverlayEvent } from './shell-web-search-overlay-events';

export type ShellWebMobileTabId = 'deals' | 'following' | 'search' | 'themes';

interface ShellWebMobileTabItem {
  href: string;
  icon: LucideIcon;
  id: ShellWebMobileTabId;
  label: string;
}

const discoverPath = buildWebPath(webPathnames.discover);
const searchPath = buildWebPath(webPathnames.search);
const followingPath = buildWebPath(webPathnames.following);
const wishlistPath = buildWebPath(webPathnames.wishlist);
const dealsPath = `${discoverPath}?filter=best-deals`;
const searchOverlayPath = `${searchPath}?overlay=1`;
const themesPath = buildWebPath(webPathnames.themes);
const themesPathPrefix = `${themesPath}/`;

const mobileTabItems: readonly ShellWebMobileTabItem[] = [
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
  searchFilter,
}: {
  pathname?: string;
  searchFilter?: string | null;
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

  if (pathname === themesPath || pathname.startsWith(themesPathPrefix)) {
    return 'themes';
  }

  if (pathname === discoverPath && searchFilter === 'best-deals') {
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
  const searchFilter =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('filter');

  return renderMobileTabBar(
    getActiveMobileTabId({
      pathname,
      searchFilter,
    }),
  );
}

export default ShellWebMobileTabBar;
