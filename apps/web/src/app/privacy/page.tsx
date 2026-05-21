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

const privacyItems = [
  'We verwerken gegevens die nodig zijn om Brickhunt te laten werken, zoals accountgegevens wanneer je inlogt.',
  'Als je sets bewaart of volgt, slaan we die lijst op zodat je hem later terugziet.',
  'We gebruiken technische logs om fouten en misbruik te onderzoeken.',
  'We verkopen geen persoonsgegevens.',
] as const;

export const metadata = getMetadataFromSeoFields(
  {
    title: 'Privacybeleid',
    description:
      'Lees welke gegevens Brickhunt gebruikt om LEGO sets, lijsten en prijschecks goed te laten werken.',
  },
  {
    canonicalPath: '/privacy',
  },
);

export default function PrivacyPage() {
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
            description="Kort en feitelijk: we verzamelen alleen wat nodig is om Brickhunt bruikbaar en veilig te houden."
            eyebrow="Privacy"
            title="Privacybeleid"
            titleAs="h1"
            tone="display"
          />
        </Panel>

        <Panel
          as="section"
          className={styles.infoCard}
          description="Wat Brickhunt met gegevens doet."
          eyebrow="Gegevens"
          title="Wat we gebruiken"
          tone="default"
        >
          <MarkerList
            className={styles.list}
            items={privacyItems.map((privacyItem) => ({
              content: privacyItem,
              id: privacyItem,
            }))}
          />
        </Panel>

        <Panel
          as="section"
          className={styles.infoCard}
          description="Voor vragen of correcties."
          eyebrow="Contact"
          title="Je kunt ons mailen"
          tone="muted"
        >
          <p className={styles.copy}>
            Wil je iets vragen over privacy of je gegevens? Mail naar{' '}
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
