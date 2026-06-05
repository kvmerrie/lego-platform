import type {
  CommerceAdminCatalogDiscoveryCandidate,
  CommerceAdminCatalogDiscoveryCandidateStatus,
} from './commerce-admin-api.service';

type DiscoveryCandidateActionState = Pick<
  CommerceAdminCatalogDiscoveryCandidate,
  'status'
>;

export function canRestoreDiscoveryCandidate(
  candidate: DiscoveryCandidateActionState,
): boolean {
  return candidate.status === 'ignored' || candidate.status === 'non_set';
}

export function getDiscoveryCandidateRestoreDisabledReason({
  candidate,
  environmentIsReadOnly,
}: {
  candidate: DiscoveryCandidateActionState;
  environmentIsReadOnly: boolean;
}): string | null {
  if (environmentIsReadOnly) {
    return 'writable environment is not staging';
  }

  if (!canRestoreDiscoveryCandidate(candidate)) {
    return candidate.status === 'imported'
      ? 'imported candidates are immutable'
      : `status is ${candidate.status}`;
  }

  return null;
}

export function isDiscoveryCandidateSelectableForBulk(
  candidate: DiscoveryCandidateActionState,
): boolean {
  return (
    candidate.status === 'new' ||
    candidate.status === 'failed' ||
    candidate.status === 'ignored' ||
    candidate.status === 'non_set'
  );
}

export function isDiscoveryCandidateStatusRestorable(
  status: CommerceAdminCatalogDiscoveryCandidateStatus,
): boolean {
  return status === 'ignored' || status === 'non_set';
}
