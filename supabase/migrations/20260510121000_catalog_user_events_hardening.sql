do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_user_events_session_id_shape'
  ) then
    alter table public.catalog_user_events
      add constraint catalog_user_events_session_id_shape
      check (char_length(session_id) between 16 and 128);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_user_events_set_num_shape'
  ) then
    alter table public.catalog_user_events
      add constraint catalog_user_events_set_num_shape
      check (
        set_num is null or (
          char_length(set_num) between 1 and 32
          and set_num ~ '^[A-Za-z0-9-]+$'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_user_events_merchant_slug_shape'
  ) then
    alter table public.catalog_user_events
      add constraint catalog_user_events_merchant_slug_shape
      check (
        merchant_slug is null or (
          char_length(merchant_slug) <= 80
          and merchant_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_user_events_page_path_shape'
  ) then
    alter table public.catalog_user_events
      add constraint catalog_user_events_page_path_shape
      check (
        page_path is null or (
          char_length(page_path) <= 240
          and left(page_path, 1) = '/'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_user_events_metadata_object'
  ) then
    alter table public.catalog_user_events
      add constraint catalog_user_events_metadata_object
      check (metadata is null or jsonb_typeof(metadata) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_user_events_offer_click_has_context'
  ) then
    alter table public.catalog_user_events
      add constraint catalog_user_events_offer_click_has_context
      check (
        event_type <> 'offer_click'
        or set_num is not null
        or merchant_slug is not null
      );
  end if;
end $$;
