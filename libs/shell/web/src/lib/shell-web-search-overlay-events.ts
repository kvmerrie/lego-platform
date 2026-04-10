'use client';

export const openMobileSearchOverlayEventName =
  'brickhunt:open-mobile-search-overlay';

export function dispatchOpenMobileSearchOverlayEvent(target: Window) {
  target.dispatchEvent(new Event(openMobileSearchOverlayEventName));
}
