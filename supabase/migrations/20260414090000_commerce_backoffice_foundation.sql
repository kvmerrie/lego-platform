create table if not exists public.commerce_merchants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_active boolean not null default true,
  source_type text not null default 'direct' check (
    source_type in ('direct', 'affiliate', 'marketplace')
  ),
  affiliate_network text null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_offer_seeds (
  id uuid primary key default gen_random_uuid(),
  set_id text not null,
  merchant_id uuid not null references public.commerce_merchants(id) on delete cascade,
  product_url text not null,
  is_active boolean not null default true,
  validation_status text not null default 'pending' check (
    validation_status in ('pending', 'valid', 'invalid', 'stale')
  ),
  last_verified_at timestamptz null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (set_id, merchant_id)
);

create table if not exists public.commerce_offer_latest (
  id uuid primary key default gen_random_uuid(),
  offer_seed_id uuid not null unique references public.commerce_offer_seeds(id) on delete cascade,
  price_minor integer null check (price_minor is null or price_minor > 0),
  currency_code text null,
  availability text null,
  fetch_status text not null default 'pending' check (
    fetch_status in ('pending', 'success', 'unavailable', 'error')
  ),
  observed_at timestamptz null,
  fetched_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists commerce_merchants_is_active_idx
on public.commerce_merchants (is_active);

create index if not exists commerce_offer_seeds_merchant_id_idx
on public.commerce_offer_seeds (merchant_id);

create index if not exists commerce_offer_seeds_set_id_idx
on public.commerce_offer_seeds (set_id);

create index if not exists commerce_offer_seeds_is_active_idx
on public.commerce_offer_seeds (is_active);

drop trigger if exists set_commerce_merchants_updated_at on public.commerce_merchants;
create trigger set_commerce_merchants_updated_at
before update on public.commerce_merchants
for each row
execute function public.set_updated_at();

drop trigger if exists set_commerce_offer_seeds_updated_at on public.commerce_offer_seeds;
create trigger set_commerce_offer_seeds_updated_at
before update on public.commerce_offer_seeds
for each row
execute function public.set_updated_at();

drop trigger if exists set_commerce_offer_latest_updated_at on public.commerce_offer_latest;
create trigger set_commerce_offer_latest_updated_at
before update on public.commerce_offer_latest
for each row
execute function public.set_updated_at();

alter table public.commerce_merchants enable row level security;
alter table public.commerce_offer_seeds enable row level security;
alter table public.commerce_offer_latest enable row level security;

with merchant_seed_values (
  slug,
  name,
  is_active,
  source_type,
  affiliate_network,
  notes
) as (
  values
  ('lego-nl', 'LEGO', true, 'direct', null, 'Direct brand purchase and reference pricing'),
  ('bol', 'bol', false, 'direct', null, 'Wide Dutch retail reach'),
  ('intertoys', 'Intertoys', true, 'direct', null, 'Strong toy-specialist relevance'),
  ('amazon-nl', 'Amazon', true, 'affiliate', 'Amazon Associates', 'Grote beschikbaarheid en snelle levering')
)
insert into public.commerce_merchants (
  slug,
  name,
  is_active,
  source_type,
  affiliate_network,
  notes
)
select
  merchant_seed_values.slug,
  merchant_seed_values.name,
  merchant_seed_values.is_active,
  merchant_seed_values.source_type,
  merchant_seed_values.affiliate_network,
  merchant_seed_values.notes
from merchant_seed_values
on conflict (slug) do update
set
  name = excluded.name,
  is_active = excluded.is_active,
  source_type = excluded.source_type,
  affiliate_network = excluded.affiliate_network,
  notes = excluded.notes;

with offer_seed_values (
  set_id,
  merchant_slug,
  product_url,
  last_verified_at
) as (
  values
  ('10316', 'amazon-nl', 'https://www.amazon.nl/LEGO-10316-Icons-LORD-RINGS/dp/B0BVMZ5NT5?crid=1PZX2UTHGPHQN&dib=eyJ2IjoiMSJ9.eV5BU8F5Ha1yyEu_F_vgmAq8ud289j12LwS936M_GLEQb2qBSlTJ0daClsdfbORpLFHahOSsox9ucg_dMXqRnWtEESZGcdk4rOgRf5ElQg5gopSMHRkiJyMDIguuVPHAhEcajIHvW5M27N2CXy9ilRIUJjJlsI9X5KKRAJp4I4Tc-v7Wca3KSZZ5jwHebrXhz_HpCpn4PEKuHLxjdTPluO74yAL9k4OeAnM0N9bUw9wL0BXaFJd1NRekk3_x6u_93FwiicKAu9zFUJG6FIeFBBDk9CenCrLyOMm793LMLfk.djPen0fBRza0RkXHY7s9nSUD5leeYbY5HwfzJg2uxZg&dib_tag=se&keywords=lego+lord+of+the+rings+barad-d%C3%BBr&qid=1775758479&sprefix=The+Lord+of+the+Rings%3A+Barad-d%C3%BBr%2Caps%2C88&sr=8-2&linkCode=ll2&tag=brickhunt09-21&linkId=527398c8997a060eeca3c83403d248bb&ref_=as_li_ss_tl', '2026-03-31T09:00:00.000Z'),
  ('10316', 'lego-nl', 'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316', '2026-03-31T09:08:00.000Z'),
  ('21348', 'lego-nl', 'https://www.lego.com/nl-nl/product/dungeons-dragons-red-dragons-tale-21348', '2026-03-31T09:20:00.000Z'),
  ('10305', 'amazon-nl', 'https://www.amazon.nl/LEGO-Icons-Knights-Castle-10305/dp/B0B5ZS6FTV?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=1ICB0EXP58149&dib=eyJ2IjoiMSJ9.4t2rJOMgQzWX0wkmffhwSDMyIymd-mpXx11baqPPlXUsf7_feo2R39-r7MnIU4TuoTvC2bt6eQk0i3cd9s6aoqUDbmfm1l6Wg1gE69PLjkkig_2Ztt9ByC08-ZVKNXvqOAb_GP8lhIMlMH0axkEk4w0dMRi8p63TY6dxQBs0sK0wbkZSEAojtg-jXz2ZzBR6mz0sIrCMcvEqOgvkqyZW7UflUBwy5-iaD8CsJg9jA82zo6XQAOsfwINz6bg51IfjZ495s641cJCCJvWk9DBjUXoOitcqxU3zo_4im7zBK6k.6MZaITTk3EQKDn-25lTC0rcNoWTCMTnzNJEvZocmGrg&dib_tag=se&keywords=lego+lion+knights+castle&qid=1775758964&sbo=RZvfv%2F%2FHxDF%2BO5021pAnSA%3D%3D&sprefix=lego+lion+knights%27+castle%2Caps%2C74&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=b8754cd43f594c6e5140ad43fc454573&ref_=as_li_ss_tl', '2026-03-31T09:40:00.000Z'),
  ('10305', 'lego-nl', 'https://www.lego.com/nl-nl/product/lion-knights-castle-10305', '2026-03-31T09:40:00.000Z'),
  ('10332', 'amazon-nl', 'https://www.amazon.nl/LEGO-kasteelset-uitgevonden-middeleeuwse-geschiedenisliefhebbers/dp/B0CPQ6VGB5?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=3IHN7HE0JBNXO&dib=eyJ2IjoiMSJ9.M_fWyqJXssoImZuDfuT9yx4AA_1mVSrbVQD-lvTz1pu2v4qYLlsUc_vNwueux2DwI--Xft4eeHmnOHRpA-Ba2ehEiy24nNg92G-rDwRTvUBqE17e0iH8KIZiQ9fFnHxuPr5NnzVoDhrOlgxQ4XU99AZDa3GTyAF8fet07xvBiIdfmIRMdL3MfDa54FKkx0YhPB5XL5j-Jbo_YWYlDEN_wI1K1YLlt5-sR7W2LnP5YigMksPEJGX0tPJOmoY7pbV8Uw_qjboynskE0H26lNFRkmA1xhmepUoX2-kYh-0pV5I.Aoz3JiwXQb1ubnGHnzYGDFFqP_0mO7J7g_tjdsxHXb0&dib_tag=se&keywords=lego+Medieval+Town+Square&qid=1775759032&sprefix=lego+medieval+town+square%2Caps%2C89&sr=8-2&linkCode=ll2&tag=brickhunt09-21&linkId=93c5419b273552f38488fb7254510c9a&ref_=as_li_ss_tl', '2026-03-31T09:44:00.000Z'),
  ('10332', 'lego-nl', 'https://www.lego.com/nl-nl/product/medieval-town-square-10332', '2026-03-31T09:52:00.000Z'),
  ('10333', 'amazon-nl', 'https://www.amazon.nl/LEGO-Icons-Lord-Rings-Volwassenen/dp/B0D5W8J5YV?crid=1PZX2UTHGPHQN&dib=eyJ2IjoiMSJ9.eV5BU8F5Ha1yyEu_F_vgmAq8ud289j12LwS936M_GLEQb2qBSlTJ0daClsdfbORpLFHahOSsox9ucg_dMXqRnWtEESZGcdk4rOgRf5ElQg5gopSMHRkiJyMDIguuVPHAhEcajIHvW5M27N2CXy9ilRIUJjJlsI9X5KKRAJp4I4Tc-v7Wca3KSZZ5jwHebrXhz_HpCpn4PEKuHLxjdTPluO74yAL9k4OeAnM0N9bUw9wL0BXaFJd1NRekk3_x6u_93FwiicKAu9zFUJG6FIeFBBDk9CenCrLyOMm793LMLfk.djPen0fBRza0RkXHY7s9nSUD5leeYbY5HwfzJg2uxZg&dib_tag=se&keywords=lego+lord+of+the+rings+barad-d%C3%BBr&qid=1775758479&sprefix=The+Lord+of+the+Rings%3A+Barad-d%C3%BBr%2Caps%2C88&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=658c1fea641d978ff43ab69afa307b35&ref_=as_li_ss_tl', '2026-03-31T09:56:00.000Z'),
  ('10333', 'lego-nl', 'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-barad-dur-10333', '2026-03-31T10:04:00.000Z'),
  ('10294', 'lego-nl', 'https://www.lego.com/nl-nl/product/titanic-10294', '2026-03-31T10:32:00.000Z'),
  ('21061', 'amazon-nl', 'https://www.amazon.nl/LEGO-Architecture-Notre-Dame-Volwassenen-21061/dp/B0CWH1M12W?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=3N5ABECN3HXTQ&dib=eyJ2IjoiMSJ9.Ck2hsK5S2D885Jw3QzGx2lWniVums1R9f-d89Ub8kZ4kbZLwVodNkizUSNtSZ1RgNh0VQDSEw_g2_Y5xY-9qhJjcBxEiwy_ZB-XMu1nqPHffTNSxh4DgOuvgCErbP8NHCDcoMN2Ey2MTNW3pZLPRIyxI2-E2TVGQb9UYaY4bYt30gxkwXYhKKuKoZoV-LyxiItHYlQyztd5Uosk4v5rSLN3rWKKVe8QUY2Ysg2HXqu0JSjub--j3vsvI9wXrBIA6HL648CzSeaMwY5i7fqTwtGA1xhmepUoX2-kYh-0pV5I.dsNy_D7bVfQxS6ccCuURwoRG60MkQfew_hw093CRfrs&dib_tag=se&keywords=lego+Notre-Dame+de+Paris&qid=1775761749&sprefix=lego+notre-dame+de+paris%2Caps%2C85&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=6e5049d70294abbb1c399672a647d026&ref_=as_li_ss_tl', '2026-03-31T10:36:00.000Z'),
  ('21061', 'lego-nl', 'https://www.lego.com/nl-nl/product/notre-dame-de-paris-21061', '2026-03-31T10:36:00.000Z'),
  ('21333', 'lego-nl', 'https://www.lego.com/nl-nl/product/vincent-van-gogh-the-starry-night-21333', '2026-03-31T10:16:00.000Z'),
  ('21349', 'lego-nl', 'https://www.lego.com/nl-nl/product/tuxedo-cat-21349', '2026-03-31T10:28:00.000Z'),
  ('76178', 'lego-nl', 'https://www.lego.com/nl-nl/product/daily-bugle-76178', '2026-03-31T10:48:00.000Z'),
  ('75367', 'amazon-nl', 'https://www.amazon.nl/LEGO-75367-Venator-klasse-Republiek-aanvalskruiser/dp/B0CGY4T856?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=13OQKBKYD4UBC&dib=eyJ2IjoiMSJ9.DikGzSgVz3L2UvdTJTeA__nu99iBlDTHnVYcUvmX6PJCijD9tJFAjLyIY6iE0vJXiMpbi3RT2xGu3htaJWDIyj2M1Uqtu9Pz3fiLT04mCjofsMeLPhJVGCREt3m__PaAJjeP3Tb19FtSIUtHXrmlhPcJp4OynKD8W774vpXbtduBKV3XxE-rHJkFmEb2aRXCaPAcnu4_qb0eJ7Y8cvQ-8qB_cRNEYHiI-7ytTXzR0vkjXKMjTSyWWkJWK4fPnRRMTHgW-TJL_R0G_kelncfKVsWFgxF9kqxwtrVWK5gK5oA.mdyyxNeUbbUclXu4XUFkvZvFV_kzM8T3Vx7kPAbPkuA&dib_tag=se&keywords=lego+Venator-Class+Republic+Attack+Cruiser&qid=1775760867&sprefix=lego+venator-class+republic+attack+cruiser%2Caps%2C74&sr=8-3&linkCode=ll2&tag=brickhunt09-21&linkId=a9e068da7d542c69f8a381fe8fa730c5&ref_=as_li_ss_tl', '2026-03-31T10:52:00.000Z'),
  ('75367', 'lego-nl', 'https://www.lego.com/nl-nl/product/venator-class-republic-attack-cruiser-75367', '2026-03-31T10:56:00.000Z'),
  ('21350', 'lego-nl', 'https://www.lego.com/nl-nl/product/jaws-21350', '2026-03-31T11:04:00.000Z'),
  ('10317', 'amazon-nl', 'https://www.amazon.nl/LEGO-10317-1984-Classic-Defender-onderdelen/dp/B0BSR933M2?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=C0VIB1H1Y0IK&dib=eyJ2IjoiMSJ9.xlYZ9NVh9to6gohBbw7JWDeYL2DCmoHRlkxu-qkrjizC0qTgdko33wv5Dunp_LcmG27FHYDP6Z3IW2xuRD9epO8NGQDo76Tp-6b80rSChuYTRO5gPQin2f1fqJemHYSGk4lKHA2GDyZFNf9AwuBnnXSkPHJrg3vtVdl4CW-NBxFT94FFUd6I0rC2smj2UcW94M7OE5Q3vFpPCcmBfAI79ZBsyXpD2sBG8nvqb_k4CE7ikS8Yn0Z42wRWNH_FVqQ2LN88j82jXr94l_-cyS6tJESwwrhP_VKAgwuoUxPwi4E.qHnjxzD8aWIVKxVZfyuQfnjSWSk8W02lfZ1zg_IJOHc&dib_tag=se&keywords=lego+Land+Rover+Classic+Defender+90&qid=1775759576&sprefix=lego+land+rover+classic+defender+90%2Caps%2C82&sr=8-3&linkCode=ll2&tag=brickhunt09-21&linkId=738343c26fcf121353d9ae5a178a228a&ref_=as_li_ss_tl', '2026-03-31T11:08:00.000Z'),
  ('10317', 'lego-nl', 'https://www.lego.com/nl-nl/product/land-rover-classic-defender-90-10317', '2026-03-31T11:12:00.000Z'),
  ('76269', 'intertoys', 'https://www.intertoys.nl/lego-marvel-avengers-toren-76269', '2026-03-31T09:30:00.000Z'),
  ('76269', 'lego-nl', 'https://www.lego.com/nl-nl/product/avengers-tower-76269', '2026-03-31T09:36:00.000Z'),
  ('75355', 'lego-nl', 'https://www.lego.com/nl-nl/product/x-wing-starfighter-75355', '2026-03-31T11:16:00.000Z'),
  ('75397', 'lego-nl', 'https://www.lego.com/nl-nl/product/jabbas-sail-barge-75397', '2026-03-31T11:20:00.000Z'),
  ('76429', 'amazon-nl', 'https://www.amazon.nl/LEGO-Sorteerhoed-Willekeurige-Volwassenen-76429/dp/B0CFVZNGK7?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=1PTINBDNZAUXS&dib=eyJ2IjoiMSJ9.MemGRaFmnhvTJL4x_rFJSvansAk_ibUyeCTE_iZPI2leEsPE48T_-1e7i-XUw5-v8DaJcZvYxAZH0eIb8-nMvfV4kGLMagTut4cV19WRryPXyKDZT8W1Z_3Ued_NYATmWe5cuBvfJM0pzgHkces7TEKCeXsus-WE91Y7OIPUlAAvxtm0VbZHmwK5XGxBImGm.mDJzd-ftbFkS8nQssur7AHULo5oprpr1E4Aig5JIOiA&dib_tag=se&keywords=lego+Talking+Sorting+Hat&qid=1775761168&sprefix=lego+talking+sorting+hat%2Caps%2C76&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=05c876c2c7e3b0134dec62cc6436c49a&ref_=as_li_ss_tl', '2026-03-31T11:24:00.000Z'),
  ('76429', 'lego-nl', 'https://www.lego.com/nl-nl/product/talking-sorting-hat-76429', '2026-03-31T11:24:00.000Z'),
  ('76435', 'amazon-nl', 'https://www.amazon.nl/LEGO-Harry-Potter-Kasteel-Zweinstein/dp/B0CWGPB8ZD?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=116VCQD5LM2P3&dib=eyJ2IjoiMSJ9.EoAJ4fNaKNq4A9FaSXdH3uIksvzGqN2IUFDNMuZq0dlz_ou7NIOOoNI6w6VuaqC7j7uUfowIbH9dX6tWbedtWL9EI6fwGRaNaDLV_xMrJAjpvLxsnTUZ49vwJ3hzTmhjsXWGYJa50BGuK5r8Vod0X_a_IeJ4hwoGrQkodWat7EwThVdR8ulkbn7vbcKjAIt-Eh6sUxVwEaSUcJeX6B78yj4IqvToCzIkJECikqh4ZZdiHrBKswsGwiI83xcNsTwGLwL79YvrojA4aixREuZbvVxK9MR7UE1AywF-2RH1qhQ.13UxpQ8EGYVT32fDmsYn0d2j31dG6f3BxypaQ-lO21M&dib_tag=se&keywords=lego+Hogwarts+Castle%3A+The+Great+Hall&qid=1775761122&sprefix=lego+hogwarts+castle+the+great+hall%2Caps%2C72&sr=8-10&linkCode=ll2&tag=brickhunt09-21&linkId=0fd89725960e92b0c59bcab9d6e493ac&ref_=as_li_ss_tl', '2026-03-31T11:28:00.000Z'),
  ('76435', 'lego-nl', 'https://www.lego.com/nl-nl/product/hogwarts-castle-the-great-hall-76435', '2026-03-31T11:28:00.000Z'),
  ('76294', 'lego-nl', 'https://www.lego.com/nl-nl/product/x-men-the-x-mansion-76294', '2026-03-31T11:32:00.000Z'),
  ('10335', 'lego-nl', 'https://www.lego.com/nl-nl/product/the-endurance-10335', '2026-03-31T11:36:00.000Z'),
  ('10327', 'lego-nl', 'https://www.lego.com/nl-nl/product/dune-atreides-royal-ornithopter-10327', '2026-03-31T11:40:00.000Z'),
  ('42171', 'lego-nl', 'https://www.lego.com/nl-nl/product/mercedes-amg-f1-w14-e-performance-42171', '2026-03-31T11:44:00.000Z'),
  ('42172', 'amazon-nl', 'https://www.amazon.nl/LEGO-Volwassenen-V8-zuigermotor-versnellingen-42172/dp/B0CWH3TBGB?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=ZW4BUOFTBJBU&dib=eyJ2IjoiMSJ9.R4beTgqecU3syKSMvBBLQROun8XkT9aQA6C-Osa-nKUiFN7gxhKPkzsISpwrUW0xG9BsVCYLnrCa4UjkiyoRttDZwDBPdbIRUQUJa-tIC6ZpVigNEsv6Ot2dnATzNMPnD_pCzVknc-mQvFyrVBl2aBhPeW06UNscn_WmRAxgXrsC6LXI-mXNGmbtSgb4JoyL_x9SF__Qrydo--LFGG7RlsvuUjFW4sECesWVNFAWPi5GnM5HY3Xqh7atuB4_MtX5raVzSpSflh_cGdscna3MHnMnwIjdZZ-lkFyVBG5575M._3TVhlUXY2i1hvgXB6vt-ndBnBtMsRGv6yRyZiy5bQw&dib_tag=se&keywords=lego+McLaren+P1&qid=1775761309&sprefix=lego+mclaren+p1%2Caps%2C82&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=6448fc045362a99b2cbb881f89de238a&ref_=as_li_ss_tl', '2026-03-31T11:48:00.000Z'),
  ('42172', 'lego-nl', 'https://www.lego.com/nl-nl/product/mclaren-p1-42172', '2026-03-31T11:48:00.000Z'),
  ('10328', 'amazon-nl', 'https://www.amazon.nl/LEGO-Rozenboeket-Moederdag-Cadeau-Ontspannende-10328/dp/B01MRT58RZ?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=1UMYAM33QP20Z&dib=eyJ2IjoiMSJ9.6UipO4ccJyOKV9iUuvWc9PTkgJFoE1YVeeaSiVQozDo5PToodlOOw-YVOHzNvze3YR7TqYvLMWqdyjL_I34nIown0UfNZ__MC9lj8At-8BZZoT3918Wf_WIx1r9NR3lVTVOL6Z32ro6y5o81U1EAWOgPXU82Y03AIbbbVoJtwTj-mtLNQPHfQz7aHOXrDT_IJ3U_vNXoVWGj7n8d4ABBi_B0QJZ0kyW9M5Ygh57d58Go2FN_bRnT_DQl_NAA5OgLPO0ihaO7c_YgadziAHx_S9fcwpRkuAXcnVoNdn_lR_w.kAa51h-RJlRKQcw4ynK8Nk6QtvHz5oFQAsTXVeAy3zA&dib_tag=se&keywords=lego%2BBouquet%2Bof%2BRoses&qid=1775761622&sprefix=lego%2Bbouquet%2Bof%2Broses%2Caps%2C84&sr=8-1&th=1&linkCode=ll2&tag=brickhunt09-21&linkId=fffcffbc7db5ec766045610079ec2ca7&ref_=as_li_ss_tl', '2026-03-31T11:52:00.000Z'),
  ('10328', 'lego-nl', 'https://www.lego.com/nl-nl/product/bouquet-of-roses-10328', '2026-03-31T11:52:00.000Z'),
  ('75398', 'lego-nl', 'https://www.lego.com/nl-nl/product/c-3po-75398', '2026-04-03T09:04:00.000Z'),
  ('76453', 'amazon-nl', 'https://www.amazon.nl/LEGO-Bouwpakket-Minifiguren-Voldermort-76453/dp/B0DHSBVGW6?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=GBTO4DTLEJYH&dib=eyJ2IjoiMSJ9.4-UJDXPjlq0pBJW9iJYZjbwBLQePXI2Yh-TtwyFRjEl7REwObZVn9Uz_ycR-_RyB6VghvMT7H8ifz_UHNa1LO9YlGMoFr0Ahrk2DnQTcAoxBaQR04MWC4NIOYB2Wamtix8ZR1kpdLTP1y_YTEcrsIN3wQx7oGjjixwiAmrBcrLWUbaL3hQ1fNotKT2Ietu7yVKN16FXPRasWcfnYSfAANiwGJQMQLreJkTSClIxiSVCGL1-WAAPfJurAPeGvNZWCbb6XaNg2TzNslJ_KiSsBZjsv3Vh9o1NE4gUPMGGaWdU.YQIKNdE-Z3H-DKQZiJQeiOFjIkrijgRzeoCFp9t0UzA&dib_tag=se&keywords=lego+Malfoy+Manor&qid=1775761086&sprefix=lego+malfoy+manor%2Caps%2C90&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=7b4e3ef9de3b484a9420d2f52d5abbd0&ref_=as_li_ss_tl', '2026-04-03T09:08:00.000Z'),
  ('76453', 'lego-nl', 'https://www.lego.com/nl-nl/product/malfoy-manor-76453', '2026-04-03T09:12:00.000Z'),
  ('76313', 'lego-nl', 'https://www.lego.com/nl-nl/product/marvel-logo-minifigures-76313', '2026-04-03T09:20:00.000Z'),
  ('10354', 'amazon-nl', 'https://www.amazon.nl/Lego-Auenland-Shire-10354-bedrukte/dp/B0FZBDWLT5?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=2AWWZ6F0AIB5R&dib=eyJ2IjoiMSJ9.eND83uolzMdoK3sUq15eYkuQfwAn8CDgs6YaNtI9eWCHIACPWsiF5paTyoxcRavIi31ifYAw2fDy7ftR_ZDVasbYbyEjLxg4k-35XU_RXl1yR0ky6RZfW7vxff69Zd3Pf7FfgP7zlZBR1HrH0tXMYc0cPTAUXZEyWESlUdoG6iVPe6S93yP2kExoP-3hQlXdxoNwmP67PBFobI_UpIbKZfdHEx9uuZKYjUGxVVcXWBTV4F4DQxoRsb61qTkkJYsVHkYVuqJo9ilYITOkwOSJBtCqJ0rznDV-ANLn7T-4j-g.Y-u8TEHEU7iBgySW13nL6njKwJiAO9n8FXvih3_EofI&dib_tag=se&keywords=lego+The+Lord+of+the+Rings%3A+The+Shire&qid=1775758663&sprefix=lego+the+lord+of+the+rings+the+shire%2Caps%2C147&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=66add913149e68e57c56f2536d98d169&ref_=as_li_ss_tl', '2026-04-03T09:24:00.000Z'),
  ('10354', 'lego-nl', 'https://www.lego.com/nl-nl/product/the-shire-10354', '2026-04-03T09:28:00.000Z'),
  ('42177', 'lego-nl', 'https://www.lego.com/nl-nl/product/mercedes-benz-g-500-professional-line-42177', '2026-04-03T09:36:00.000Z'),
  ('10342', 'amazon-nl', 'https://www.amazon.nl/LEGO-Kunstbloemen-Moederdag-Cadeau-Korenbloemen-10342/dp/B0DHSDBVKV?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=2VKL489BI1L2T&dib=eyJ2IjoiMSJ9.A1GmVVQOpYdf7LyrY1itSdQZTVTQBlEdf3DhVPMxS2KCkFrlGXPJXj8iklTmqIGoRC7mlVXzR6uo1W_ostSAg0jDvLnSna7lMjOGLUHwDAMH9cuO9g_7MHwdbrMYc3we_cFXy9SlkrGZmvwdUoe34c_UHb5iSB87vZ2ZUripe3wzIRCEZLxdJle-UBJv0TOhFlPsnY8e-ZaRPNW7ReJZh4xRKuYtcjwyTm6wb7wm3pwctntOshVAEhby_fG5ETaInajnYxwWbb3l6d56UiFfri9jPFm4Rw6eY3EzyXa6AsE.BNZ1NZBcftinCRtP6tOwnRjKRpCjkn1ZYsJEZ0OID6U&dib_tag=se&keywords=lego%2BPretty%2BPink%2BFlower%2BBouquet&qid=1775761545&sprefix=lego%2Bpretty%2Bpink%2Bflower%2Bbouquet%2Caps%2C118&sr=8-1&th=1&linkCode=ll2&tag=brickhunt09-21&linkId=99b548fd63b2c581fa1aa9659cb9e0fe&ref_=as_li_ss_tl', '2026-04-03T09:40:00.000Z'),
  ('10342', 'lego-nl', 'https://www.lego.com/nl-nl/product/pretty-pink-flower-bouquet-10342', '2026-04-03T09:44:00.000Z')
)
insert into public.commerce_offer_seeds (
  set_id,
  merchant_id,
  product_url,
  is_active,
  validation_status,
  last_verified_at,
  notes
)
select
  offer_seed_values.set_id,
  commerce_merchants.id,
  offer_seed_values.product_url,
  true,
  'valid',
  offer_seed_values.last_verified_at::timestamptz,
  ''
from offer_seed_values
join public.commerce_merchants
  on commerce_merchants.slug = offer_seed_values.merchant_slug
on conflict (set_id, merchant_id) do update
set
  product_url = excluded.product_url,
  is_active = excluded.is_active,
  validation_status = excluded.validation_status,
  last_verified_at = excluded.last_verified_at,
  notes = excluded.notes;

with latest_offer_values (
  set_id,
  merchant_slug,
  price_minor,
  currency_code,
  availability,
  fetch_status,
  observed_at,
  fetched_at
) as (
  values
  ('10316', 'amazon-nl', 48246, 'EUR', 'in_stock', 'success', '2026-03-31T09:00:00.000Z', '2026-03-31T09:00:00.000Z'),
  ('10316', 'lego-nl', 49999, 'EUR', 'in_stock', 'success', '2026-03-31T09:08:00.000Z', '2026-03-31T09:08:00.000Z'),
  ('21348', 'lego-nl', 35999, 'EUR', 'in_stock', 'success', '2026-03-31T09:20:00.000Z', '2026-03-31T09:20:00.000Z'),
  ('10305', 'amazon-nl', 60900, 'EUR', 'in_stock', 'success', '2026-03-31T09:40:00.000Z', '2026-03-31T09:40:00.000Z'),
  ('10305', 'lego-nl', 38999, 'EUR', 'in_stock', 'success', '2026-03-31T09:40:00.000Z', '2026-03-31T09:40:00.000Z'),
  ('10332', 'amazon-nl', 30185, 'EUR', 'in_stock', 'success', '2026-03-31T09:44:00.000Z', '2026-03-31T09:44:00.000Z'),
  ('10332', 'lego-nl', 22999, 'EUR', 'in_stock', 'success', '2026-03-31T09:52:00.000Z', '2026-03-31T09:52:00.000Z'),
  ('10333', 'amazon-nl', 43558, 'EUR', 'in_stock', 'success', '2026-03-31T09:56:00.000Z', '2026-03-31T09:56:00.000Z'),
  ('10333', 'lego-nl', 45999, 'EUR', 'in_stock', 'success', '2026-03-31T10:04:00.000Z', '2026-03-31T10:04:00.000Z'),
  ('10294', 'lego-nl', 65999, 'EUR', 'in_stock', 'success', '2026-03-31T10:32:00.000Z', '2026-03-31T10:32:00.000Z'),
  ('21061', 'amazon-nl', 17240, 'EUR', 'in_stock', 'success', '2026-03-31T10:36:00.000Z', '2026-03-31T10:36:00.000Z'),
  ('21061', 'lego-nl', 21999, 'EUR', 'in_stock', 'success', '2026-03-31T10:36:00.000Z', '2026-03-31T10:36:00.000Z'),
  ('21333', 'lego-nl', 16999, 'EUR', 'in_stock', 'success', '2026-03-31T10:16:00.000Z', '2026-03-31T10:16:00.000Z'),
  ('21349', 'lego-nl', 10999, 'EUR', 'in_stock', 'success', '2026-03-31T10:28:00.000Z', '2026-03-31T10:28:00.000Z'),
  ('76178', 'lego-nl', 33999, 'EUR', 'in_stock', 'success', '2026-03-31T10:48:00.000Z', '2026-03-31T10:48:00.000Z'),
  ('75367', 'amazon-nl', 64999, 'EUR', 'in_stock', 'success', '2026-03-31T10:52:00.000Z', '2026-03-31T10:52:00.000Z'),
  ('75367', 'lego-nl', 64999, 'EUR', 'in_stock', 'success', '2026-03-31T10:56:00.000Z', '2026-03-31T10:56:00.000Z'),
  ('21350', 'lego-nl', 15999, 'EUR', 'in_stock', 'success', '2026-03-31T11:04:00.000Z', '2026-03-31T11:04:00.000Z'),
  ('10317', 'amazon-nl', 29102, 'EUR', 'in_stock', 'success', '2026-03-31T11:08:00.000Z', '2026-03-31T11:08:00.000Z'),
  ('10317', 'lego-nl', 23999, 'EUR', 'in_stock', 'success', '2026-03-31T11:12:00.000Z', '2026-03-31T11:12:00.000Z'),
  ('76269', 'intertoys', 47999, 'EUR', 'limited', 'success', '2026-03-31T09:30:00.000Z', '2026-03-31T09:30:00.000Z'),
  ('76269', 'lego-nl', 49999, 'EUR', 'in_stock', 'success', '2026-03-31T09:36:00.000Z', '2026-03-31T09:36:00.000Z'),
  ('75355', 'lego-nl', 23999, 'EUR', 'in_stock', 'success', '2026-03-31T11:16:00.000Z', '2026-03-31T11:16:00.000Z'),
  ('75397', 'lego-nl', 49999, 'EUR', 'in_stock', 'success', '2026-03-31T11:20:00.000Z', '2026-03-31T11:20:00.000Z'),
  ('76429', 'amazon-nl', 7490, 'EUR', 'in_stock', 'success', '2026-03-31T11:24:00.000Z', '2026-03-31T11:24:00.000Z'),
  ('76429', 'lego-nl', 9999, 'EUR', 'in_stock', 'success', '2026-03-31T11:24:00.000Z', '2026-03-31T11:24:00.000Z'),
  ('76435', 'amazon-nl', 14932, 'EUR', 'in_stock', 'success', '2026-03-31T11:28:00.000Z', '2026-03-31T11:28:00.000Z'),
  ('76435', 'lego-nl', 19999, 'EUR', 'in_stock', 'success', '2026-03-31T11:28:00.000Z', '2026-03-31T11:28:00.000Z'),
  ('76294', 'lego-nl', 32999, 'EUR', 'in_stock', 'success', '2026-03-31T11:32:00.000Z', '2026-03-31T11:32:00.000Z'),
  ('10335', 'lego-nl', 26999, 'EUR', 'in_stock', 'success', '2026-03-31T11:36:00.000Z', '2026-03-31T11:36:00.000Z'),
  ('10327', 'lego-nl', 16499, 'EUR', 'in_stock', 'success', '2026-03-31T11:40:00.000Z', '2026-03-31T11:40:00.000Z'),
  ('42171', 'lego-nl', 21999, 'EUR', 'in_stock', 'success', '2026-03-31T11:44:00.000Z', '2026-03-31T11:44:00.000Z'),
  ('42172', 'amazon-nl', 31999, 'EUR', 'in_stock', 'success', '2026-03-31T11:48:00.000Z', '2026-03-31T11:48:00.000Z'),
  ('42172', 'lego-nl', 44999, 'EUR', 'in_stock', 'success', '2026-03-31T11:48:00.000Z', '2026-03-31T11:48:00.000Z'),
  ('10328', 'amazon-nl', 4599, 'EUR', 'in_stock', 'success', '2026-03-31T11:52:00.000Z', '2026-03-31T11:52:00.000Z'),
  ('10328', 'lego-nl', 5999, 'EUR', 'in_stock', 'success', '2026-03-31T11:52:00.000Z', '2026-03-31T11:52:00.000Z'),
  ('75398', 'lego-nl', 13999, 'EUR', 'in_stock', 'success', '2026-04-03T09:04:00.000Z', '2026-04-03T09:04:00.000Z'),
  ('76453', 'amazon-nl', 11999, 'EUR', 'in_stock', 'success', '2026-04-03T09:08:00.000Z', '2026-04-03T09:08:00.000Z'),
  ('76453', 'lego-nl', 14999, 'EUR', 'in_stock', 'success', '2026-04-03T09:12:00.000Z', '2026-04-03T09:12:00.000Z'),
  ('76313', 'lego-nl', 9999, 'EUR', 'in_stock', 'success', '2026-04-03T09:20:00.000Z', '2026-04-03T09:20:00.000Z'),
  ('10354', 'amazon-nl', 43896, 'EUR', 'in_stock', 'success', '2026-04-03T09:24:00.000Z', '2026-04-03T09:24:00.000Z'),
  ('10354', 'lego-nl', 26999, 'EUR', 'in_stock', 'success', '2026-04-03T09:28:00.000Z', '2026-04-03T09:28:00.000Z'),
  ('42177', 'lego-nl', 24999, 'EUR', 'in_stock', 'success', '2026-04-03T09:36:00.000Z', '2026-04-03T09:36:00.000Z'),
  ('10342', 'amazon-nl', 4399, 'EUR', 'in_stock', 'success', '2026-04-03T09:40:00.000Z', '2026-04-03T09:40:00.000Z'),
  ('10342', 'lego-nl', 5999, 'EUR', 'in_stock', 'success', '2026-04-03T09:44:00.000Z', '2026-04-03T09:44:00.000Z')
)
insert into public.commerce_offer_latest (
  offer_seed_id,
  price_minor,
  currency_code,
  availability,
  fetch_status,
  observed_at,
  fetched_at
)
select
  commerce_offer_seeds.id,
  latest_offer_values.price_minor,
  latest_offer_values.currency_code,
  latest_offer_values.availability,
  latest_offer_values.fetch_status,
  latest_offer_values.observed_at::timestamptz,
  latest_offer_values.fetched_at::timestamptz
from latest_offer_values
join public.commerce_merchants
  on commerce_merchants.slug = latest_offer_values.merchant_slug
join public.commerce_offer_seeds
  on commerce_offer_seeds.set_id = latest_offer_values.set_id
 and commerce_offer_seeds.merchant_id = commerce_merchants.id
on conflict (offer_seed_id) do update
set
  price_minor = excluded.price_minor,
  currency_code = excluded.currency_code,
  availability = excluded.availability,
  fetch_status = excluded.fetch_status,
  observed_at = excluded.observed_at,
  fetched_at = excluded.fetched_at;
