export type BrickhuntAnalyticsEventName =
  | 'catalog_set_click'
  | 'follow_price_auth_handoff'
  | 'follow_price_click'
  | 'follow_price_logged_out'
  | 'follow_price_success'
  | 'following_page_view'
  | 'following_nav_exposed'
  | 'how_it_works_page_view'
  | 'open_following_click'
  | 'offer_click'
  | 'open_wishlist_click'
  | 'set_view'
  | 'support_link_click'
  | 'theme_tile_click';

type BrickhuntAnalyticsPropertyValue = boolean | number | string | null;

export type BrickhuntAnalyticsPriceVerdict =
  | 'neutral'
  | 'positive'
  | 'unknown'
  | 'warning';

type BrickhuntAnalyticsUiPriceVerdict = BrickhuntAnalyticsPriceVerdict | 'info';

export type BrickhuntAnalyticsProperties = Record<
  string,
  BrickhuntAnalyticsPropertyValue | undefined
>;

export interface BrickhuntAnalyticsEventDescriptor {
  event: BrickhuntAnalyticsEventName;
  properties?: BrickhuntAnalyticsProperties;
}

interface BrickhuntAnalyticsPayload extends BrickhuntAnalyticsProperties {
  event: BrickhuntAnalyticsEventName;
  occurredAt: string;
  pathname?: string;
}

const BRICKHUNT_ANALYTICS_SESSION_STORAGE_KEY =
  'brickhunt.analytics-session-id';
const BRICKHUNT_CATALOG_EVENT_ENDPOINT = '/api/events/catalog';
const BRICKHUNT_ANALYTICS_SESSION_ID_PATTERN = /^.{16,128}$/u;
const SET_VIEW_DEDUPE_TTL_MS = 30_000;
const brickhuntServerPostedEvents = new Set<BrickhuntAnalyticsEventName>([
  'catalog_set_click',
  'offer_click',
  'set_view',
]);
const recentSetViewEventTimestamps = new Map<string, number>();

function sanitizeBrickhuntAnalyticsProperties(
  properties: BrickhuntAnalyticsProperties = {},
): BrickhuntAnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([, value]) => typeof value !== 'undefined',
    ),
  );
}

export function getBrickhuntAnalyticsPriceVerdict(
  value?: BrickhuntAnalyticsUiPriceVerdict | null,
): BrickhuntAnalyticsPriceVerdict {
  if (value === 'positive') {
    return 'positive';
  }

  if (value === 'warning') {
    return 'warning';
  }

  if (value === 'neutral' || value === 'info') {
    return 'neutral';
  }

  return 'unknown';
}

export function getBrickhuntAnalyticsPriceVerdictFromDelta(
  deltaMinor?: number,
): BrickhuntAnalyticsPriceVerdict {
  if (typeof deltaMinor !== 'number') {
    return 'unknown';
  }

  if (deltaMinor < 0) {
    return 'positive';
  }

  if (deltaMinor > 0) {
    return 'warning';
  }

  return 'neutral';
}

export function buildBrickhuntAnalyticsAttributes(
  descriptor?: BrickhuntAnalyticsEventDescriptor,
): Record<string, string> {
  if (!descriptor) {
    return {};
  }

  const properties = sanitizeBrickhuntAnalyticsProperties(
    descriptor.properties,
  );

  return {
    'data-brickhunt-event': descriptor.event,
    ...(Object.keys(properties).length > 0
      ? {
          'data-brickhunt-properties': JSON.stringify(properties),
        }
      : {}),
  };
}

function createBrickhuntAnalyticsSessionId(): string {
  const cryptoLike = window.crypto;

  if (typeof cryptoLike?.randomUUID === 'function') {
    return cryptoLike.randomUUID();
  }

  const randomValues = new Uint32Array(4);

  if (typeof cryptoLike?.getRandomValues === 'function') {
    cryptoLike.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < randomValues.length; index += 1) {
      randomValues[index] = Math.floor(Math.random() * 0xffffffff);
    }
  }

  return [...randomValues]
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('-');
}

export function getBrickhuntAnalyticsSessionId(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const existingSessionId = window.localStorage.getItem(
      BRICKHUNT_ANALYTICS_SESSION_STORAGE_KEY,
    );

    if (
      existingSessionId &&
      BRICKHUNT_ANALYTICS_SESSION_ID_PATTERN.test(existingSessionId)
    ) {
      return existingSessionId;
    }

    const sessionId = createBrickhuntAnalyticsSessionId();

    window.localStorage.setItem(
      BRICKHUNT_ANALYTICS_SESSION_STORAGE_KEY,
      sessionId,
    );

    return sessionId;
  } catch {
    return createBrickhuntAnalyticsSessionId();
  }
}

