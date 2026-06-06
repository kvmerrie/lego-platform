# Admin V2 CMS

Admin V2 CMS owns public homepage editorial rails and catalog theme presentation.

## Data Model

- `public_page_sections` stores page-level section config.
- `public_page_section_items` stores ordered section items.
- Homepage rows use `page_key = 'homepage'`.
- Items can reference `theme`, `set`, `collection`, or `custom`.
- Theme presentation remains on `catalog_themes.public_*`, plus `is_public`, `status`, `public_order`, and `public_homepage_order`.

## Promotion Safety

Catalog promotion must not overwrite production CMS/editorial changes. The generic CMS tables are not part of catalog promotion. Theme presentation fields on `catalog_themes` are protected by the existing catalog promotion strategy and should be repaired or promoted through Admin V2 CMS or the dedicated theme presentation repair flow, not through a full catalog snapshot overwrite.

Local and staging Admin V2 writes target the configured staging Supabase project. Production stays read-only except for explicit promote flows.

## Revalidation

- Homepage section saves revalidate `/` with tag `homepage`.
- Theme presentation saves revalidate `/`, `/themes`, `/themes/{slug}` with tags `homepage`, `themes`, and `theme:{slug}`.

## Seeded Homepage Config

The migration seeds:

- `discovery_routes`: `Ontdek LEGO op jouw manier`
- `theme_rail`: `Fantasy, Star Wars of strak design?`
- `theme_spotlight`: `Botanicals, kunst of modulaire straten?`

The seeded theme rail items are:

- `star-wars` with image set `75419`, title `Death Star`
- `marvel` with image set `76269`, title `Avengers toren`
- `harry-potter` with image set `76417`, title `Goudgrijp Tovenaarsbank - Verzameleditie`
- `icons` with image set `11384`, title `Golden retriever puppy`
- `disney` with image set `43222`, title `Disney Castle`
- `technic` with image set `42172`, title `McLaren P1`
