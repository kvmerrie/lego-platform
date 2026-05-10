import {
  getServerSupabaseConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CATALOG_USER_EVENTS_TABLE = 'catalog_user_events';
const MAX_CATALOG_EVENT_PAYLOAD_BYTES = 4_096;
const MAX_CATALOG_EVENT_METADATA_BYTES = 2_048;
const MAX_CATALOG_EVENT_METADATA_KEYS = 12;
const catalogEventTypes = [
  'catalog_set_click',
  'offer_click',
  'set_view',
] as const;
const allowedPayloadKeys = new Set([
  'event_type',
  'merchant_slug',
  'metadata',
  'page_path',
  'session_id',
  'set_num',
]);
const blockedMetadataKeys = new Set([
  'account',
  'account_id',
  'email',
  'ip',
  'user',
  'user_agent',
  'user_id',
  'useragent',
  'userid',
]);
const sessionIdPattern = /^[a-z0-9][a-z0-9._:-]{5,127}$/iu;
const setNumPattern = /^[a-z0-9-]{1,32}$/iu;
const merchantSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/iu;

type CatalogEventType = (typeof catalogEventTypes)[number];

export interface CatalogUserEventRecord {
  event_type: CatalogEventType;
  merchant_slug?: string;
  metadata?: Record<string, boolean | number | string | null>;
  page_path?: string;
  session_id: string;
  set_num?: string;
}

function createCatalogEventsSupabaseClient() {
  const { serviceRoleKey, url } = getServerSupabaseConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface CatalogUserEventValidationResult {
  record?: CatalogUserEventRecord;
  status: 204 | 400 | 413;
}

function getJsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isCatalogEventType(value: unknown): value is CatalogEventType {
  return (
    typeof value === 'string' &&
    catalogEventTypes.includes(value as CatalogEventType)
  );
}

function isMetadataValue(
  value: unknown,
): value is boolean | number | string | null {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function normalizeMetadata(
  value: unknown,
): Record<string, boolean | number | string | null> | undefined {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid_metadata');
  }

  const metadataEntries = Object.entries(value);

  if (metadataEntries.length > MAX_CATALOG_EVENT_METADATA_KEYS) {
    throw new Error('oversized_metadata');
  }

  const metadata: Record<string, boolean | number | string | null> = {};

  for (const [key, metadataValue] of metadataEntries) {
    const normalizedKey = key.trim();

    if (
      !normalizedKey ||
      normalizedKey.length > 48 ||
      blockedMetadataKeys.has(normalizedKey.toLowerCase()) ||
      !isMetadataValue(metadataValue)
    ) {
      throw new Error('invalid_metadata');
    }

    metadata[normalizedKey] = metadataValue;
  }

  if (getJsonByteLength(metadata) > MAX_CATALOG_EVENT_METADATA_BYTES) {
    throw new Error('oversized_metadata');
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function validateCatalogUserEventPayload(
  value: unknown,
): CatalogUserEventValidationResult {
  if (getJsonByteLength(value) > MAX_CATALOG_EVENT_PAYLOAD_BYTES) {
    return {
      status: 413,
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      status: 400,
    };
  }

  if (Object.keys(value).some((key) => !allowedPayloadKeys.has(key))) {
    return {
      status: 400,
    };
  }

  const payload = value as Record<string, unknown>;
  const eventType = payload['event_type'];
  const sessionId = readOptionalString(payload['session_id']);
  const setNum = readOptionalString(payload['set_num']);
  const merchantSlug = readOptionalString(payload['merchant_slug']);
  const pagePath = readOptionalString(payload['page_path']);

  if (
    !isCatalogEventType(eventType) ||
    !sessionIdPattern.test(sessionId ?? '')
  ) {
    return {
      status: 400,
    };
  }

  if (eventType === 'set_view' && !setNum) {
    return {
      status: 400,
    };
  }

  if (setNum && !setNumPattern.test(setNum)) {
    return {
      status: 400,
    };
  }

  if (merchantSlug && !merchantSlugPattern.test(merchantSlug)) {
    return {
      status: 400,
    };
  }

  if (pagePath && (!pagePath.startsWith('/') || pagePath.length > 240)) {
    return {
      status: 400,
    };
  }

  try {
    const metadata = normalizeMetadata(payload['metadata']);

    return {
      record: {
        event_type: eventType,
        ...(merchantSlug ? { merchant_slug: merchantSlug } : {}),
        ...(metadata ? { metadata } : {}),
        ...(pagePath ? { page_path: pagePath } : {}),
        session_id: sessionId as string,
        ...(setNum ? { set_num: setNum } : {}),
      },
      status: 204,
    };
  } catch (error) {
    return {
      status:
        error instanceof Error && error.message === 'oversized_metadata'
          ? 413
          : 400,
    };
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? '0');

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_CATALOG_EVENT_PAYLOAD_BYTES
  ) {
    return new NextResponse(null, {
      status: 413,
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, {
      status: 400,
    });
  }

  const validationResult = validateCatalogUserEventPayload(body);

  if (!validationResult.record) {
    return new NextResponse(null, {
      status: validationResult.status,
    });
  }

  if (!hasServerSupabaseConfig()) {
    return new NextResponse(null, {
      status: 204,
    });
  }

  try {
    const { error } = await createCatalogEventsSupabaseClient()
      .from(CATALOG_USER_EVENTS_TABLE)
      .insert(validationResult.record);

    if (error) {
      console.warn('[catalog-events] insert failed');
    }
  } catch {
    console.warn('[catalog-events] insert failed');
  }

  return new NextResponse(null, {
    status: 204,
  });
}
