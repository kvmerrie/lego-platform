# Caching and revalidation

Brickhunt gebruikt stale-while-revalidate als standaard: publieke pagina's mogen kortstondig oude data tonen, terwijl catalogus-, prijs- en CMS-mutaties gericht tags of paths verversen. Het doel is lage TTFB, weinig Vercel ISR writes en geen brede herbouw na iedere merchant import.

## Route-inventaris

| Route                                                                              | Type                      | Huidige strategie                                           | Waarom                                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/`                                                                                | Homepage                  | ISR fallback 6 uur, tag `homepage` voor commerce reads      | Homepage is publiek en zwaar gelezen. Alleen revalidaten wanneer zichtbare rails wijzigen.            |
| `/sets/[slug]`                                                                     | Set detail                | ISR fallback 6 uur, prijs/offers via `set:*` tags           | Detailpagina mag snel laden. Prijsdata komt uit merchant jobs en hoeft niet per request live te zijn. |
| `/themes`                                                                          | Thema-overzicht           | ISR fallback 6 uur                                          | Verandert bij catalogus/theme-mutaties, niet per bezoeker.                                            |
| `/themes/[slug]`                                                                   | Thema detail              | ISR fallback 6 uur, tags `theme:*`, `set:*` voor rail reads | Thema-inhoud en dealrails kunnen gericht worden ververst.                                             |
| `/deals`                                                                           | Deals                     | ISR fallback 6 uur, tag `deals` voor discovery signals      | Deals volgen merchant prijsupdates; geen 5-minuten globale ISR nodig.                                 |
| `/artikelen`                                                                       | Artikeloverzicht          | ISR fallback 6 uur                                          | Publicatie/update vanuit CMS hoort `news` en eventueel `homepage`/`sitemap` te revalidaten.           |
| `/artikelen/[theme]`                                                               | Artikel-thema             | ISR fallback 6 uur                                          | Zelfde CMS-mutatiepad als artikeloverzicht.                                                           |
| `/artikelen/[theme]/[slug]`                                                        | Artikel detail            | Dynamic                                                     | Gebruikt nu dynamic rendering; kandidaat om na preview/draft-scheiding naar ISR met `news:*` te gaan. |
| `/artikelen/preview/[previewId]`                                                   | Preview                   | Dynamic, `revalidate = 0`                                   | Preview is niet publiek en moet altijd vers blijven.                                                  |
| `/pages/[slug]`                                                                    | CMS pagina                | ISR fallback 6 uur                                          | CMS-pagina's revalidaten bij publicatie of SEO-wijziging.                                             |
| `/hoe-werkt-het`, `/over-brickhunt`                                                | Statische CMS/info pagina | ISR fallback 24 uur                                         | Lage wijzigingsfrequentie.                                                                            |
| `/search`                                                                          | Zoekpagina                | Dynamic                                                     | Querygedrag en suggesties horen niet als ISR-varianten per URL vastgelegd te worden.                  |
| `/account`, `/account/collection`, `/account/wishlist`, `/volgt`, `/auth/callback` | Utility/persoonlijk       | Niet indexeerbaar, persoonlijk of auth                      | Dynamic/client data is hier acceptabel.                                                               |
| Redirect routes `/collection`, `/discover`, `/wishlist`                            | Redirect-only             | Geen indexeerbare content                                   | Niet opnemen in sitemap of revalidatie.                                                               |
| `/sitemap.xml`, `/sitemaps/*.xml`                                                  | SEO XML                   | Gated door `allowIndexing`                                  | Sitemap blijft leeg/no-op zolang indexing uit staat.                                                  |
| `/api/revalidate`                                                                  | Interne API               | Dynamic                                                     | Vereist secret en accepteert strikt tags/paths.                                                       |
| `/api/catalog/set-cards`, `/api/catalog/search-suggestions`                        | API                       | Dynamic                                                     | Interactieve API-responses; geen ISR HTML writes.                                                     |
| `/api/events/article-click`                                                        | API                       | Dynamic                                                     | Event tracking moet niet gecachet worden.                                                             |
| `/api/admin/commerce-rails-diagnostics`                                            | Admin API                 | Dynamic, `revalidate = 0`                                   | Diagnostiek moet actuele runtime staat tonen.                                                         |

## Cachingmatrix

| Paginatype       | Aanbevolen default                         | Tags                                                                             | On-demand trigger                                             |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Set detail       | ISR 6-24 uur met hoge fallback             | `sets`, `set:{setId}`, `set:{slug}`                                              | Set-mutatie, merchant prijswijziging voor die set             |
| Merchant/prijzen | Cached reads, geen globale path revalidate | `merchant:{slug}`, `merchant-products:{slug}`, `prices:{slug}`, gerichte `set:*` | Merchant cronjob alleen bij echte wijzigingen                 |
| Thema/collectie  | ISR 6-24 uur                               | `themes`, `theme:{slug}`, relevante `set:*`                                      | Theme-mutatie of set toegevoegd/gewijzigd in thema            |
| Nieuws           | ISR 6-24 uur                               | `news`, `news:{slug}`                                                            | CMS publish/update/unpublish                                  |
| Homepage         | ISR 6 uur                                  | `homepage`                                                                       | Alleen als homepage rails of hero zichtbaar wijzigen          |
| Sitemaps         | Gated, cached/no-op pre-launch             | `sitemap`                                                                        | Publiceerbare set/article/theme/deal toegevoegd of verwijderd |
| Zoek/filter      | Dynamic of client-side index               | `search-index` voor indexbestand                                                 | Alleen bij cataloguswijziging die zoekresultaten raakt        |
| Account/auth     | Dynamic/no-store                           | Geen publieke tags                                                               | Persoonlijke data; niet via ISR                               |

## Cache tags

De centrale tag-taxonomie staat in `libs/shared/config/src/lib/cache-tags.ts`.

Standaardtags:

- `sets`, `set:{setNumberOrSlug}`
- `themes`, `theme:{themeSlug}`
- `merchants`, `merchant:{merchantSlug}`
- `merchant-products:{merchantSlug}`
- `prices`, `prices:{merchantSlug}`
- `news`, `news:{articleSlug}`
- `homepage`
- `sitemap`
- `search-index`

Gebruik de helpers:

- `buildMerchantRevalidationTags` na merchant imports.
- `buildCatalogSetRevalidationTags` na set/catalogus-mutaties.
- `buildThemeRevalidationTags` na thema-mutaties.
- `buildNewsRevalidationTags` na CMS artikel-mutaties.

## Revalidation API

`/api/revalidate` accepteert nu `tags` en `paths`.

```json
{
  "tags": ["prices:coolblue", "set:10316-1"],
  "paths": ["/sets/rivendell-10316"],
  "reason": "coolblue_feed_sync"
}
```

Regels:

- Secret verplicht via `x-revalidate-secret` of `Authorization: Bearer`.
- Maximaal 100 tags en 25 paths per request.
- Tags worden genormaliseerd en gededupliceerd.
- Minimaal één geldige tag of path is verplicht.
- Path revalidation blijft gericht; gebruik geen `revalidatePath('/')` als alleen prijsdata of één set wijzigt.

## Merchant cronjobs

Cronfrequentie:

- 6 uur: Lidl, Coolblue, Goodbricks, Coppenswarenhuis, Alternate, Misterbricks.
- 24 uur: MediaMarkt.

Gewenst patroon per job:

1. Fetch feed.
2. Normaliseer producten.
3. Vergelijk met huidige `commerce_offer_latest` staat.
4. Upsert alleen gewijzigde latest/seed records.
5. Als niets gewijzigd is: geen revalidation request.
6. Als wel gewijzigd: revalidate alleen:
   - `merchant:{merchantSlug}`
   - `merchant-products:{merchantSlug}`
   - `prices:{merchantSlug}`
   - `set:{setIdOrSlug}` voor gewijzigde sets
7. `homepage` of `sitemap` alleen toevoegen als de wijziging zichtbaar is op homepage of sitemap-inhoud verandert.

De helper gebruikt `prices` alleen als fallback wanneer de gewijzigde sets onbekend zijn. De gedeelde affiliate importer vergelijkt feedinhoud nu met bestaande offer seeds en latest offers. Timestamp-only verschillen tellen niet als wijziging. Bij een no-op feed worden seed/latest upserts overgeslagen en blijven `changedSetIds` en `changedSetSlugs` leeg. De feed apps loggen naast `fetched_products`, `matched_catalog_sets`, `imported_offers`, `upserted_seeds`, `upserted_latest` en `duration_ms` nu ook `changed_sets`.

## CMS en Supabase mutaties

Gebruik dezelfde endpoint vanuit hooks/admin acties. De admin/API routes sluiten nu de belangrijkste mutaties event-driven aan:

- Artikel publish/update/delete: artikeloverzicht, thema-overzicht en artikel-detail path, plus `news`, `news:{articleSlug}`, `homepage`, `sitemap`.
- Set create: set-detail path, theme path, plus `sets`, `set:{setId}`, `theme:{themeSlug}`, `homepage`, `sitemap`, `search-index`.
- Offer seed create/update: set-detail path, theme path, plus `set:{setId}`, `theme:{themeSlug}`, `homepage`, `deals`.
- Merchant create/update: `merchants`, `merchant:{merchantSlug}`, `merchant-products:{merchantSlug}`, `prices:{merchantSlug}`.

Thema-mutaties buiten set-imports hebben nog geen aparte publieke admin route in deze codebase. Als die route wordt toegevoegd, moet hij `themes`, `theme:{themeSlug}`, eventueel `homepage` en `sitemap` revalidaten.

## Dynamic routes die dynamic moeten blijven

| Route/bestand                                                    | Reden                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| `apps/web/src/app/search/page.tsx`                               | Zoek/filter mag geen ISR-variant per query schrijven. |
| `apps/web/src/app/artikelen/preview/[previewId]/page.tsx`        | Preview moet live en niet publiek zijn.               |
| `apps/web/src/app/api/revalidate/route.ts`                       | Interne mutatie-API.                                  |
| `apps/web/src/app/api/events/article-click/route.ts`             | Event ingest.                                         |
| `apps/web/src/app/api/admin/commerce-rails-diagnostics/route.ts` | Operator-diagnostiek.                                 |
| `apps/web/src/app/api/catalog/set-cards/route.ts`                | API-response voor interactieve surfaces.              |
| `apps/web/src/app/api/catalog/search-suggestions/route.ts`       | Typeahead/search suggestions.                         |
| User, collection en wishlist data-access                         | Persoonlijke data met auth/session context.           |

Published article detail is ISR met 6 uur fallback. Alleen preview blijft dynamic met `revalidate = 0`.

## ISR-write besparing

Verwachte winst:

- Public routes met 60s of 300s fallback zijn naar 6 uur gezet; statische info naar 24 uur.
- Public catalog API reads die eerder standaard `no-store` waren, krijgen nu standaard 6 uur `next.revalidate` plus tags.
- Merchant jobs kunnen van brede path-herbouw naar merchant/set tags, omdat de importer exact gewijzigde set IDs/slugs teruggeeft.
- De policy-spec voorkomt nieuwe onbedoelde `force-dynamic`, `revalidate = 0` of `no-store` plekken.

Dit verlaagt vooral writes op homepage, deals, thema's en set details. In plaats van regeneratie door verkeer elke 1-5 minuten wordt de normale fallback maximaal elke 6-24 uur actief, met gerichte verversing na echte datawijzigingen.

## Handmatige reviewpunten

- De Supabase data-access laag bevat nog directe server reads op meerdere admin en diagnostic surfaces. Publieke homepage/deals gebruiken nu een cached facade voor current offer summaries, maar extra publieke reads moeten dezelfde route volgen.
- Feed importers geven exact gewijzigde set IDs/slugs terug voor de gedeelde affiliate importer. Controleer nieuwe importers op dezelfde contractvorm voordat ze revalidation triggeren.
- Er is nog geen aparte theme create/update admin route gevonden. Voeg bij introductie direct `buildThemeRevalidationTags` toe.
- Controleer in productie met Vercel logs hoeveel `/api/revalidate` calls per cronjob ontstaan en cap grote changed-set batches.

## Observability na deploy

Controleer in Vercel Logs op deze prefixes:

- `[public-web-revalidation] request`
- `[public-web-revalidation] response`
- `[public-web-revalidation] broad tags requested`
- `[post-deploy-public-web-revalidation] request`
- `[post-deploy-public-web-revalidation] succeeded`
- `[post-deploy-public-web-revalidation] failed visibly`
- `Public web revalidation requested.`
- `Public web revalidation received broad tags.`

Belangrijke velden:

- `reason`: bron van de mutatie, bijvoorbeeld `editorial_article_publish`, `admin_commerce_offer_seed_mutation`, `commerce_sync`.
- `source`: `catalog` voor bulk/catalog helpers, `generic` voor directe admin/CMS revalidation.
- `pathCount` en `tagCount`: aantal deduped revalidation targets.
- `pathSample` en `tagSample`: compacte sample van maximaal 12 waarden.
- `pathSampleOmittedCount` en `tagSampleOmittedCount`: hoeveel waarden niet in de sample staan.
- `durationMs` en `status`: response-meting van de outbound `/api/revalidate` call.
- `broadTagCount` en `broadTags`: waarschuwing voor brede tags zoals `homepage`, `deals`, `prices`, `sitemap`.
- `changed_sets` in merchant cron logs: aantal sets waarvan offer/seed-inhoud echt wijzigde.

Na een succesvolle production web deployment draait GitHub Actions `Post Deploy Public Web Revalidation`. Die workflow slaat preview deployments en niet-web deployment targets over en roept alleen voor production public web `/api/revalidate` aan met:

- `paths`: `/`, `/deals`, `/themes`
- `tags`: `homepage`, `deals`, `themes`
- `reason`: `production_deploy`

Vereiste GitHub Actions configuratie: `WEB_BASE_URL=https://www.brickhunt.nl` als variable en `WEB_REVALIDATE_SECRET` als secret. De secret moet gelijk zijn aan de Vercel `WEB_REVALIDATE_SECRET`. Een HTTP- of fetch-fout laat de workflow falen, zodat stale production HTML niet stil blijft liggen.

Dashboard checks:

- Per cronjob run: `changed_sets` hoort vaak veel lager te zijn dan `matched_catalog_sets`.
- Per cronjob run: `tagCount` hoort ongeveer `changed_sets` plus merchant/surface tags te volgen.
- Waarschuwingsvolume: `[public-web-revalidation] broad tags requested` mag voorkomen bij bewuste homepage/deals/sitemap updates, maar niet bij elke no-op import.
- No-op imports: `changed_sets=0` hoort samen te vallen met geen of minimale revalidation requests.
- Grote batches: als `pathSampleOmittedCount` of `tagSampleOmittedCount` vaak hoog is, overweeg batching/capping voor die job.
- Fouten: zoek op `Public web revalidation failed` en controleer `status` in response logs.
