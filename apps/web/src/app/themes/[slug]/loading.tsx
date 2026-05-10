import { ShellWeb } from '@lego-platform/shell/web';
import styles from './loading.module.css';

const skeletonCards = Array.from({ length: 12 }, (_, index) => index);

export default function ThemeDetailLoading() {
  return (
    <ShellWeb>
      <main
        aria-busy="true"
        aria-label="Themapagina laden"
        className={styles.page}
      >
        <section className={styles.hero} aria-hidden="true">
          <div className={styles.heroContent}>
            <div className={styles.breadcrumb} />
            <div className={styles.eyebrow} />
            <div className={styles.title} />
            <div className={styles.descriptionStack}>
              <div className={styles.lead} />
              <div className={styles.leadShort} />
            </div>
            <div className={styles.support} />
            <div className={styles.actions}>
              <div className={styles.primaryAction} />
              <div className={styles.secondaryAction} />
              <div className={styles.countChip} />
            </div>
          </div>
          <div className={styles.heroMedia}>
            <div className={styles.heroImage} />
            <div className={styles.heroMediaMeta}>
              <div />
              <div />
            </div>
          </div>
        </section>

        <section className={styles.browse} aria-hidden="true">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow} />
            <div className={styles.sectionTitle} />
            <div className={styles.sectionMeta} />
          </div>
          <div className={styles.grid}>
            {skeletonCards.map((item) => (
              <article className={styles.card} key={item}>
                <div className={styles.cardImage} />
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle} />
                  <div className={styles.cardMeta} />
                  <div className={styles.cardFooter} />
                </div>
              </article>
            ))}
          </div>
          <div className={styles.pagination}>
            <div />
            <div />
            <div />
          </div>
        </section>
      </main>
    </ShellWeb>
  );
}
