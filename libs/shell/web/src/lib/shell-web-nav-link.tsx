'use client';

import { usePathname } from 'next/navigation';
import styles from './shell-web.module.css';

export function isShellWebNavLinkActive({
  href,
  pathname,
  searchFilter,
}: {
  href: string;
  pathname?: string | null;
  searchFilter?: string | null;
}): boolean {
  if (!pathname) {
    return false;
  }

  const [hrefPathname, hrefSearch] = href.split('?');

  if (hrefSearch) {
    const hrefSearchParams = new URLSearchParams(hrefSearch);
    const hrefFilter = hrefSearchParams.get('filter');

    return (
      pathname === hrefPathname && (!hrefFilter || searchFilter === hrefFilter)
    );
  }

  return pathname === hrefPathname || pathname.startsWith(`${hrefPathname}/`);
}

export function ShellWebNavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const searchFilter =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('filter');
  const isActive = isShellWebNavLinkActive({
    href,
    pathname,
    searchFilter,
  });

  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={`${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ''}`}
      href={href}
    >
      {label}
    </a>
  );
}

export default ShellWebNavLink;
