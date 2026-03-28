import { AuthSummary, UserProfile } from '@lego-platform/user/util';

const authSummary: AuthSummary = {
  state: 'authenticated',
  message: 'Signed in as a returning collector.',
  nextAction: 'Review watchlist activity',
};

const userProfile: UserProfile = {
  name: 'Alex Rivera',
  tier: 'Founding Collector',
  location: 'Amsterdam',
  collectionFocus: 'Premium display sets and licensed flagships',
};

export function getAuthSummary(): AuthSummary {
  return authSummary;
}

export function getUserProfile(): UserProfile {
  return userProfile;
}
