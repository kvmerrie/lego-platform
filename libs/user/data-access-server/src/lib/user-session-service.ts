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
  getUserSession(requestPrincipal: RequestPrincipal): Promise<UserSession>;
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
  requestPrincipal,
  userProfileRepository,
  userSetStatusRepository,
}: {
  requestPrincipal: AuthenticatedRequestPrincipal;
  userProfileRepository: UserProfileRepository;
  userSetStatusRepository: UserSetStatusRepository;
}): Promise<UserSession> {
  const [userProfileRecord, userSetStatusRecords] = await Promise.all([
    userProfileRepository.ensureProfile({
      email: requestPrincipal.email,
      userId: requestPrincipal.userId,
    }),
    userSetStatusRepository.listByUserId(requestPrincipal.userId),
  ]);
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

  return {
    state: 'authenticated',
    account: {
      userId: requestPrincipal.userId,
      email: requestPrincipal.email,
    },
    collector: toCollectorIdentity(userProfileRecord),
    notificationPreferences: {
      wishlistDealAlerts: userProfileRecord.wishlistDealAlerts,
    },
    ownedSetIds,
    setStates: listUserSetStates({
      ownedSetIds,
      setStateTimingBySetId,
      wantedSetIds,
    }),
    wantedSetIds,
  };
}

export function createUserSessionService({
  userProfileRepository = createUserProfileRepository(),
  userSetStatusRepository = createUserSetStatusRepository(),
}: {
  userProfileRepository?: UserProfileRepository;
  userSetStatusRepository?: UserSetStatusRepository;
} = {}): UserSessionService {
  return {
    async getUserSession(requestPrincipal: RequestPrincipal) {
      if (requestPrincipal.state === 'anonymous') {
        return createAnonymousUserSession();
      }

      return buildAuthenticatedUserSession({
        requestPrincipal,
        userProfileRepository,
        userSetStatusRepository,
      });
    },
  };
}
