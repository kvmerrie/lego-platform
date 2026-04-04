import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  UserProfileEditorCard,
  UserSessionCard,
  UserShellAccountStatusCard,
} from './user-ui';

describe('UserShellAccountStatusCard', () => {
  it('renders a clear signed-out collector status surface for the shell', () => {
    const markup = renderToStaticMarkup(
      <UserShellAccountStatusCard
        isAuthAvailable
        userSession={{
          state: 'anonymous',
          ownedSetIds: [],
          setStates: [],
          wantedSetIds: [],
        }}
      />,
    );

    expect(markup).toContain('Log in om sets op te slaan');
    expect(markup).toContain(
      'Log in met e-mail en wachtwoord of met Google om je collectie, verlanglijst en verzamelaarsgegevens op een plek te bewaren.',
    );
    expect(markup).toContain('Log in om prive op te slaan');
    expect(markup).toContain('Open verlanglijst');
    expect(markup).toContain('uitgelogd');
  });

  it('renders a signed-in collector summary with collection and wishlist access', () => {
    const markup = renderToStaticMarkup(
      <UserShellAccountStatusCard
        userSession={{
          state: 'authenticated',
          account: {
            userId: 'collector-1',
            email: 'collector@example.com',
          },
          collector: {
            id: 'brick-curator',
            name: 'Alex Rivera',
            tier: 'Founding Collector',
            location: 'Amsterdam',
            collectionFocus: 'Display-scale fantasy and castle icons',
          },
          notificationPreferences: {
            wishlistDealAlerts: true,
          },
          ownedSetIds: ['10316', '10305'],
          setStates: [
            {
              setId: '10305',
              state: 'owned',
            },
            {
              setId: '10316',
              state: 'owned',
            },
            {
              setId: '21348',
              state: 'wishlist',
            },
          ],
          wantedSetIds: ['21348'],
        }}
      />,
    );

    expect(markup).toContain('Alex Rivera');
    expect(markup).toContain('@brick-curator');
    expect(markup).toContain('2 in collectie opgeslagen');
    expect(markup).toContain('1 op verlanglijst opgeslagen');
    expect(markup).toContain('Open collectie (2)');
    expect(markup).toContain('Open verlanglijst (1)');
    expect(markup).toContain('Uitloggen');
    expect(markup).toContain(
      'Je opgeslagen sets en verzamelaarsgegevens zijn een klik verwijderd.',
    );
    expect(markup).toContain('Ingelogd · Founding Collector');
  });
});

