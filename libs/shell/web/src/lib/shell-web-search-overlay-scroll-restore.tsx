'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  clearSearchOverlayReturnState,
  createCurrentLocationHref,
  readSearchOverlayReturnState,
} from './shell-web-search-overlay-return-state';

const scrollRestoreTolerance = 2;
const maxScrollRestoreAttempts = 30;

function getMaxScrollableY(): number {
  return Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
}

function hasReachedTargetScroll({
  scrollX,
  scrollY,
}: {
  scrollX: number;
  scrollY: number;
}): boolean {
  return (
    Math.abs(window.scrollX - scrollX) <= scrollRestoreTolerance &&
    Math.abs(window.scrollY - scrollY) <= scrollRestoreTolerance
  );
}

export function ShellWebSearchOverlayScrollRestore() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const returnState = readSearchOverlayReturnState(window.sessionStorage);

    if (!returnState) {
      return;
    }

    if (createCurrentLocationHref(window.location) !== returnState.href) {
      return;
    }

    let frame = 0;
    let attemptCount = 0;

    const tryRestoreScroll = () => {
      attemptCount += 1;

      const canReachTargetY =
        getMaxScrollableY() >= returnState.scrollY - scrollRestoreTolerance;

      if (!canReachTargetY && attemptCount < maxScrollRestoreAttempts) {
        frame = window.requestAnimationFrame(tryRestoreScroll);
        return;
      }

      window.scrollTo({
        left: returnState.scrollX,
        top: returnState.scrollY,
      });

      if (hasReachedTargetScroll(returnState)) {
        clearSearchOverlayReturnState(window.sessionStorage);
        return;
      }

      if (attemptCount >= maxScrollRestoreAttempts) {
        clearSearchOverlayReturnState(window.sessionStorage);
        return;
      }

      frame = window.requestAnimationFrame(tryRestoreScroll);
    };

    frame = window.requestAnimationFrame(tryRestoreScroll);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}

export default ShellWebSearchOverlayScrollRestore;
