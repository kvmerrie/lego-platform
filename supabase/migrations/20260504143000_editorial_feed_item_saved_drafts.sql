alter table public.editorial_feed_items
  add column if not exists draft_mdx text,
  add column if not exists draft_frontmatter jsonb,
  add column if not exists drafted_at timestamptz;
