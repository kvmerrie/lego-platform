with target_items(reference_id, metadata_patch) as (
  values
    (
      'deals',
      '{"surfaceColor":"#00a99d","surfaceTextColor":"#062927"}'::jsonb
    ),
    (
      'themes',
      '{"surfaceColor":"#8758d8","surfaceTextColor":"#ffffff"}'::jsonb
    )
)
update public.public_page_section_items
set metadata_json = public.public_page_section_items.metadata_json || target_items.metadata_patch
from public.public_page_sections
, target_items
where public.public_page_section_items.section_id = public.public_page_sections.id
  and target_items.reference_id = public.public_page_section_items.reference_id
  and public.public_page_sections.page_key = 'homepage'
  and public.public_page_sections.section_key = 'discovery_routes'
  and public.public_page_section_items.reference_type = 'custom'
  and public.public_page_section_items.reference_id in ('deals', 'themes');