function getAnalyticsStringProperty(
  properties: BrickhuntAnalyticsProperties | undefined,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = properties?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function buildCatalogEventMetadata(
  properties: BrickhuntAnalyticsProperties | undefined,
): BrickhuntAnalyticsProperties | undefined {
  const reservedKeys = new Set(['merchantSlug', 'setId', 'setNum']);
  const metadata = sanitizeBrickhuntAnalyticsProperties(
    Object.fromEntries(
      Object.entries(properties ?? {}).filter(
        ([key]) => !reservedKeys.has(key),
      ),
    ),
  );

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function getSetViewDedupeStorageKey(dedupeKey: string): string {
  return `brickhunt.analytics-dedupe.${dedupeKey}`;
}

function readSetViewDedupeTimestamp(dedupeKey: string): number | undefined {
  const memoryTimestamp = recentSetViewEventTimestamps.get(dedupeKey);

  if (typeof memoryTimestamp === 'number') {
    return memoryTimestamp;
  }

  try {
    const storedTimestamp = window.sessionStorage.getItem(
      getSetViewDedupeStorageKey(dedupeKey),
    );
    const parsedTimestamp = storedTimestamp ? Number(storedTimestamp) : NaN;

    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : undefined;
  } catch {
    return undefined;
  }
}

function writeSetViewDedupeTimestamp(
  dedupeKey: string,
  timestamp: number,
): void {
  recentSetViewEventTimestamps.set(dedupeKey, timestamp);

  try {
    window.sessionStorage.setItem(
      getSetViewDedupeStorageKey(dedupeKey),
      String(timestamp),
    );
  } catch {
    // Session storage is only a best-effort duplicate guard.
  }
}

export function shouldPostSetViewAnalyticsEvent({
  now = Date.now(),
  pagePath,
  setNum,
}: {
  now?: number;
  pagePath: string;
  setNum?: string;
}): boolean {
  if (!setNum) {
    return false;
  }

  const dedupeKey = `set_view:${setNum}:${pagePath}`;
  const previousTimestamp = readSetViewDedupeTimestamp(dedupeKey);

  if (
    typeof previousTimestamp === 'number' &&
    previousTimestamp <= now &&
    now - previousTimestamp < SET_VIEW_DEDUPE_TTL_MS
  ) {
    return false;
  }

  writeSetViewDedupeTimestamp(dedupeKey, now);

  return true;
}

export function postBrickhuntAnalyticsEventToServer({
  event,
  properties,
}: BrickhuntAnalyticsEventDescriptor): void {
  if (
    typeof window === 'undefined' ||
    !brickhuntServerPostedEvents.has(event)
  ) {
    return;
  }

  try {
    const sessionId = getBrickhuntAnalyticsSessionId();

    if (!sessionId) {
      return;
    }

    const payload = {
      event_type: event,
      merchant_slug: getAnalyticsStringProperty(properties, ['merchantSlug']),
      metadata: buildCatalogEventMetadata(properties),
      page_path: window.location.pathname,
      session_id: sessionId,
      set_num: getAnalyticsStringProperty(properties, ['setNum', 'setId']),
    };

    if (
      event === 'set_view' &&
      !shouldPostSetViewAnalyticsEvent({
        pagePath: payload.page_path,
        setNum: payload.set_num,
      })
    ) {
      return;
    }

    const body = JSON.stringify(payload);
    const blob = new Blob([body], {
      type: 'application/json',
    });
    const beaconSent =
      typeof window.navigator.sendBeacon === 'function'
        ? window.navigator.sendBeacon(BRICKHUNT_CATALOG_EVENT_ENDPOINT, blob)
        : false;

    if (beaconSent) {
      return;
    }

    void window
      .fetch(BRICKHUNT_CATALOG_EVENT_ENDPOINT, {
        body,
        headers: {
          'content-type': 'application/json',
        },
        keepalive: true,
        method: 'POST',
      })
      .catch(() => undefined);
  } catch {
    // Analytics must never block navigation or merchant clickout.
  }
}

export function readBrickhuntAnalyticsDescriptorFromTarget(
  target: EventTarget | null,
): BrickhuntAnalyticsEventDescriptor | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }

  const analyticsElement = target.closest('[data-brickhunt-event]');

  if (!(analyticsElement instanceof HTMLElement)) {
    return undefined;
  }

  const eventName = analyticsElement.dataset['brickhuntEvent'];

  if (!eventName) {
    return undefined;
  }

  const properties = analyticsElement.dataset['brickhuntProperties'];

  if (!properties) {
    return {
      event: eventName as BrickhuntAnalyticsEventName,
    };
  }

  try {
    return {
      event: eventName as BrickhuntAnalyticsEventName,
      properties: sanitizeBrickhuntAnalyticsProperties(
        JSON.parse(properties) as BrickhuntAnalyticsProperties,
      ),
    };
  } catch {
    return {
      event: eventName as BrickhuntAnalyticsEventName,
    };
  }
}

export function trackBrickhuntAnalyticsEvent({
  event,
  properties,
}: BrickhuntAnalyticsEventDescriptor) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: BrickhuntAnalyticsPayload = {
    event,
    occurredAt: new Date().toISOString(),
    pathname: window.location.pathname,
    ...sanitizeBrickhuntAnalyticsProperties(properties),
  };
  const analyticsWindow = window as Window & {
    __brickhuntAnalyticsQueue?: BrickhuntAnalyticsPayload[];
    dataLayer?: BrickhuntAnalyticsPayload[];
  };

  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.__brickhuntAnalyticsQueue =
    analyticsWindow.__brickhuntAnalyticsQueue ?? [];
  analyticsWindow.dataLayer.push(payload);
  analyticsWindow.__brickhuntAnalyticsQueue.push(payload);
  postBrickhuntAnalyticsEventToServer({
    event,
    properties,
  });
  window.dispatchEvent(
    new CustomEvent('brickhunt:analytics', {
      detail: payload,
    }),
  );
}
