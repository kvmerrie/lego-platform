import type { OwnedSetState } from '@lego-platform/collection/util';
import { phaseOneCollectorIdentity } from '@lego-platform/user/util';
import type { UserSession } from '@lego-platform/user/util';
import type { WantedSetState } from '@lego-platform/wishlist/util';

function createDefaultOwnedSetIds(): Set<string> {
  return new Set(['10316']);
}

function createDefaultWantedSetIds(): Set<string> {
  return new Set(['21348']);
}

let ownedSetIds = createDefaultOwnedSetIds();
let wantedSetIds = createDefaultWantedSetIds();

export function resetPhaseOneUserStore() {
  ownedSetIds = createDefaultOwnedSetIds();
  wantedSetIds = createDefaultWantedSetIds();
}

export function getPhaseOneUserSession(): UserSession {
  return {
    state: 'authenticated',
    collector: phaseOneCollectorIdentity,
    ownedSetIds: [...ownedSetIds].sort(),
    wantedSetIds: [...wantedSetIds].sort(),
  };
}

export function addOwnedSet(setId: string): OwnedSetState {
  ownedSetIds.add(setId);

  return {
    setId,
    isOwned: true,
  };
}

export function removeOwnedSet(setId: string): OwnedSetState {
  ownedSetIds.delete(setId);

  return {
    setId,
    isOwned: false,
  };
}

export function addWantedSet(setId: string): WantedSetState {
  wantedSetIds.add(setId);

  return {
    setId,
    isWanted: true,
  };
}

export function removeWantedSet(setId: string): WantedSetState {
  wantedSetIds.delete(setId);

  return {
    setId,
    isWanted: false,
  };
}
