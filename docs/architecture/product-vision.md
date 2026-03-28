# Product Vision

## Product Summary

This product is a LEGO collector platform built to help enthusiasts browse sets, track ownership, and build a richer collecting experience over time.

The MVP is intentionally narrow:

- browse LEGO sets
- mark sets as owned
- mark sets as wanted

The initial experience should already feel polished, fast, and trustworthy.

## Experience Goals

- The public portal should feel premium, playful, clean, and retail-grade.
- Performance and SEO matter from the start.
- The experience should be ready for static generation and ISR-based delivery patterns as catalog and content surfaces mature.
- Design quality should feel inspired by `lego.com` without becoming a clone.

## Product Roadmap

Near and mid-term expansion is expected in these areas:

- pricing history
- affiliate offers
- editorial content and curated landing pages
- richer social or media features
- more advanced collection and wishlist workflows
- mobile or native clients

## Content Strategy

Contentful is reserved for editorial and page-builder use cases:

- pages
- sections
- ordering
- SEO fields
- curated editorial content

Contentful is not the source of truth for the LEGO set catalog.

## Data Strategy

- LEGO catalog data should come from system-managed sync sources and normalized data-access layers.
- External LEGO APIs are important integration inputs, but they should not be runtime-critical dependencies for the public browsing experience.
- The architecture should prefer resilient sync, caching, and BFF aggregation patterns over fragile client-side dependency chains.

## Business And Platform Direction

- Start lean and cost-conscious.
- Keep the architecture professional enough to scale without a rewrite.
- Build shared business logic that can later support web, admin, API, and mobile clients.
- Treat maintainability and clean boundaries as product features, not internal luxuries.
