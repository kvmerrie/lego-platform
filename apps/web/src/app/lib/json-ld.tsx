import type { ReactElement } from 'react';
import React from 'react';

export type JsonLdValue =
  | boolean
  | number
  | string
  | null
  | readonly JsonLdValue[]
  | { [key: string]: JsonLdValue | undefined };

export interface JsonLdScriptProps {
  data: JsonLdValue | readonly JsonLdValue[];
}

function sanitizeJsonLdValue(
  value: JsonLdValue | undefined,
): JsonLdValue | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item) => sanitizeJsonLdValue(item))
      .filter((item): item is JsonLdValue => item !== undefined);

    return sanitizedArray.length ? sanitizedArray : undefined;
  }

  if (typeof value === 'object') {
    const sanitizedEntries = Object.entries(value)
      .map(([key, item]) => [key, sanitizeJsonLdValue(item)] as const)
      .filter(
        (entry): entry is readonly [string, JsonLdValue] =>
          entry[1] !== undefined,
      );

    return sanitizedEntries.length
      ? Object.fromEntries(sanitizedEntries)
      : undefined;
  }

  return value;
}

export function serializeJsonLd(
  data: JsonLdValue | readonly JsonLdValue[],
): string {
  const sanitizedData = Array.isArray(data)
    ? data
        .map((item) => sanitizeJsonLdValue(item))
        .filter((item): item is JsonLdValue => item !== undefined)
    : sanitizeJsonLdValue(data);

  return JSON.stringify(sanitizedData).replace(/</gu, '\\u003c');
}

export function JsonLdScript({ data }: JsonLdScriptProps): ReactElement {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(data),
      }}
    />
  );
}
