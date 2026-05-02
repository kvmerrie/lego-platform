'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import styles from './content-article-ui.module.css';

export type ContentArticleFaqItem = {
  answer: string;
  question: string;
};

export function ContentArticleFaq({
  items,
  title,
}: {
  items: readonly ContentArticleFaqItem[];
  title: string;
}) {
  const accordionId = useId();
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);

  if (!items.length) {
    return null;
  }

  const toggleIndex = (targetIndex: number) => {
    setOpenIndexes((currentIndexes) =>
      currentIndexes.includes(targetIndex)
        ? currentIndexes.filter((index) => index !== targetIndex)
        : [...currentIndexes, targetIndex],
    );
  };

  return (
    <section
      aria-label={title}
      className={styles.faqBlock}
      data-article-layout="faq-block"
      data-article-module="faq"
    >
      <div className={styles.faqSection}>
        <h2 className={styles.faqTitle}>{title}</h2>
        <div className={styles.faqList}>
          {items.map((item, itemIndex) => {
            const panelId = `${accordionId}-panel-${itemIndex}`;
            const triggerId = `${accordionId}-trigger-${itemIndex}`;
            const isOpen = openIndexes.includes(itemIndex);

            return (
              <div
                className={styles.faqItem}
                key={`${item.question}-${itemIndex}`}
              >
                <h3 className={styles.faqItemHeading}>
                  <button
                    aria-controls={panelId}
                    aria-expanded={isOpen}
                    className={styles.faqButton}
                    id={triggerId}
                    onClick={() => toggleIndex(itemIndex)}
                    type="button"
                  >
                    <span className={styles.faqQuestion}>{item.question}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={styles.faqChevron}
                      data-open={isOpen ? 'true' : 'false'}
                      size={20}
                    />
                  </button>
                </h3>
                <div
                  aria-labelledby={triggerId}
                  className={styles.faqPanel}
                  hidden={!isOpen}
                  id={panelId}
                  role="region"
                >
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
