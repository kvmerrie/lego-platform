'use client';

export const openMobileSearchOverlayEventName =
  'brickhunt:open-mobile-search-overlay';
export const mobileSearchOverlayVisibilityChangeEventName =
  'brickhunt:mobile-search-overlay-visibility';

export function dispatchOpenMobileSearchOverlayEvent(target: Window) {
  target.dispatchEvent(new Event(openMobileSearchOverlayEventName));
}

export function dispatchMobileSearchOverlayVisibilityEvent(
  target: Window,
  isOpen: boolean,
) {
  target.dispatchEvent(
    new CustomEvent(mobileSearchOverlayVisibilityChangeEventName, {
      detail: {
        isOpen,
      },
    }),
  );
}
