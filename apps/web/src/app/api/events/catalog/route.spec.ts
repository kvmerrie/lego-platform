import { describe, expect, test } from 'vitest';
import { POST, validateCatalogUserEventPayload } from './route';

describe('catalog event payload validation', () => {
  test('accepts valid set_view events', () => {
    expect(
      validateCatalogUserEventPayload({
        event_type: 'set_view',
        page_path: '/sets/icons-rivendell-10316',
        session_id: 'session-123',
        set_num: '10316',
      }),
    ).toMatchObject({
      record: {
        event_type: 'set_view',
        session_id: 'session-123',
        set_num: '10316',
      },
      status: 204,
    });
  });

  test('accepts valid offer_click events', () => {
    expect(
      validateCatalogUserEventPayload({
        event_type: 'offer_click',
        merchant_slug: 'bol',
        metadata: {
          offerPlacement: 'best_offer',
        },
        session_id: 'session-123',
        set_num: '10316',
      }),
    ).toMatchObject({
      record: {
        event_type: 'offer_click',
        merchant_slug: 'bol',
        session_id: 'session-123',
        set_num: '10316',
      },
      status: 204,
    });
  });

  test('rejects invalid event types', () => {
    expect(
      validateCatalogUserEventPayload({
        event_type: 'profile_view',
        session_id: 'session-123',
      }),
    ).toEqual({
      status: 400,
    });
  });

  test('rejects oversized metadata', () => {
    expect(
      validateCatalogUserEventPayload({
        event_type: 'catalog_set_click',
        metadata: {
          value: 'x'.repeat(2_100),
        },
        session_id: 'session-123',
        set_num: '10316',
      }),
    ).toEqual({
      status: 413,
    });
  });

  test('rejects malformed JSON', async () => {
    const response = await POST(
      new Request('https://brickhunt.test/api/events/catalog', {
        body: '{',
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(400);
  });

  test('rejects too long strings', () => {
    expect(
      validateCatalogUserEventPayload({
        event_type: 'set_view',
        page_path: `/${'x'.repeat(241)}`,
        session_id: 'session-123',
        set_num: '10316',
      }),
    ).toEqual({
      status: 400,
    });

    expect(
      validateCatalogUserEventPayload({
        event_type: 'set_view',
        session_id: 'session-123',
        set_num: '1'.repeat(33),
      }),
    ).toEqual({
      status: 400,
    });
  });
});
