'use client';

import { useEffect } from 'react';

export const shellMobileViewportBottomOffsetVar =
  '--shell-mobile-viewport-bottom-offset';

export function getShellMobileViewportBottomOffset({
  innerHeight,
  visualViewportHeight,
  visualViewportOffsetTop,
}: {
  innerHeight: number;
  visualViewportHeight: number;
  visualViewportOffsetTop: number;
}): number {
  return Math.max(
    0,
    Math.round(innerHeight - (visualViewportHeight + visualViewportOffsetTop)),
  );
}

export function shouldSyncShellMobileViewportOffsetOnWindowResize({
  hasCoarsePointer,
  innerHeight,
  visualViewportHeight,
}: {
  hasCoarsePointer: boolean;
  innerHeight: number;
  visualViewportHeight: number;
}): boolean {
  return (
    hasCoarsePointer ||
    getShellMobileViewportBottomOffset({
      innerHeight,
      visualViewportHeight,
      visualViewportOffsetTop: 0,
    }) > 0
  );
}

export function ShellWebMobileViewportOffset() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rootElement = document.documentElement;
    const visualViewport = window.visualViewport;
    const shouldListenToWindowResize =
      typeof window.matchMedia === 'function'
        ? shouldSyncShellMobileViewportOffsetOnWindowResize({
            hasCoarsePointer: window.matchMedia('(pointer: coarse)').matches,
            innerHeight: window.innerHeight,
            visualViewportHeight: visualViewport?.height ?? window.innerHeight,
          })
        : true;

    if (!visualViewport) {
      rootElement.style.setProperty(shellMobileViewportBottomOffsetVar, '0px');

      return () => {
        rootElement.style.removeProperty(shellMobileViewportBottomOffsetVar);
      };
    }

    let frame = 0;

    const applyViewportOffset = () => {
      rootElement.style.setProperty(
        shellMobileViewportBottomOffsetVar,
        `${getShellMobileViewportBottomOffset({
          innerHeight: window.innerHeight,
          visualViewportHeight: visualViewport.height,
          visualViewportOffsetTop: visualViewport.offsetTop,
        })}px`,
      );
    };

    const scheduleViewportOffsetSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyViewportOffset);
    };

    scheduleViewportOffsetSync();
    visualViewport.addEventListener('resize', scheduleViewportOffsetSync);
    visualViewport.addEventListener('scroll', scheduleViewportOffsetSync);
    if (shouldListenToWindowResize) {
      window.addEventListener('resize', scheduleViewportOffsetSync);
    }

    return () => {
      visualViewport.removeEventListener('resize', scheduleViewportOffsetSync);
      visualViewport.removeEventListener('scroll', scheduleViewportOffsetSync);
      if (shouldListenToWindowResize) {
        window.removeEventListener('resize', scheduleViewportOffsetSync);
      }
      window.cancelAnimationFrame(frame);
      rootElement.style.removeProperty(shellMobileViewportBottomOffsetVar);
    };
  }, []);

  return null;
}

export default ShellWebMobileViewportOffset;
