# IndexNow

Brickhunt gebruikt IndexNow als snelle melding richting Bing, Yahoo en andere
IndexNow-consumenten wanneer publieke content echt nieuw is of wezenlijk
verandert.

IndexNow vervangt de sitemap niet. De sitemap blijft de volledige inventaris;
IndexNow is alleen het signaal voor recente, belangrijke wijzigingen.

Protocol reference: <https://www.indexnow.org/documentation>

## Environment

Production web and server jobs need the same key:

- `INDEXNOW_KEY`
  - Required for submissions and key-file verification.
  - Use 8-128 letters, numbers, or dashes.
  - Generate one with `uuidgen | tr '[:upper:]' '[:lower:]'`.
- `INDEXNOW_ENABLED`
  - Optional.
  - Defaults to enabled only on the canonical production host
    `https://www.brickhunt.nl`.
  - Set `INDEXNOW_ENABLED=false` to force-disable.
  - Local development is disabled by default.
- `INDEXNOW_ENDPOINT`
  - Optional.
  - Defaults to `https://api.indexnow.org/indexnow`.

The public key file is served by the web app at:

```text
https://www.brickhunt.nl/{INDEXNOW_KEY}.txt
```

That file must return the key as plain text. Check production with:

```bash
curl -sL "https://www.brickhunt.nl/${INDEXNOW_KEY}.txt"
```

## Central Service

All submissions go through:

```ts
import { isIndexNowEnabled, submitUrl, submitUrls } from '@lego-platform/shared/config';
```

Do not call the IndexNow endpoint directly from feature code, route handlers, or
sync scripts. The central service handles:

- canonical `https://www.brickhunt.nl` URL generation
- URL validation
- non-public route filtering
- deduplication
- batches of up to 10,000 URLs
- structured success/failure logging
- non-throwing failure results

## Submission Policy

Submit:

- newly created set detail pages
- newly public or substantially changed theme pages
- newly public or substantially changed collection pages
- public deal index/category pages when deal-page snapshots are intentionally
  rebuilt

Do not submit:

- every merchant price change
- every offer refresh
- every `commerce_offer_latest` fluctuation
- every ISR revalidation
- search, account, auth, API, or admin routes

Current integration points:

- `apps/catalog-set-import`: submits the new `/sets/[slug]` URL only after a
  set is created.
- `apps/api/src/app/routes/admin-promote.ts`: submits CMS/catalog promotion
  targets after successful promotion, without delaying the API response.
- `apps/deal-page-snapshot-sync`: submits `/deals` and deal category pages only
  after a write-mode snapshot upsert.

## Adding Content Types

When a new public content type is added:

1. Add or reuse a canonical path helper in `@lego-platform/shared/config`.
2. Ensure the route is indexable and present in the sitemap where appropriate.
3. Call `submitUrl` or `submitUrls` from the publishing/sync workflow, not from
   page rendering.
4. Submit only on creation, deletion, redirects, or meaningful content changes.
5. Add tests for URL construction and disabled/error behavior.

Failures must never block rendering, ISR, sync artifacts, or API responses.
