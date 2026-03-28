export interface AuthSummary {
  state: 'authenticated' | 'anonymous';
  message: string;
  nextAction: string;
}

export interface UserProfile {
  name: string;
  tier: string;
  location: string;
  collectionFocus: string;
}

export function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
