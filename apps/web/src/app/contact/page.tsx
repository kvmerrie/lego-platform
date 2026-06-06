import { getMetadataFromSeoFields } from '../lib/editorial-metadata';
import styles from '../over-brickhunt/page.module.css';
import { ActionLink, Panel, SectionHeading } from '@lego-platform/shared/ui';
import { platformConfig } from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';

export const revalidate = 86_400;

export const metadata = getMetadataFromSeoFields(
  {
    title: 'Contact met Brickhunt',
    description:
      'Neem contact op met Brickhunt over LEGO sets, prijzen, affiliate links of samenwerking.',
  },
  {
    canonicalPath: '/contact',
  },
);

export default function ContactPage() {
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
            description="Vraag over een set, prijs of samenwerking? Stuur gerust een bericht."
            title="Mail Brickhunt"
            titleAs="h1"
            tone="display"
          />
        </Panel>

        <Panel
          as="section"
          className={styles.infoCard}
          description="We lezen alles, maar Brickhunt blijft een klein project. Een inhoudelijk bericht werkt het best."
          title="hello@brickhunt.nl"
          tone="default"
        >
          <div className={styles.copyStack}>
            <p className={styles.copy}>
              Mail naar{' '}
              <ActionLink
                href={`mailto:${platformConfig.supportEmail}`}
                tone="inline"
              >
                {platformConfig.supportEmail}
              </ActionLink>
              . Gebruik dit adres voor vragen over Brickhunt, foutieve
              prijsinformatie, affiliate links of samenwerking.
            </p>
            <p className={styles.copy}>
              Zet er bij een setvraag het setnummer bij. Dan kunnen we sneller
              zien welke doos, winkel of prijscheck je bedoelt.
            </p>
          </div>
        </Panel>
      </div>
    </ShellWeb>
  );
}
