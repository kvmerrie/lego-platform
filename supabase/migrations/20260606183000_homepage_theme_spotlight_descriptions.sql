with spotlight_descriptions(reference_type, reference_id, description) as (
  values
    (
      'theme',
      'botanicals',
      'Voor bloemen en planten die geen water nodig hebben.'
    ),
    (
      'theme',
      'art',
      'Bouwprojecten die je eerder ophangt dan neerzet.'
    ),
    (
      'theme',
      'architecture',
      'Voor skylines, monumenten en gebouwen met karakter.'
    ),
    (
      'collection',
      'lego-sets-onder-100-euro',
      'Sets die veel LEGO geven zonder groot budget.'
    ),
    (
      'theme',
      'icons',
      'Displaymodellen die gebouwd zijn om te blijven staan.'
    )
)
update public.public_page_section_items item
set metadata_json = jsonb_set(
    coalesce(item.metadata_json, '{}'::jsonb),
    '{description}',
    to_jsonb(spotlight_descriptions.description),
    true
  )
from public.public_page_sections section
cross join spotlight_descriptions
where item.section_id = section.id
  and item.reference_type = spotlight_descriptions.reference_type
  and item.reference_id = spotlight_descriptions.reference_id
  and section.page_key = 'homepage'
  and section.section_key = 'theme_spotlight';