describe('UserSessionCard', () => {
  it('renders email and password auth as the primary signed-out account flow', () => {
    const markup = renderToStaticMarkup(
      <UserSessionCard
        authEmail="collector@example.com"
        authMode="sign-in"
        authPassword="super-secret"
        isAuthAvailable
        userSession={{
          state: 'anonymous',
          ownedSetIds: [],
          setStates: [],
          wantedSetIds: [],
        }}
      />,
    );

    expect(markup).toContain('Log in om je account te openen');
    expect(markup).toContain(
      'Log eerst in met e-mail en wachtwoord. Google is beschikbaar wanneer deze omgeving dat ondersteunt en de magic link blijft hier als terugvaloptie.',
    );
    expect(markup).toContain('E-mailadres');
    expect(markup).toContain('Wachtwoord');
    expect(markup).toContain('Doorgaan met Google');
    expect(markup).toContain('Account aanmaken');
    expect(markup).toContain('Wachtwoord vergeten?');
    expect(markup).toContain('Gebruik liever een magic link');
    expect(markup).toContain(
      'Inloggen ontgrendelt alleen je prive verzamelstatus.',
    );
  });

  it('renders a more productized signed-in collector account surface', () => {
    const markup = renderToStaticMarkup(
      <UserSessionCard
        userSession={{
          state: 'authenticated',
          account: {
            userId: 'collector-1',
            email: 'collector@example.com',
          },
          collector: {
            id: 'brick-curator',
            name: 'Alex Rivera',
            tier: 'Founding Collector',
            location: 'Amsterdam',
            collectionFocus: 'Display-scale fantasy and castle icons',
          },
          notificationPreferences: {
            wishlistDealAlerts: true,
          },
          ownedSetIds: ['10316', '10305'],
          setStates: [
            {
              setId: '10305',
              state: 'owned',
            },
            {
              setId: '10316',
              state: 'owned',
            },
            {
              setId: '21348',
              state: 'wishlist',
            },
          ],
          wantedSetIds: ['21348'],
        }}
      />,
    );

    expect(markup).toContain('Je account');
    expect(markup).toContain('<h1');
    expect(markup).toContain(
      'Collectie, verlanglijst en accountgegevens op een plek.',
    );
    expect(markup).toContain('2 in collectie opgeslagen');
    expect(markup).toContain('1 op verlanglijst opgeslagen');
    expect(markup).toContain('Inlog-e-mail');
    expect(markup).toContain('Verzamelaarsnaam');
    expect(markup).toContain('Je opgeslagen sets');
    expect(markup).toContain('Open collectie (2)');
    expect(markup).toContain('Open verlanglijst (1)');
    expect(markup).toContain('Gebruikt voor inloggen en accountherstel.');
    expect(markup).toContain(
      'Je opgeslagen sets blijven prive. Setpagina&#x27;s en prijschecks blijven openbaar.',
    );
    expect(markup).toContain('Account · Founding Collector');
  });

  it('renders a password reset form inside the signed-in account view when recovery is active', () => {
    const markup = renderToStaticMarkup(
      <UserSessionCard
        isPasswordRecoveryMode
        passwordRecoveryConfirmation="new-password"
        passwordRecoveryValue="new-password"
        userSession={{
          state: 'authenticated',
          account: {
            userId: 'collector-1',
            email: 'collector@example.com',
          },
          collector: {
            id: 'brick-curator',
            name: 'Alex Rivera',
            tier: 'Founding Collector',
            location: 'Amsterdam',
            collectionFocus: 'Display-scale fantasy and castle icons',
          },
          notificationPreferences: {
            wishlistDealAlerts: true,
          },
          ownedSetIds: ['10316', '10305'],
          setStates: [
            {
              setId: '10305',
              state: 'owned',
            },
            {
              setId: '10316',
              state: 'owned',
            },
            {
              setId: '21348',
              state: 'wishlist',
            },
          ],
          wantedSetIds: ['21348'],
        }}
      />,
    );

    expect(markup).toContain('Rond je wachtwoordherstel af');
    expect(markup).toContain(
      'Kies een nieuw wachtwoord voor dit account. Je collectie en verlanglijst blijven behouden.',
    );
    expect(markup).toContain('Nieuw wachtwoord');
    expect(markup).toContain('Bevestig nieuw wachtwoord');
    expect(markup).toContain('Nieuw wachtwoord opslaan');
  });
});

describe('UserProfileEditorCard', () => {
  it('renders clearer supporting copy for the collector profile surface', () => {
    const markup = renderToStaticMarkup(
      <UserProfileEditorCard
        collectorProfile={{
          displayName: 'Alex Rivera',
          collectorHandle: 'alex-rivera',
          location: 'Amsterdam',
          collectionFocus: 'Display-scale fantasy and castle icons',
          tier: 'Founding Collector',
          email: 'collector@example.com',
          wishlistDealAlerts: true,
        }}
        draft={{
          displayName: 'Alex Rivera',
          collectorHandle: 'alex-rivera',
          location: 'Amsterdam',
          collectionFocus: 'Display-scale fantasy and castle icons',
          wishlistDealAlerts: true,
        }}
        onDraftChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toContain('Bewerk je verzamelaarsgegevens');
    expect(markup).toContain(
      'Werk de naam en gegevens bij die op je account en opgeslagen sets zichtbaar zijn.',
    );
    expect(markup).toContain('Zichtbaar op je account en opgeslagen sets.');
    expect(markup).toContain('Alleen letters, cijfers en koppeltekens.');
    expect(markup).toContain('Prive inlog-e-mail.');
    expect(markup).toContain('Zichtbaar in je verzamelaarsomgeving.');
    expect(markup).toContain(
      'Een korte zin over de sets en thema&#x27;s die je volgt.',
    );
    expect(markup).toContain(
      'Waarschuw me wanneer een set op mijn verlanglijst een betere deal wordt',
    );
    expect(markup).toContain(
      'Dit bewaart alleen je voorkeur voor toekomstige dealalerts op je verlanglijst.',
    );
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('checked=""');
  });
});
