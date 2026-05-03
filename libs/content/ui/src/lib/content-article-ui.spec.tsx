/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentArticleFaq } from './content-article-faq';
import {
  ContentArticleCard,
  ContentArticleFeaturedCard,
  ContentArticleFeaturedSet,
  ContentArticleImageGallery,
  ContentArticlePage,
  ContentArticleRail,
  ContentArticleSetSpotlightList,
  ContentArticleSetRail,
} from './content-article-ui';

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

describe('content article ui', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = '';
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

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

  it('never renders Other as a public article theme badge', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleCard
        contentArticle={{
          cardImageAlt: 'Lewis Hamilton Helmet',
          date: '2026-05-03',
          description: 'Voor wie deze helm opvalt.',
          heroImageAlt: 'Lewis Hamilton Helmet',
          slug: 'lewis-hamilton-helmet',
          status: 'published',
          theme: 'Other',
          title: 'LEGO Lewis Hamilton Helmet onthuld',
        }}
      />,
    );

    expect(markup).not.toContain('Other');
    expect(markup).toContain('Artikel');
  });

  it('hides Other on FeaturedSet badges and facts', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleFeaturedSet
        ctaHref="/sets/lewis-hamilton-helmet-42244"
        imageAlt="Lewis Hamilton Helmet"
        name="Lewis Hamilton Helmet"
        setNumber="42244"
        theme="Other"
      />,
    );

    expect(markup).toContain('Set 42244');
    expect(markup).not.toContain('Other');
    expect(markup).not.toContain('Thema');
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

  it('tracks article card clicks with gtag without blocking navigation', () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    act(() => {
      root.render(
        <ContentArticleCard
          contentArticle={{
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
    });

    const link = container.querySelector(
      'a[href="/artikelen/star-wars-day-2026"]',
    );
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });

    expect(link?.dispatchEvent(clickEvent)).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(false);
    expect(gtag).toHaveBeenCalledWith('event', 'article_click', {
      slug: 'star-wars-day-2026',
      theme: 'Star Wars',
    });

    delete window.gtag;
  });

  it('renders a featured article card as one large clickable article', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleFeaturedCard
        contentArticle={{
          cardImage: '/articles/marvel/card.jpg',
          cardImageAlt: 'Marvel kaart',
          date: '2026-05-03',
          description: 'Waarom deze reveal blijft hangen.',
          heroImage: '/articles/marvel/hero.jpg',
          heroImageAlt: 'Marvel hero',
          slug: 'lego-marvel-herbie',
          status: 'published',
          theme: 'Marvel',
          title: 'LEGO Marvel H.E.R.B.I.E. onthuld',
        }}
      />,
    );

    expect(markup).toContain('/artikelen/lego-marvel-herbie');
    expect(markup).toContain('/articles/marvel/hero.jpg');
    expect(markup).toContain('data-article-image-kind="featured"');
    expect(markup).toContain('LEGO Marvel H.E.R.B.I.E. onthuld');
    expect(markup).toContain('Waarom deze reveal blijft hangen.');
    expect(markup).toContain('Marvel');
  });

  it('tracks featured article clicks with gtag', () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    act(() => {
      root.render(
        <ContentArticleFeaturedCard
          contentArticle={{
            cardImageAlt: 'Marvel kaart',
            date: '2026-05-03',
            description: 'Waarom deze reveal blijft hangen.',
            heroImageAlt: 'Marvel hero',
            slug: 'lego-marvel-herbie',
            status: 'published',
            theme: 'Marvel',
            title: 'LEGO Marvel H.E.R.B.I.E. onthuld',
          }}
        />,
      );
    });

    const link = container.querySelector(
      'a[href="/artikelen/lego-marvel-herbie"]',
    );
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });

    expect(link?.dispatchEvent(clickEvent)).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(false);
    expect(gtag).toHaveBeenCalledWith('event', 'article_click', {
      slug: 'lego-marvel-herbie',
      theme: 'Marvel',
    });

    delete window.gtag;
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
        breadcrumbs={[
          { href: '/artikelen', id: 'articles', label: 'Artikelen' },
          {
            href: '/themes/star-wars',
            id: 'theme-star-wars',
            label: 'Star Wars',
          },
          { id: 'article-star-wars-day-2026', label: 'Star Wars Day 2026' },
        ]}
        contentArticle={{
          bodySource: '## Koopadvies',
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
        relatedArticles={[
          {
            cardImageAlt: 'Nog een artikel',
            date: '2026-04-20',
            description: 'Nog iets om mee te pakken.',
            heroImageAlt: 'Nog een artikel',
            slug: 'star-wars-collector-guide',
            status: 'published',
            theme: 'Star Wars',
            title: 'Star Wars collector guide',
          },
        ]}
        themePresentation={{
          href: '/themes/star-wars',
          label: 'Star Wars',
          style: {
            '--article-theme-accent': '#5573b5',
            '--article-theme-surface': '#5573b5',
            '--article-theme-surface-text': '#ffffff',
            '--catalog-theme-badge-surface': '#5573b5',
            '--catalog-theme-badge-text': '#ffffff',
          },
          tone: 'dark',
        }}
      />,
    );

    expect(railMarkup).toContain('Nu lezen');
    expect(railMarkup).toContain('One');
    expect(railMarkup).not.toContain('Two');
    expect(pageMarkup).toContain('data-article-layout="shell"');
    expect(pageMarkup).toContain('data-article-layout="hero"');
    expect(pageMarkup).toContain('data-article-layout="body"');
    expect(pageMarkup).toContain('data-article-layout="prose"');
    expect(pageMarkup).toContain('data-article-theme="star-wars"');
    expect(pageMarkup).toContain('data-article-theme-tone="dark"');
    expect(pageMarkup).toContain('--article-theme-accent:#5573b5');
    expect(pageMarkup).toContain('--article-theme-surface:#5573b5');
    expect(pageMarkup).toContain('--article-theme-surface-text:#ffffff');
    expect(pageMarkup).toContain('--catalog-theme-badge-surface:#5573b5');
    expect(pageMarkup).toContain('--catalog-theme-badge-text:#ffffff');
    expect(pageMarkup.indexOf('Artikelen')).toBeLessThan(
      pageMarkup.indexOf('data-article-image-kind="hero"'),
    );
    expect(pageMarkup.indexOf('<h1')).toBeLessThan(pageMarkup.indexOf('<time'));
    expect(pageMarkup).toContain('data-article-image-kind="hero"');
    expect(pageMarkup).toContain('data-article-image-fit="contain"');
    expect(pageMarkup).not.toContain('>Home<');
    expect(pageMarkup).toContain('Artikelen');
    expect(pageMarkup).toContain('/themes/star-wars');
    expect(pageMarkup).toContain('Star Wars Day 2026');
    expect(pageMarkup).toContain('Koopadvies');
    expect(pageMarkup).toContain('Meer in Star Wars');
    expect(pageMarkup).toContain('Star Wars collector guide');
  });

  it('renders the article page cleanly when no hero image is available', () => {
    const markup = renderToStaticMarkup(
      <ContentArticlePage
        body={<p>Direct naar de kern.</p>}
        contentArticle={{
          bodySource: 'Direct naar de kern.',
          cardImageAlt: 'Geen hero',
          date: '2026-05-01',
          description: 'Kort nieuws zonder hero.',
          heroImageAlt: 'Geen hero',
          slug: 'zonder-hero',
          status: 'published',
          title: 'Zonder hero',
        }}
      />,
    );

    expect(markup).toContain('Zonder hero');
    expect(markup).toContain('Kort nieuws zonder hero.');
    expect(markup).not.toContain('Beeld volgt nog. De inhoud staat al klaar.');
    expect(markup).not.toContain('data-article-image-kind="hero"');
  });

  it('keeps prose link styling scoped to running text links instead of component ctas', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/content/ui/src/lib/content-article-ui.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.prose :is(p, li, blockquote) a {');
    expect(css).toContain(
      'color: var(--lego-link-color, var(--lego-accent-700));',
    );
    expect(css).not.toContain('.prose a {');
  });

  it('renders FeaturedSet gracefully when price and availability are missing', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleFeaturedSet
        ctaHref="/sets/mario-kart-spiny-shell-40787"
        imageAlt="Mario Kart Spiny Shell"
        imageUrl="https://example.com/40787.png"
        name="Mario Kart – Spiny Shell"
        setNumber="40787"
        theme="Super Mario"
      />,
    );

    expect(markup).toContain('Mario Kart – Spiny Shell');
    expect(markup).toContain('Set 40787');
    expect(markup).toContain('/sets/mario-kart-spiny-shell-40787');
    expect(markup).toContain('data-article-image-kind="featured"');
    expect(markup).toContain('data-article-image-fit="contain"');
    expect(markup).not.toContain('data-article-image-fit="cover"');
    expect(markup).not.toContain('Beste prijs nu');
  });

  it('tracks FeaturedSet set clicks with gtag without blocking navigation', () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    act(() => {
      root.render(
        <ContentArticleFeaturedSet
          articleSlug="lego-marvel-herbie"
          ctaHref="/sets/the-fantastic-four-herbie-76339"
          imageAlt="The Fantastic Four H.E.R.B.I.E."
          name="The Fantastic Four H.E.R.B.I.E."
          setNumber="76339"
          theme="Marvel"
        />,
      );
    });

    const link = container.querySelector(
      'a[href="/sets/the-fantastic-four-herbie-76339"]',
    );
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    expect(link?.dispatchEvent(clickEvent)).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(false);
    expect(gtag).toHaveBeenCalledWith('event', 'set_click', {
      article_slug: 'lego-marvel-herbie',
      set_id: '76339',
      set_name: 'The Fantastic Four H.E.R.B.I.E.',
      source: 'article',
    });

    delete window.gtag;
  });

  it('does not crash when FeaturedSet set tracking runs without gtag', () => {
    delete window.gtag;

    act(() => {
      root.render(
        <ContentArticleFeaturedSet
          ctaHref="/sets/mario-kart-spiny-shell-40787"
          imageAlt="Mario Kart Spiny Shell"
          name="Mario Kart – Spiny Shell"
          setNumber="40787"
          theme="Super Mario"
        />,
      );
    });

    const link = container.querySelector(
      'a[href="/sets/mario-kart-spiny-shell-40787"]',
    );
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    expect(() => link?.dispatchEvent(clickEvent)).not.toThrow();
    expect(clickEvent.defaultPrevented).toBe(false);
  });

  it('renders SetSpotlightList as a grouped editorial wrapper around set tiles', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleSetSpotlightList
        sections={[
          {
            body: <div data-set-card-grid="true">Rocking Plants tile</div>,
            description: 'Lichte builds met veel kleur.',
            highlightSetNumber: '11506',
            id: 'botanicals',
            layoutVariant: 'single',
            title: 'Botanicals',
          },
          {
            body: <div data-set-card-grid="true">Disney tiles</div>,
            highlightSetNumber: '43301',
            id: 'toy-story-disney',
            layoutVariant: 'pair',
            title: 'Toy Story & Disney',
          },
        ]}
      />,
    );

    expect(markup).toContain('data-set-spotlight-list="true"');
    expect(markup).toContain('data-set-spotlight-section="botanicals"');
    expect(markup).toContain('data-set-spotlight-section="toy-story-disney"');
    expect(markup).toContain('data-set-spotlight-layout="single"');
    expect(markup).toContain('data-set-spotlight-layout="pair"');
    expect(markup).toContain('data-article-layout="media-block"');
    expect(markup).toContain('Rocking Plants tile');
    expect(markup).toContain('Disney tiles');
  });

  it('derives article theme visuals from the shared catalog theme mapping', () => {
    const markup = renderToStaticMarkup(
      <ContentArticlePage
        body={<p>Pak deze als je één grote displayset wil.</p>}
        contentArticle={{
          bodySource: 'Pak deze als je één grote displayset wil.',
          cardImageAlt: 'Icons hero',
          date: '2026-04-24',
          description: 'Welke grote displayset springt eruit?',
          heroImage: '/articles/lego-icons-guide/hero.jpg',
          heroImageAlt: 'Icons hero',
          slug: 'lego-icons-guide',
          status: 'published',
          theme: 'Icons',
          title: 'LEGO Icons koopgids',
        }}
        themePresentation={{
          href: '/themes/icons',
          label: 'Icons',
          style: {
            '--article-theme-accent': '#f0c63b',
            '--article-theme-surface': '#f0c63b',
            '--article-theme-surface-text': '#171a22',
            '--catalog-theme-badge-surface': '#f0c63b',
            '--catalog-theme-badge-text': '#171a22',
          },
          tone: 'light',
        }}
      />,
    );

    expect(markup).toContain('data-article-theme="icons"');
    expect(markup).toContain('data-article-theme-tone="light"');
    expect(markup).toContain('--article-theme-surface:#f0c63b');
    expect(markup).toContain('--article-theme-surface-text:#171a22');
    expect(markup).toContain('--catalog-theme-badge-surface:#f0c63b');
    expect(markup).toContain('--catalog-theme-badge-text:#171a22');
    expect(markup).toContain('/themes/icons');
    expect(markup).toContain('Icons');
  });

  it('renders an embedded set rail with copy and optional debug note', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleSetRail
        debugMessage="SetRail: geen sets gevonden voor 10358"
        emptyMessage="Deze selectie vullen we aan zodra de sets live staan in Brickhunt."
        subtitle="Display, UCS en sets die echt iets doen op je plank."
        title="Star Wars sets om te volgen"
      >
        <div>Set cards</div>
      </ContentArticleSetRail>,
    );

    expect(markup).toContain('data-article-layout="wide-block"');
    expect(markup).toContain('data-article-module="set-rail"');
    expect(markup).toContain('data-article-width="commerce-rail"');
    expect(markup).toContain('Star Wars sets om te volgen');
    expect(markup).toContain(
      'Display, UCS en sets die echt iets doen op je plank.',
    );
    expect(markup).toContain('SetRail: geen sets gevonden voor 10358');
    expect(markup).toContain('Set cards');
    expect(markup).not.toContain('themedSectionHeading');
  });

  it('renders an article image gallery wrapper that can break wider than prose', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleImageGallery
        images={[
          {
            alt: 'LEGO Star Wars Grogu als leerling van de Mandalorian',
            caption:
              'Een character-set die meteen opvalt in de aanloop naar May the 4th.',
            src: '/articles/star-wars-day-2026/grogu.jpg',
          },
          {
            alt: 'LEGO Star Wars The Razor Crest',
            src: '/articles/star-wars-day-2026/razor-crest.jpg',
          },
        ]}
      />,
    );

    expect(markup).toContain('data-article-layout="media-block"');
    expect(markup).toContain('data-article-module="image-gallery"');
    expect(markup).toContain('data-article-width="editorial-media"');
    expect(markup).toContain('Artikelgalerij');
    expect(markup).toContain('/articles/star-wars-day-2026/grogu.jpg');
    expect(markup).toContain(
      'Een character-set die meteen opvalt in de aanloop naar May the 4th.',
    );
  });

  it('renders a faq block with prose-aligned layout metadata', () => {
    const markup = renderToStaticMarkup(
      <ContentArticleFaq
        items={[
          {
            answer:
              'Star Wars Day is elk jaar op 4 mei. De datum komt van de bekende woordspeling “May the Fourth be with you”.',
            question: 'Wanneer is Star Wars Day?',
          },
        ]}
        title="Veelgestelde vragen over Star Wars Day"
      />,
    );

    expect(markup).toContain('data-article-layout="faq-block"');
    expect(markup).toContain('data-article-module="faq"');
    expect(markup).toContain('Veelgestelde vragen over Star Wars Day');
    expect(markup).toContain('Wanneer is Star Wars Day?');
  });

  it('expands and collapses faq answers with accessible buttons', () => {
    act(() => {
      root.render(
        <ContentArticleFaq
          items={[
            {
              answer:
                'Star Wars Day is elk jaar op 4 mei. De datum komt van de bekende woordspeling “May the Fourth be with you”.',
              question: 'Wanneer is Star Wars Day?',
            },
            {
              answer:
                'Niet altijd. Soms zit de waarde juist in cadeaus bij aankoop, extra voorraad of tijdelijke acties.',
              question: 'Zijn LEGO Star Wars sets dan altijd goedkoper?',
            },
          ]}
          title="Veelgestelde vragen over Star Wars Day"
        />,
      );
    });

    const firstQuestionButton = container.querySelector(
      'button[aria-controls][aria-expanded="false"]',
    ) as HTMLButtonElement | null;
    const firstAnswerPanel = container.querySelector(
      '[role="region"]',
    ) as HTMLElement | null;

    expect(firstQuestionButton?.textContent).toContain(
      'Wanneer is Star Wars Day?',
    );
    expect(firstQuestionButton?.getAttribute('aria-expanded')).toBe('false');
    expect(firstAnswerPanel?.hasAttribute('hidden')).toBe(true);

    act(() => {
      firstQuestionButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(firstQuestionButton?.getAttribute('aria-expanded')).toBe('true');
    expect(firstAnswerPanel?.hasAttribute('hidden')).toBe(false);
    expect(firstAnswerPanel?.textContent).toContain(
      'May the Fourth be with you',
    );

    act(() => {
      firstQuestionButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(firstQuestionButton?.getAttribute('aria-expanded')).toBe('false');
    expect(firstAnswerPanel?.hasAttribute('hidden')).toBe(true);
  });

  it('keeps article callouts flat with accent-subtle background and no border', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/content/ui/src/lib/content-article-ui.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.callout {');
    expect(css).toContain('background: var(--lego-accent-subtle);');
    expect(css).not.toMatch(/\.callout\s*\{[^}]*border:/s);
  });

  it('keeps article index cards flat with bordered hover states and no hover elevation', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/content/ui/src/lib/content-article-ui.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.card:hover,');
    expect(css).toContain('.featuredArticle:hover,');
    expect(css).toContain('border: var(--lego-border-width-1) solid');
    expect(css).not.toContain('--lego-shadow-raised');
    expect(css).not.toContain('translateY(');
  });

  it('keeps SetSpotlightList CSS focused on section rhythm instead of duplicate card chrome', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/content/ui/src/lib/content-article-ui.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.setSpotlightSectionItems {');
    expect(css).not.toContain('.setSpotlightCard');
  });

  it('keeps spotlight layout CSS simple and avoids old split-card rules', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/content/ui/src/lib/content-article-ui.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.setSpotlightSectionItems {');
    expect(css).not.toContain('grid-row: span 2;');
    expect(css).not.toContain('grid-column: 1 / -1;');
  });

  it('adds more breathing room between intro and body plus extra space below the article shell', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/content/ui/src/lib/content-article-ui.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.articleBody {');
    expect(css).toContain('padding-top: var(--lego-space-4);');
    expect(css).toContain('.articleShell {');
    expect(css).toContain('padding-bottom: var(--lego-space-12);');
    expect(css).toContain('.breadcrumbs + .hero {');
    expect(css).toContain('margin-top: var(--lego-space-4);');
  });

  it('lets SetSpotlightList cards break full-bleed on mobile without gaps between stacked cards', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'libs/content/ui/src/lib/content-article-ui.module.css',
      ),
      'utf-8',
    );

    expect(css).toContain('.setSpotlightSectionItems {');
    expect(css).toContain('margin-inline: calc(50% - 50vw);');
    expect(css).toContain('max-width: 100vw;');
    expect(css).toContain('overflow-x: clip;');
    expect(css).toContain('width: 100vw;');
    expect(css).toContain('gap: 0;');
  });
});
