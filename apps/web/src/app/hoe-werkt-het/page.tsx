import { getMetadataFromSeoFields } from '../lib/editorial-metadata';
import styles from './page.module.css';
import { HowItWorksPageView } from './how-it-works-page-view';
import { MarkerList, Panel, SectionHeading } from '@lego-platform/shared/ui';
import { ShellWeb } from '@lego-platform/shell/web';

export const revalidate = 300;

const coreSteps = [
  {
    id: 'choose',
    label: 'Stap 1',
    title: 'Kies je set',
    body: 'Begin bij sets die je echt wilt blijven bekijken. Rivendell, een supercar of Hogwarts: eerst wat je op je plank wilt zien.',
  },
  {
    id: 'understand-price',
    label: 'Stap 2',
    title: 'Begrijp de prijs',
    body: 'We tonen nagekeken prijzen uit echte aanbiedingen. "Onder normaal" betekent onder wat we voor die set meestal zien, niet onder een verzonnen korting.',
  },
  {
    id: 'buy-or-follow',
    label: 'Stap 3',
    title: 'Koop of volg',
    body: 'Klopt de prijs? Open de set en ga naar de winkel. Nog niet? Bewaar de set of volg de prijs en wacht op een beter moment.',
  },
] as const;

const pricingChecks = [
  {
    id: 'real-offers',
    title: 'Echte aanbiedingen',
    body: 'Gebaseerd op winkelprijzen die we echt voor die set hebben gezien.',
  },
  {
    id: 'multi-store',
    title: 'Meerdere winkels',
    body: 'Als er voor die set meer winkels zijn, nemen we die mee in de check.',
  },
  {
    id: 'under-normal',
    title: '"Onder normaal"',
    body: 'Dat vergelijken we met wat we meestal zagen voor die set. Niet met een nep-van-prijs.',
  },
  {
    id: 'checked-again',
    title: 'Opnieuw nagekeken',
    body: 'De prijscontext verschuift mee zodra we nieuwere checks hebben.',
  },
  {
    id: 'stay-quiet',
    title: 'Geen prijs? Dan geen verhaal',
    body: 'Als we geen bruikbare prijscontext hebben, blijven we stil.',
  },
] as const;

const whyBrickhuntItems = [
  'Geen ruis. Eerst de sets die er echt toe doen.',
  'Sneller zien of een prijs nu opvalt.',
  'Kopen als het klopt, volgen als wachten slimmer is.',
  'Geen nep-kortingen om je over de streep te trekken.',
] as const;

const heroPills = ['Kies je set', 'Begrijp de prijs', 'Koop of volg'] as const;

export const metadata = getMetadataFromSeoFields({
  title: 'Hoe Brickhunt werkt',
  description:
    'Lees hoe Brickhunt je helpt sneller een LEGO set te kiezen, nagekeken prijzen te begrijpen en slimmer te kopen.',
});

export default function HowItWorksPage() {
  return (
    <ShellWeb>
      <HowItWorksPageView />
      <div className={styles.page}>
        <Panel
          as="section"
          className={styles.heroCard}
          elevation="floating"
          padding="lg"
          tone="accent"
        >
          <div className={styles.heroLayout}>
            <div className={styles.heroCopy}>
              <SectionHeading
                className={styles.sectionHeader}
                description="Kies eerst welke set je wilt. Zie daarna wanneer de prijs interessant is. Brickhunt helpt je beide sneller te zien."
                eyebrow="Hoe Brickhunt werkt"
                title="Sneller kiezen. Slimmer kopen."
                titleAs="h1"
                tone="display"
              />
              <ul className={styles.heroPillRow}>
                {heroPills.map((heroPill) => (
                  <li className={styles.heroPill} key={heroPill}>
                    {heroPill}
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden="true" className={styles.heroBuildVisual}>
              <span
                className={`${styles.heroBrick} ${styles.heroBrickShort}`}
              />
              <span className={`${styles.heroBrick} ${styles.heroBrickTall}`} />
              <span
                className={`${styles.heroBrick} ${styles.heroBrickMedium}`}
              />
            </div>
          </div>
        </Panel>

        <Panel
          as="section"
          className={styles.stepSection}
          description="Eerst kiezen. Dan prijs begrijpen. Dan kopen of volgen."
          eyebrow="In drie stappen"
          elevation="floating"
          headingClassName={styles.sectionHeader}
          padding="lg"
          title="Zo werkt Brickhunt"
          tone="default"
        >
          <ol className={styles.stepGrid}>
            {coreSteps.map((step, index) => (
              <li className={styles.stepItem} key={step.id}>
                <Panel
                  as="article"
                  className={styles.stepCard}
                  elevation="rested"
                  spacing="compact"
                  tone="default"
                >
                  <div className={styles.stepCardTop}>
                    <span aria-hidden="true" className={styles.stepNumber}>
                      {index + 1}
                    </span>
                    <div className={styles.stepHeading}>
                      <p className={styles.stepLabel}>{step.label}</p>
                      <h3 className={styles.cardTitle}>{step.title}</h3>
                    </div>
                  </div>
                  <p className={styles.cardBody}>{step.body}</p>
                </Panel>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          as="section"
          className={styles.priceSection}
          description="Alleen prijscontext die we echt kunnen onderbouwen."
          eyebrow="Prijsuitleg"
          elevation="rested"
          headingClassName={styles.sectionHeader}
          padding="lg"
          title='Wat betekent "nagekeken prijs"?'
          tone="default"
        >
          <ul className={styles.checkGrid}>
            {pricingChecks.map((pricingCheck) => (
              <li className={styles.checkItem} key={pricingCheck.id}>
                <Panel
                  as="article"
                  className={styles.checkCard}
                  elevation="rested"
                  spacing="compact"
                  tone="default"
                >
                  <p className={styles.cardEyebrow}>Nagekeken prijs</p>
                  <h3 className={styles.cardTitle}>{pricingCheck.title}</h3>
                  <p className={styles.cardBody}>{pricingCheck.body}</p>
                </Panel>
              </li>
            ))}
          </ul>
        </Panel>

        <div className={styles.closingGrid}>
          <Panel
            as="section"
            className={styles.whyCard}
            description="Kort, bruikbaar en zonder nep-kortingen."
            eyebrow="Waarom Brickhunt"
            elevation="rested"
            headingClassName={styles.sectionHeader}
            title="Waarom eerst hier kijken"
            tone="accent"
          >
            <MarkerList
              className={styles.whyList}
              items={whyBrickhuntItems.map((whyBrickhuntItem) => ({
                content: whyBrickhuntItem,
                id: whyBrickhuntItem,
              }))}
            />
          </Panel>

          <Panel
            as="section"
            className={styles.transparencyCard}
            description="Rustig en duidelijk. Zonder kleine lettertjes."
            eyebrow="Transparantie"
            elevation="rested"
            headingClassName={styles.sectionHeader}
            title="Als je doorklikt naar een winkel"
            tone="default"
          >
            <div className={styles.transparencyBody}>
              <p className={styles.transparencyCopy}>
                Als je via Brickhunt doorklikt naar bol of een andere winkel,
                kunnen wij een kleine commissie krijgen. Dit verandert niets aan
                de prijs die jij betaalt.
              </p>
              <p className={styles.transparencyCopy}>
                Wat je op Brickhunt ziet, blijft draaien om de set en de
                prijscontext die we hebben nagekeken. Als die context ontbreekt,
                verzinnen we niets.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </ShellWeb>
  );
}
