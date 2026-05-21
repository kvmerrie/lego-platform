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

const affiliateItems = [
  'Sommige winkelknoppen en prijslinks zijn affiliate links.',
  "Als je via zo'n link iets koopt, kan Brickhunt een commissie ontvangen.",
  'Die commissie kost jou niets extra.',
  'Prijscontext en winkelvermelding mogen niet afhankelijk zijn van een hogere commissie.',
] as const;

export const metadata = getMetadataFromSeoFields(
  {
    title: 'Affiliate disclosure',
    description:
      'Lees hoe Brickhunt omgaat met affiliate links en mogelijke commissies bij LEGO winkelverwijzingen.',
  },
  {
    canonicalPath: '/affiliate-disclosure',
  },
);

export default function AffiliateDisclosurePage() {
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
            description="Brickhunt kan commissie ontvangen via sommige winkelknoppen. Jij betaalt daardoor niets extra."
            eyebrow="Transparantie"
            title="Affiliate disclosure"
            titleAs="h1"
            tone="display"
          />
        </Panel>

        <Panel
          as="section"
          className={styles.infoCard}
          description="Wat er gebeurt als je doorklikt naar een winkel."
          eyebrow="Affiliate links"
          title="Sommige links kunnen commissie opleveren"
          tone="default"
        >
          <MarkerList
            className={styles.list}
            items={affiliateItems.map((affiliateItem) => ({
              content: affiliateItem,
              id: affiliateItem,
            }))}
          />
        </Panel>

        <Panel
          as="section"
          className={styles.infoCard}
          description="Eerlijke prijscontext blijft belangrijker dan veel knoppen."
          eyebrow="Uitgangspunt"
          title="De set en de prijs blijven voorop"
          tone="muted"
        >
          <p className={styles.copy}>
            Brickhunt wil vooral helpen kiezen: welke LEGO set past bij je
            verzameling, en of de prijs op dit moment logisch is. Klopt er iets
            niet aan een link of prijs? Mail naar{' '}
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
