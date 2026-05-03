alter table public.editorial_feed_items
  drop constraint if exists editorial_feed_items_status_check;

alter table public.editorial_feed_items
  add constraint editorial_feed_items_status_check
  check (status in ('new', 'drafted', 'ignored', 'low_value', 'published'));
