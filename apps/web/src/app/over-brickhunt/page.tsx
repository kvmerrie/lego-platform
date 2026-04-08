import { getMetadataFromSeoFields } from '../lib/editorial-metadata';
import styles from './page.module.css';
import {
  ActionLink,
  MarkerList,
  Panel,
  SectionHeading,
} from '@lego-platform/shared/ui';
import { ShellWeb } from '@lego-platform/shell/web';

export const revalidate = 300;

const valueItems = [
  'Eerst kiezen welke set je echt wilt hebben.',
  'Daarna begrijpen of de prijs opvalt of normaal is.',
  'Volgen als wachten slimmer is dan kopen.',
] as const;

const restraintItems = [
  'Geen couponcodes of cashback.',
  'Geen nep-kortingen of schreeuwlabels.',
  'Geen prijsverhaal als de context te dun is.',
] as const;

export const metadata = getMetadataFromSeoFields({
  title: 'Over Brickhunt',
  description:
    'Lees waar Brickhunt voor is, voor wie het gebouwd is en hoe we eerlijk omgaan met prijscontext en affiliate links.',
});

export default function AboutBrickhuntPage() {
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
            description="LEGO begon hier als jeugdhobby. Jaren later kwam het terug. Alleen nu met sets van honderden euro's en de vraag: is dit eigenlijk een goed moment om te kopen?"
            eyebrow="Over Brickhunt"
            title="Gebouwd om beter te kiezen"
            titleAs="h1"
            tone="display"
          />
        </Panel>

        <div className={styles.panelGrid}>
          <Panel
            as="section"
            className={styles.infoCard}
            description="Van jeugdhobby naar volwassen verzameling."
            eyebrow="Hoe het begon"
            title="LEGO kwam terug, alleen nu met echte prijzen"
            tone="default"
          >
            <div className={styles.copyStack}>
              <p className={styles.copy}>
                LEGO was hier eerst iets uit mijn jeugd. Later kwam het terug
                met Rivendell, grote auto&apos;s, kastelen en sets waar je echt
                plek en budget voor vrijmaakt.
              </p>
              <p className={styles.copy}>
                Juist dan wil je beter kunnen kiezen. Niet alleen welke set je
                wilt hebben, maar ook of dit het moment is om te kopen of om nog
                even te wachten.
              </p>
            </div>
          </Panel>

          <Panel
            as="section"
            className={styles.infoCard}
            description="LEGO en software op dezelfde plank."
            eyebrow="Achter Brickhunt"
            title="Kasper van Merrienboer"
            tone="muted"
          >
            <div className={styles.copyStack}>
              <p className={styles.copy}>
                Ik werk al ongeveer 20 jaar in softwareontwikkeling en bouwde
                eerder voor onder meer Essent, Nederlandse Spoorwegen en
                consultancybedrijf Incentro.
              </p>
              <p className={styles.copy}>
                Brickhunt brengt die achtergrond samen met LEGO: minder ruis,
                eerlijkere prijscontext en sneller zien welke set de moeite
                waard is.
              </p>
              <p className={styles.copy}>
                Brickhunt houd ik bewust klein en scherp: iets dat ik zelf
                gebruik en stap voor stap beter wil maken.
              </p>
            </div>
            <p className={styles.contactLine}>
              <span>Contact:</span>{' '}
              <ActionLink href="mailto:hello@brickhunt.nl" tone="inline">
                hello@brickhunt.nl
              </ActionLink>
            </p>
          </Panel>
        </div>

        <div className={styles.panelGrid}>
          <Panel
            as="section"
            className={styles.infoCard}
            description="Eerst de set. Dan de prijs. Dan pas de winkel."
            eyebrow="Waar Brickhunt voor is"
            title="Wat je hier wél krijgt"
            tone="default"
          >
            <MarkerList
              className={styles.list}
              items={valueItems.map((valueItem) => ({
                content: valueItem,
                id: valueItem,
              }))}
            />
          </Panel>

          <Panel
            as="section"
            className={styles.infoCard}
            description="We laten liever minder zien dan iets verzinnen."
            eyebrow="Waar we stil blijven"
            title="Wat Brickhunt bewust niet doet"
            tone="muted"
          >
            <MarkerList
              className={styles.list}
              items={restraintItems.map((restraintItem) => ({
                content: restraintItem,
                id: restraintItem,
              }))}
            />
          </Panel>
        </div>

        <Panel
          as="section"
          className={styles.transparencyCard}
          description="Rustig, duidelijk en zonder kleine lettertjes."
          eyebrow="Transparantie"
          title="Als je doorklikt naar een winkel"
          tone="default"
        >
          <div className={styles.transparencyBody}>
            <p className={styles.copy}>
              Als je via Brickhunt doorklikt naar bol of een andere winkel,
              kunnen wij een kleine commissie ontvangen. Dit verandert niets aan
              de prijs die jij betaalt.
            </p>
            <p className={styles.copy}>
              Brickhunt is geen kortingssite. De set en de prijscontext staan
              voorop. Daarom laten we liever minder zien dan een dun
              prijsverhaal optuigen.
            </p>
            <p className={styles.linkRow}>
              <span>Wil je zien hoe we prijzen bekijken?</span>{' '}
              <ActionLink href="/hoe-werkt-het" tone="inline">
                Hoe Brickhunt werkt
              </ActionLink>
            </p>
          </div>
        </Panel>
      </div>
    </ShellWeb>
  );
}
