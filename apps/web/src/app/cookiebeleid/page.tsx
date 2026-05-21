import { getMetadataFromSeoFields } from '../lib/editorial-metadata';
import styles from '../over-brickhunt/page.module.css';
import { platformConfig } from '@lego-platform/shared/config';
import {
  ActionLink,
  MarkerList,
  Panel,
  SectionHeading,
} from '@lego-platform/shared/ui';
import { ShellWeb } from '@lego-platform/shell/web';

export const revalidate = 86_400;

const cookieItems = [
  'Noodzakelijke cookies of opslag kunnen nodig zijn voor login, sessie en basisfuncties.',
  'We kunnen anonieme of beperkte metingen gebruiken om te zien welke pagina technisch goed werkt.',
  'Affiliate links kunnen door winkelpartners worden gemeten nadat je naar een winkel doorklikt.',
  'We plaatsen geen cookies om LEGO-interesse buiten Brickhunt uitgebreid te profileren.',
] as const;

export const metadata = getMetadataFromSeoFields(
  {
    title: 'Cookiebeleid',
    description:
      'Lees hoe Brickhunt cookies en vergelijkbare technieken gebruikt voor basisfuncties, metingen en affiliate links.',
  },
  {
    canonicalPath: '/cookiebeleid',
  },
);

export default function CookiePolicyPage() {
  return (
    <ShellWeb>
      <div className={styles.page}>
        <Panel
          as="section"
          className={styles.heroCard}
          padding="lg"
          tone="accent"
        >
          <SectionHeading
            description="Cookies moeten de site laten werken, niet in de weg zitten terwijl je sets vergelijkt."
            eyebrow="Cookies"
            title="Cookiebeleid"
            titleAs="h1"
            tone="display"
          />
        </Panel>

        <Panel
          as="section"
          className={styles.infoCard}
          description="Welke technieken je kunt tegenkomen."
          eyebrow="Gebruik"
          title="Waar cookies voor dienen"
          tone="default"
        >
          <MarkerList
            className={styles.list}
            items={cookieItems.map((cookieItem) => ({
              content: cookieItem,
              id: cookieItem,
            }))}
          />
        </Panel>

        <Panel
          as="section"
          className={styles.infoCard}
          description="Vragen over cookies of tracking."
          eyebrow="Contact"
          title="Mail ons gerust"
          tone="muted"
        >
          <p className={styles.copy}>
            Vragen over cookies? Mail naar{' '}
            <ActionLink
              href={`mailto:${platformConfig.supportEmail}`}
              tone="inline"
            >
              {platformConfig.supportEmail}
            </ActionLink>
            .
          </p>
        </Panel>
      </div>
    </ShellWeb>
  );
}
