import { describe, expect, test } from 'vitest';
import {
  canRestoreDiscoveryCandidate,
  getDiscoveryCandidateRestoreDisabledReason,
  isDiscoveryCandidateSelectableForBulk,
} from './commerce-admin-discovery-candidate-actions';

describe('commerce admin discovery candidate actions', () => {
  test.each(['ignored', 'non_set'] as const)(
    'allows restoring %s candidates',
    (status) => {
      expect(canRestoreDiscoveryCandidate({ status })).toBe(true);
      expect(
        getDiscoveryCandidateRestoreDisabledReason({
          candidate: { status },
          environmentIsReadOnly: false,
        }),
      ).toBeNull();
    },
  );

  test('does not allow restoring imported candidates', () => {
    expect(canRestoreDiscoveryCandidate({ status: 'imported' })).toBe(false);
    expect(
      getDiscoveryCandidateRestoreDisabledReason({
        candidate: { status: 'imported' },
        environmentIsReadOnly: false,
      }),
    ).toBe('imported candidates are immutable');
  });

  test('explains read-only restore blocking', () => {
    expect(
      getDiscoveryCandidateRestoreDisabledReason({
        candidate: { status: 'ignored' },
        environmentIsReadOnly: true,
      }),
    ).toBe('writable environment is not staging');
  });

  test.each(['new', 'failed', 'ignored', 'non_set'] as const)(
    'allows selecting %s candidates for bulk actions',
    (status) => {
      expect(isDiscoveryCandidateSelectableForBulk({ status })).toBe(true);
    },
  );

  test.each(['imported', 'onboarding_started', 'processing'] as const)(
    'keeps %s candidates out of bulk selection',
    (status) => {
      expect(isDiscoveryCandidateSelectableForBulk({ status })).toBe(false);
    },
  );
});
