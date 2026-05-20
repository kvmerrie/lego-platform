import type {
  AuthenticatedRequestPrincipal,
  RequestPrincipal,
} from '@lego-platform/shared/data-access-auth-server';
import {
  createAnonymousUserSession,
  listUserSetStates,
  type CollectorIdentity,
  type UserSession,
} from '@lego-platform/user/util';
import {
  createUserProfileRepository,
  type UserProfileRecord,
  type UserProfileRepository,
} from './profile-repository';
import {
  createUserSetStatusRepository,
  type UserSetStatusRecord,
  type UserSetStatusRepository,
} from './user-set-status-repository';

export interface UserSessionService {
  getUserSession(
    requestPrincipal: RequestPrincipal,
    options?: {
      onTiming?: (timing: UserSessionServiceTiming) => void;
    },
  ): Promise<UserSession>;
}

export interface UserSessionServiceTiming {
  profile_lookup_ms?: number;
  response_build_ms: number;
  set_status_lookup_ms?: number;
}

function nowMs(): number {
  return performance.now();
}

async function measureUserSessionStep<T>(
  callback: () => Promise<T>,
  onDuration: (durationMs: number) => void,
): Promise<T> {
  const startedAt = nowMs();

  try {
    return await callback();
  } finally {
    onDuration(Math.round(nowMs() - startedAt));
  }
}

function toCollectorIdentity(
  userProfileRecord: UserProfileRecord,
): CollectorIdentity {
  return {
    id: userProfileRecord.collectorHandle,
    name: userProfileRecord.displayName,
    tier: userProfileRecord.tier,
    location: userProfileRecord.location,
    collectionFocus: userProfileRecord.collectionFocus,
  };
}

function toOwnedSetIds(
  userSetStatusRecords: readonly UserSetStatusRecord[],
): string[] {
  return userSetStatusRecords
    .filter((userSetStatusRecord) => userSetStatusRecord.isOwned)
    .map((userSetStatusRecord) => userSetStatusRecord.setId);
}

function toWantedSetIds(
  userSetStatusRecords: readonly UserSetStatusRecord[],
): string[] {
  return userSetStatusRecords
    .filter(
      (userSetStatusRecord) =>
        userSetStatusRecord.isWanted && !userSetStatusRecord.isOwned,
    )
    .map((userSetStatusRecord) => userSetStatusRecord.setId);
}

export async function buildAuthenticatedUserSession({
  onTiming,
  requestPrincipal,
  userProfileRepository,
  userSetStatusRepository,
}: {
  onTiming?: (timing: UserSessionServiceTiming) => void;
  requestPrincipal: AuthenticatedRequestPrincipal;
  userProfileRepository: UserProfileRepository;
  userSetStatusRepository: UserSetStatusRepository;
}): Promise<UserSession> {
  let profileLookupMs = 0;
  let setStatusLookupMs = 0;
  const [userProfileRecord, userSetStatusRecords] = await Promise.all([
    measureUserSessionStep(
      () =>
        userProfileRepository.ensureProfile({
          email: requestPrincipal.email,
          userId: requestPrincipal.userId,
        }),
      (durationMs) => {
        profileLookupMs = durationMs;
      },
    ),
    measureUserSessionStep(
      () => userSetStatusRepository.listByUserId(requestPrincipal.userId),
      (durationMs) => {
        setStatusLookupMs = durationMs;
      },
    ),
  ]);
  const responseBuildStartedAt = nowMs();
  const ownedSetIds = toOwnedSetIds(userSetStatusRecords);
  const wantedSetIds = toWantedSetIds(userSetStatusRecords);
  const setStateTimingBySetId = Object.fromEntries(
    userSetStatusRecords.map((userSetStatusRecord) => [
      userSetStatusRecord.setId,
      {
        createdAt: userSetStatusRecord.createdAt,
        updatedAt: userSetStatusRecord.updatedAt,
      },
    ]),
  );

  const authenticatedSession: UserSession = {
    state: 'authenticated',
    account: {
      userId: requestPrincipal.userId,
      email: requestPrincipal.email,
    },
    collector: toCollectorIdentity(userProfileRecord),
    notificationPreferences: {
      wishlistDealAlerts: userProfileRecord.wishlistDealAlerts,
      wishlistAlertsLastViewedAt: userProfileRecord.wishlistAlertsLastViewedAt,
    },
    ownedSetIds,
    setStates: listUserSetStates({
      ownedSetIds,
      setStateTimingBySetId,
      wantedSetIds,
    }),
    wantedSetIds,
  };

  onTiming?.({
    profile_lookup_ms: profileLookupMs,
    response_build_ms: Math.round(nowMs() - responseBuildStartedAt),
    set_status_lookup_ms: setStatusLookupMs,
  });

  return authenticatedSession;
}

export function createUserSessionService({
  userProfileRepository = createUserProfileRepository(),
  userSetStatusRepository = createUserSetStatusRepository(),
}: {
  userProfileRepository?: UserProfileRepository;
  userSetStatusRepository?: UserSetStatusRepository;
} = {}): UserSessionService {
  return {
    async getUserSession(
      requestPrincipal: RequestPrincipal,
      options?: {
        onTiming?: (timing: UserSessionServiceTiming) => void;
      },
    ) {
      if (requestPrincipal.state === 'anonymous') {
        const responseBuildStartedAt = nowMs();
        const anonymousSession = createAnonymousUserSession();

        options?.onTiming?.({
          response_build_ms: Math.round(nowMs() - responseBuildStartedAt),
        });

        return anonymousSession;
      }

      return buildAuthenticatedUserSession({
        onTiming: options?.onTiming,
        requestPrincipal,
        userProfileRepository,
        userSetStatusRepository,
      });
    },
  };
}
