alter table public.catalog_set_images
drop constraint if exists catalog_set_images_image_role_check;

with mapped_roles as (
  select
    id,
    case
      when image_role = 'model' and image_type = 'hero' then 'model_primary'
      when image_role = 'model' then 'model_secondary'
      when image_role = 'box' then 'box_front'
      when image_role = 'lifestyle' then 'lifestyle_room'
      else image_role
    end as new_role
  from public.catalog_set_images
  where image_role in ('model', 'box', 'lifestyle')
)
update public.catalog_set_images images
set
  image_role = mapped_roles.new_role,
  metadata_json = jsonb_set(
    jsonb_set(
      coalesce(images.metadata_json, '{}'::jsonb),
      '{roleClassification,role}',
      to_jsonb(mapped_roles.new_role),
      true
    ),
    '{roleClassification,source}',
    to_jsonb('deterministic-v2'::text),
    true
  )
from mapped_roles
where images.id = mapped_roles.id;

alter table public.catalog_set_images
add constraint catalog_set_images_image_role_check
check (
  image_role in (
    'model_primary',
    'model_secondary',
    'box_front',
    'box_back',
    'lifestyle_room',
    'lifestyle_people',
    'detail',
    'build',
    'minifigure',
    'logo',
    'unknown'
  )
);
