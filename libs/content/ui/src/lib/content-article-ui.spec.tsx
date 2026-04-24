import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ContentArticleCard,
  ContentArticlePage,
  ContentArticleRail,
} from './content-article-ui';

describe('content article ui', () => {
  it('renders an article card with image, date and theme badge', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleCard
        contentArticle={{
          cardImage: '/articles/star-wars-day-2026/hero.jpg',
          cardImageAlt: 'Star Wars hero',
          date: '2026-04-24',
          description: 'Waar wil je nu op letten?',
          heroImage: '/articles/star-wars-day-2026/hero.jpg',
          heroImageAlt: 'Star Wars hero',
          slug: 'star-wars-day-2026',
          status: 'published',
          theme: 'Star Wars',
          title: 'Star Wars Day 2026',
        }}
      />,
    );

    expect(markup).toContain('/artikelen/star-wars-day-2026');
    expect(markup).toContain('/articles/star-wars-day-2026/hero.jpg');
    expect(markup).toContain('Star Wars Day 2026');
    expect(markup).toContain('Waar wil je nu op letten?');
    expect(markup).toContain('Star Wars');
  });

  it('renders a graceful fallback when an article image is missing', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleCard
        contentArticle={{
          cardImageAlt: 'Fallback hero',
          date: '2026-04-24',
          description: 'Waar wil je nu op letten?',
          heroImageAlt: 'Fallback hero',
          slug: 'star-wars-day-2026',
          status: 'published',
          theme: 'Star Wars',
          title: 'Star Wars Day 2026',
        }}
      />,
    );

    expect(markup).toContain('Beeld volgt nog. De inhoud staat al klaar.');
    expect(markup).not.toContain('<img');
  });

  it('renders an article rail with a max item cap and article page shell', () => {
    const railMarkup = renderToStaticMarkup(
      <ContentArticleRail
        contentArticles={[
          {
            cardImageAlt: 'One',
            date: '2026-04-24',
            description: 'Een',
            heroImageAlt: 'One',
            slug: 'one',
            status: 'published',
            title: 'One',
          },
          {
            cardImageAlt: 'Two',
            date: '2026-04-23',
            description: 'Twee',
            heroImageAlt: 'Two',
            slug: 'two',
            status: 'published',
            title: 'Two',
          },
        ]}
        maxItems={1}
        subtitle="Pak hier de nieuwste gidsen mee."
        title="Nu lezen"
      />,
    );
    const pageMarkup = renderToStaticMarkup(
      <ContentArticlePage
        body={
          <div>
            <h2>Koopadvies</h2>
            <p>Pak de set die je plank verandert.</p>
          </div>
        }
        contentArticle={{
          bodySource: '## Koopadvies',
          cardImageAlt: 'Star Wars hero',
          date: '2026-04-24',
          description: 'Waar wil je nu op letten?',
          heroImageAlt: 'Star Wars hero',
          slug: 'star-wars-day-2026',
          status: 'published',
          theme: 'Star Wars',
          title: 'Star Wars Day 2026',
        }}
      />,
    );

    expect(railMarkup).toContain('Nu lezen');
    expect(railMarkup).toContain('One');
    expect(railMarkup).not.toContain('Two');
    expect(pageMarkup).toContain('Terug naar artikelen');
    expect(pageMarkup).toContain('Star Wars Day 2026');
    expect(pageMarkup).toContain('Koopadvies');
  });
});
