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
  window.dispatchEvent(
    new CustomEvent('brickhunt:analytics', {
      detail: payload,
    }),
  );
}
