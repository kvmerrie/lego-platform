with lego_theme_seed(
  slug,
  display_name,
  public_display_name,
  public_description,
  public_order,
  preferred_public
) as (
  values
    ('animal-crossing', 'Animal Crossing', 'Animal Crossing', 'Eilanden, bewoners en kleine Nintendo-details. Vergelijk Animal Crossing-sets als je vooral sfeer, figuren en herkenbare huisjes zoekt.', 10, true),
    ('architecture', 'Architecture', 'Architecture', 'Bekende skylines en gebouwen om rustig neer te zetten. Handig als je zoekt naar strakke displaysets met veel herkenning in weinig ruimte.', 20, true),
    ('art', 'Art', 'Art', 'Wandkunst, portretten en mozaieken voor aan de muur. Kijk hier als je LEGO vooral als displaystuk of interieuraccent wilt vergelijken.', 30, true),
    ('botanicals', 'Botanicals', 'Botanicals', 'Bloemen, planten en botanische bouwsets voor op tafel of plank. Vergelijk op formaat, kleur en welke set het best in je kamer past.', 40, true),
    ('brickheadz', 'BrickHeadz', 'BrickHeadz', 'Kleine blokkerige figuren van helden, dieren en popcultuur. Fijn om snel te vergelijken op personage, prijs en verzamelwaarde.', 50, true),
    ('city', 'City', 'City', 'Politie, brandweer, treinen, ruimtevaart en stadsleven. Begin hier als je speelsets zoekt die makkelijk met elkaar te combineren zijn.', 60, true),
    ('classic', 'Classic', 'Classic', 'Dozen vol stenen, kleuren en vrije bouwideeen. Vergelijk Classic als je vooral veel onderdelen en bouwvrijheid voor je geld wilt.', 70, true),
    ('collectible-minifigures', 'Collectible Minifigures', 'Collectible Minifigures', 'Losse series, displaywaardige figuren en minifiguur-sets. Hier zie je snel welke personages je verzameling echt verder vullen.', 80, true),
    ('creator-3in1', 'Creator 3in1', 'Creator 3in1', 'Drie bouwrichtingen in een doos: dieren, voertuigen, huizen en meer. Vergelijk deze sets als herbouwen net zo belangrijk is als neerzetten.', 90, true),
    ('dc', 'DC', 'DC', 'Batman, Gotham en andere DC-helden in bouwbare scenes en voertuigen. Kijk hier voor Batmobiles, minifiguren en displaymodellen.', 100, true),
    ('disney', 'Disney', 'Disney', 'Kastelen, filmscenes en bekende Disney-personages. Vergelijk op prinsessen, klassiekers, Stitch, kastelen en sets die opvallen op de plank.', 110, true),
    ('dreamzzz', 'DREAMZzz', 'DREAMZzz', 'Dromerige monsters, voertuigen en werelden met veel kleur. Handig als je speelse sets zoekt die minder voorspelbaar bouwen.', 120, true),
    ('duplo', 'DUPLO', 'DUPLO', 'Grote stenen, dieren, treinen en herkenbare eerste speelwerelden. Vergelijk DUPLO op leeftijd, thema en hoeveel speelwaarde erin zit.', 130, true),
    ('editions', 'Editions', 'Editions', 'Bijzondere Brickhunt-selecties en losse releases die niet netjes in een grote themalijn vallen. Goed om opvallende vondsten snel te vergelijken.', 140, true),
    ('fortnite', 'Fortnite', 'Fortnite', 'Battle Bus, lama’s en Fortnite-iconen als bouwset. Vergelijk hier de sets die het meest herkenbaar zijn uit de game.', 150, true),
    ('gabby-s-poppenhuis', 'Gabby''s Poppenhuis', 'Gabby''s Poppenhuis', 'Kattenkamers, poppenhuisplekken en vrolijke speelscenes. Kijk hier als je compacte sets zoekt met veel personages en accessoires.', 160, true),
    ('harry-potter', 'Harry Potter', 'Harry Potter', 'Hogwarts, Goudgrijp, Zweinstein Express en magische minifiguren. Vergelijk welke Harry Potter-set het best bij je plank of kasteel past.', 170, true),
    ('icons', 'Icons', 'Icons', 'Grote blikvangers, voertuigen, gebouwen en volwassen displaysets. Hier vergelijk je de sets die meteen de aandacht pakken op een plank.', 180, true),
    ('ideas', 'Ideas', 'Ideas', 'Fanideeen die echte LEGO-sets werden: van sitcomkamers tot kastelen en natuur. Vergelijk Ideas als je iets zoekt met een duidelijk verhaal.', 190, true),
    ('jurassic-world', 'Jurassic World', 'Jurassic World', 'Dinosaurussen, jeeps, labs en filmactie. Kijk hier als je vooral dino’s, voertuigen en herkenbare Jurassic-scenes wilt vergelijken.', 200, true),
    ('lord-of-the-rings', 'Lord of the Rings', 'Lord of the Rings', 'Rivendell, Barad-dur en Middle-earth als grote displaybouw. Vergelijk deze sets op uitstraling, minifiguren en plek op de plank.', 210, true),
    ('marvel', 'Marvel', 'Marvel', 'Avengers, Spider-Man, X-Men en bouwbare Marvel-iconen. Vergelijk scenes, voertuigen en figuren als je helden in je collectie zoekt.', 220, true),
    ('minecraft', 'Minecraft', 'Minecraft', 'Biomes, mobs, huizen en herkenbare blokwerelden. Vergelijk Minecraft-sets als je vooral speelbaarheid en bekende gameplekken zoekt.', 230, true),
    ('ninjago', 'NINJAGO', 'NINJAGO', 'Draken, mechs, tempels en ninja-voertuigen. Hier zie je snel welke NINJAGO-set het meeste actie, formaat of displaywaarde biedt.', 240, true),
    ('one-piece', 'One Piece', 'One Piece', 'Schepen, piraten en bekende momenten uit One Piece. Vergelijk de sets op bemanning, formaat en hoe sterk ze als display werken.', 250, true),
    ('pokemon', 'Pokémon', 'Pokémon', 'Pokémon-sets en bouwbare favorieten zodra ze in de catalogus staan. Vergelijk straks op personage, formaat en verzamelwaarde.', 260, true),
    ('sonic-the-hedgehog', 'Sonic the Hedgehog', 'Sonic the Hedgehog', 'Sonic, Tails, loops en kleurrijke gamelevels. Vergelijk hier welke set het meeste snelheid, figuren en herkenbare details meebrengt.', 270, true),
    ('speed-champions', 'Speed Champions', 'Speed Champions', 'Compacte sportwagens en raceauto’s van bekende merken. Vergelijk Speed Champions op model, merk en hoe goed de auto in je rij past.', 280, true),
    ('star-wars', 'Star Wars', 'Star Wars', 'Schepen, helmen, droids en scenes uit de hele saga. Vergelijk Star Wars-sets op minifiguren, displaywaarde en welk tijdperk je verzamelt.', 290, true),
    ('super-mario', 'Super Mario', 'Super Mario', 'Mario, interactieve levels, karts en Nintendo-personages. Vergelijk welke Super Mario-set het leukst speelt of het best toont.', 300, true),
    ('technic', 'Technic', 'Technic', 'Auto’s, machines en modellen met functies die je echt bouwt. Vergelijk Technic op techniek, formaat en hoe indrukwekkend het model voelt.', 310, true),
    ('the-legend-of-zelda', 'The Legend of Zelda', 'The Legend of Zelda', 'Hyrule, Deku Tree en Zelda-iconen als displaybouw. Vergelijk sets op personages, scenes en hoe herkenbaar ze naast je games staan.', 320, true),
    ('wednesday', 'Wednesday', 'Wednesday', 'Wednesday, Nevermore en donkere decorstukken met veel karakter. Kijk hier voor sets die vooral door sfeer en details opvallen.', 330, true),
    ('wicked', 'Wicked', 'Wicked', 'Oz, Elphaba, Glinda en kleurrijke filmplekken. Vergelijk Wicked-sets op personages, decor en hoe goed ze als display werken.', 340, true),
    ('bluey', 'Bluey', 'Bluey', 'Bluey-speelsets zodra ze in de catalogus staan. Houd deze lijn apart zodat personages, huizen en kleine scenes later makkelijk te vergelijken zijn.', null, false),
    ('friends', 'Friends', 'Friends', 'Heartlake City, dieren, huizen en vriendschapsverhalen. Vergelijk Friends op personages, locaties en hoeveel speelruimte een set biedt.', null, false),
    ('looney-tunes', 'Looney Tunes', 'Looney Tunes', 'Looney Tunes-figuren en verzamelsets wanneer ze beschikbaar zijn. Handig om Bugs, Daffy en andere klassiekers los te volgen.', null, false),
    ('duplo-peppa-pig', 'DUPLO Peppa Pig', 'DUPLO Peppa Pig', 'DUPLO Peppa Pig bundelt peutervriendelijke huizen, voertuigen en figuren. Activeer deze pas wanneer er echte catalogusdekking is.', null, false),
    ('education', 'Education', 'Education', 'Educatieve LEGO-sets voor klas, techniek en programmeeropdrachten. Vergelijk deze apart wanneer school- en leerproducten in de catalogus staan.', null, false),
    ('powered-up', 'Powered UP', 'Powered UP', 'Motoren, hubs en onderdelen voor bewegende builds. Deze categorie blijft apart zodat uitbreidingen niet tussen gewone sets verdwijnen.', null, false),
    ('serious-play', 'Serious Play', 'Serious Play', 'Serious Play-sets zijn bedoeld voor sessies, ideeen en teams. Alleen publiceren wanneer Brickhunt echte productdekking kan tonen.', null, false),
    ('shrek', 'Shrek', 'Shrek', 'Shrek, Donkey en sprookjesachtige bouwmomenten zodra ze beschikbaar zijn. Vergelijk deze lijn apart als er echte sets binnenkomen.', null, false),
    ('nike', 'Nike', 'Nike', 'Nike-samenwerkingen en sportieve displaysets horen bij elkaar zodra ze in de catalogus landen. Activeer pas met concrete producten.', null, false),
    ('monkie-kid', 'Monkie Kid', 'Monkie Kid', 'Mechs, voertuigen en kleurrijke actie uit Monkie Kid. Vergelijk deze lijn apart als de catalogus genoeg sets bevat.', null, false),
    ('braille-bricks', 'Braille Bricks', 'Braille Bricks', 'Braille Bricks combineert bouwen met letters en leren. Deze rij blijft voorbereid zonder lege publieke themapagina.', null, false)
),
active_theme_counts as (
  select
    catalog_sets.primary_theme_id as theme_id,
    count(*)::integer as active_set_count
  from public.catalog_sets
  where catalog_sets.status = 'active'
  group by catalog_sets.primary_theme_id
),
inserted_themes as (
  insert into public.catalog_themes (
    id,
    slug,
    display_name,
    public_display_name,
    public_description,
    public_order,
    is_public,
    status
  )
  select
    'theme:' || lego_theme_seed.slug,
    lego_theme_seed.slug,
    lego_theme_seed.display_name,
    lego_theme_seed.public_display_name,
    lego_theme_seed.public_description,
    lego_theme_seed.public_order,
    false,
    'inactive'
  from lego_theme_seed
  where not exists (
    select 1
    from public.catalog_themes
    where catalog_themes.slug = lego_theme_seed.slug
  )
  on conflict (slug) do nothing
  returning slug
)
update public.catalog_themes
set
  public_display_name = coalesce(
    nullif(trim(public.catalog_themes.public_display_name), ''),
    lego_theme_seed.public_display_name
  ),
  public_description = case
    when nullif(trim(public.catalog_themes.public_description), '') is null
      or public.catalog_themes.public_description ilike 'Nieuw in Brickhunt.%'
      then lego_theme_seed.public_description
    else public.catalog_themes.public_description
  end,
  public_order = coalesce(
    public.catalog_themes.public_order,
    lego_theme_seed.public_order
  ),
  is_public = case
    when coalesce(
        (
          select active_theme_counts.active_set_count
          from active_theme_counts
          where active_theme_counts.theme_id = public.catalog_themes.id
        ),
        0
      ) > 0
      then true
    else public.catalog_themes.is_public
  end,
  status = case
    when coalesce(
        (
          select active_theme_counts.active_set_count
          from active_theme_counts
          where active_theme_counts.theme_id = public.catalog_themes.id
        ),
        0
      ) > 0
      then 'active'
    else public.catalog_themes.status
  end
from lego_theme_seed
where public.catalog_themes.slug = lego_theme_seed.slug;
