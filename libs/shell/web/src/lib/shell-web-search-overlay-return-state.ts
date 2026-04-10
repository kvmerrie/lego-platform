'use client';

const searchOverlayReturnStateStorageKey =
  'brickhunt.search-overlay-return-state';

interface ShellWebSearchOverlayReturnState {
  href: string;
  scrollX: number;
  scrollY: number;
}

function normalizeSearchOverlayReturnState(
  parsedValue: unknown,
): ShellWebSearchOverlayReturnState | undefined {
  if (
    !parsedValue ||
    typeof parsedValue !== 'object' ||
    typeof (parsedValue as { href?: unknown }).href !== 'string' ||
    typeof (parsedValue as { scrollX?: unknown }).scrollX !== 'number' ||
    typeof (parsedValue as { scrollY?: unknown }).scrollY !== 'number'
  ) {
    return undefined;
  }

  return parsedValue as ShellWebSearchOverlayReturnState;
}

export function createCurrentLocationHref(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function readSearchOverlayReturnState(
  storage: Storage,
): ShellWebSearchOverlayReturnState | undefined {
  try {
    return normalizeSearchOverlayReturnState(
      JSON.parse(storage.getItem(searchOverlayReturnStateStorageKey) ?? 'null'),
    );
  } catch {
    return undefined;
  }
}

export function writeSearchOverlayReturnState(
  storage: Storage,
  returnState: ShellWebSearchOverlayReturnState,
) {
  storage.setItem(
    searchOverlayReturnStateStorageKey,
    JSON.stringify(returnState),
  );
}

export function clearSearchOverlayReturnState(storage: Storage) {
  storage.removeItem(searchOverlayReturnStateStorageKey);
}
