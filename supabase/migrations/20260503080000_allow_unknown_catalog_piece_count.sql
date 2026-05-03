do $$
declare
  piece_count_constraint_name text;
begin
  for piece_count_constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.catalog_sets'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%piece_count%'
  loop
    execute format(
      'alter table public.catalog_sets drop constraint %I',
      piece_count_constraint_name
    );
  end loop;
end $$;

alter table public.catalog_sets
add constraint catalog_sets_piece_count_check check (piece_count >= 0);
