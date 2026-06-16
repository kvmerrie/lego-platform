import { describe, expect, test } from 'vitest';
import { classifyScheduledJobFailure } from './scheduled-job-reliability';

describe('scheduled job reliability', () => {
  test('treats upstream 403 feed failures as recoverable degraded runs', () => {
    expect(
      classifyScheduledJobFailure(
        new Error('TradeTracker Lidl feed request failed with 403 Forbidden.'),
      ),
    ).toEqual({
      exitCode: 0,
      failureType: 'upstream_http',
      recoverable: true,
    });
  });

  test('treats upstream 429 feed failures as recoverable degraded runs', () => {
    expect(
      classifyScheduledJobFailure(
        new Error(
          'Awin Coolblue feed request failed with 429 Too Many Requests.',
        ),
      ),
    ).toEqual({
      exitCode: 0,
      failureType: 'upstream_http',
      recoverable: true,
    });
  });

  test('keeps parser/schema malformed feed payloads as hard failures', () => {
    expect(
      classifyScheduledJobFailure(
        new Error('TradeTracker Lidl feed XML is missing a products root.'),
      ),
    ).toEqual({
      exitCode: 1,
      failureType: 'malformed_payload',
      recoverable: false,
    });
  });

  test('treats temporary upstream empty responses as recoverable degraded runs', () => {
    expect(
      classifyScheduledJobFailure(
        new Error('MisterBricks feed response did not include a body.'),
      ),
    ).toEqual({
      exitCode: 0,
      failureType: 'upstream_invalid_response',
      recoverable: true,
    });
  });

  test('treats temporary upstream html responses as recoverable degraded runs', () => {
    expect(
      classifyScheduledJobFailure(
        new Error('TradeTracker feed returned HTML response instead of XML.'),
      ),
    ).toEqual({
      exitCode: 0,
      failureType: 'upstream_invalid_response',
      recoverable: true,
    });
  });

  test('treats temporary upstream non-XML responses as recoverable degraded runs', () => {
    expect(
      classifyScheduledJobFailure(
        new Error('Unieke Bricks feed returned non-XML upstream response.'),
      ),
    ).toEqual({
      exitCode: 0,
      failureType: 'upstream_invalid_response',
      recoverable: true,
    });
  });

  test('keeps missing feed configuration as hard failures', () => {
    expect(
      classifyScheduledJobFailure(
        new Error(
          'Set TRADETRACKER_ALTERNATE_FEED_ID to choose one explicitly.',
        ),
      ),
    ).toEqual({
      exitCode: 1,
      failureType: 'config',
      recoverable: false,
    });
  });

  test('keeps Supabase write failures as hard failures', () => {
    expect(
      classifyScheduledJobFailure(
        new Error('Unable to persist the commerce latest offer record.'),
      ),
    ).toEqual({
      exitCode: 1,
      failureType: 'supabase_write',
      recoverable: false,
    });
  });

  test('treats transient network failures as recoverable degraded runs', () => {
    expect(classifyScheduledJobFailure(new TypeError('fetch failed'))).toEqual({
      exitCode: 0,
      failureType: 'transient_network',
      recoverable: true,
    });
  });
});
