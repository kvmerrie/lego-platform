with public_theme_logo_assets(slug, public_logo_url) as (
  values
    ('animal-crossing', '/themes/logos/animal-crossing_logo.png'),
    ('architecture', '/themes/logos/architecture_logo.png'),
    ('art', '/themes/logos/art_logo.png'),
    ('batman', '/themes/logos/batman_logo.png'),
    ('bluey', '/themes/logos/bluey_logo.png'),
    ('botanicals', '/themes/logos/botanicals_logo.png'),
    ('brickheadz', '/themes/logos/brickheadz_logo.png'),
    ('city', '/themes/logos/city_logo.png'),
    ('classic', '/themes/logos/classic_logo.png'),
    ('creator-3in1', '/themes/logos/creator-3-in-1_logo.png'),
    ('creator-3-in-1', '/themes/logos/creator-3-in-1_logo.png'),
    ('dc', '/themes/logos/dc_logo.png'),
    ('disney', '/themes/logos/disney_logo.png'),
    ('dreamzzz', '/themes/logos/dreamzzz_logo.png'),
    ('duplo', '/themes/logos/duplo_logo.png'),
    ('editions', '/themes/logos/editions_logo.png'),
    ('education', '/themes/logos/education_logo.png'),
    ('fortnite', '/themes/logos/fortnite_logo.png'),
    ('friends', '/themes/logos/friends_logo.png'),
    ('gabbys-dollhouse', '/themes/logos/gabbys-dollhouse_logo.png'),
    ('gabby-s-dollhouse', '/themes/logos/gabbys-dollhouse_logo.png'),
    ('gabby-s-poppenhuis', '/themes/logos/gabbys-dollhouse_logo.png'),
    ('harry-potter', '/themes/logos/harry-potter_logo.png'),
    ('icons', '/themes/logos/icons_logo.png'),
    ('ideas', '/themes/logos/ideas_logo.png'),
    ('jurassic-world', '/themes/logos/jurassic-world_logo.png'),
    ('lord-of-the-rings', '/themes/logos/lord-of-the-rings_logo.png'),
    ('marvel', '/themes/logos/marvel_logo.png'),
    ('minecraft', '/themes/logos/minecraft_logo.png'),
    ('collectible-minifigures', '/themes/logos/minifigures_logo.png'),
    ('minifigures', '/themes/logos/minifigures_logo.png'),
    ('minifiguren', '/themes/logos/minifigures_logo.png'),
    ('monkie-kid', '/themes/logos/monkie-kid_logo.png'),
    ('nike', '/themes/logos/nike_logo.png'),
    ('ninjago', '/themes/logos/ninjago_logo.png'),
    ('one-piece', '/themes/logos/one-piece_logo.png'),
    ('peppa-pig', '/themes/logos/peppa-pig_logo.png'),
    ('powered-up', '/themes/logos/powered-up_logo.png'),
    ('serious-play', '/themes/logos/serious-play_logo.png'),
    ('sonic-the-hedgehog', '/themes/logos/sonic-the-hedgehog_logo.png'),
    ('speed-champions', '/themes/logos/speed-champions_logo.png'),
    ('star-wars', '/themes/logos/star-wars_logo.png'),
    ('super-mario', '/themes/logos/super-mario_logo.png'),
    ('technic', '/themes/logos/technic_logo.png'),
    ('the-legend-of-zelda', '/themes/logos/zelda_logo.png'),
    ('wednesday', '/themes/logos/wednesday_logo.png'),
    ('wicked', '/themes/logos/wicked_logo.png'),
    ('zelda', '/themes/logos/zelda_logo.png')
)
update catalog_themes
set public_logo_url = public_theme_logo_assets.public_logo_url
from public_theme_logo_assets
where catalog_themes.slug = public_theme_logo_assets.slug
  and (
    nullif(trim(catalog_themes.public_logo_url), '') is null
    or (
      catalog_themes.slug in (
        'creator-3in1',
        'creator-3-in-1',
        'gabby-s-dollhouse',
        'gabby-s-poppenhuis',
        'gabbys-dollhouse',
        'lord-of-the-rings',
        'collectible-minifigures',
        'minifigures',
        'minifiguren',
        'star-wars',
        'the-legend-of-zelda',
        'zelda'
      )
      and trim(catalog_themes.public_logo_url) in ('...')
    )
  );
