# Brickhunt Price Badge

Standalone WordPress/WooCommerce plugin voor de Brickhunt partner badge.

Fase 1 is bedoeld voor pilots met merchants zoals Unieke Bricks en Brickspoint. De plugin doet geen remote calls vanuit PHP. De productpagina rendert alleen de bestaande Brickhunt widget script tag.

## Installatie

1. Kopieer deze map naar `wp-content/plugins/brickhunt-badge`.
2. Activeer `Brickhunt Price Badge` in WordPress.
3. Zorg dat WooCommerce actief is. Zonder WooCommerce toont de plugin alleen een admin notice.
4. Ga naar `WooCommerce -> Brickhunt Badge`.
5. Vul de instellingen in en zet `Enable Brickhunt badge` aan.

## Instellingen

- `Enable Brickhunt badge`: zet automatische rendering op productpagina's aan of uit.
- `Merchant slug`: de Brickhunt merchant slug, bijvoorbeeld `uniekebricks` of `brickspoint`.
- `Badge mode`: `all`, `top3` of `winner`.
- `Layout`: `compact` of `card`.
- `Position`: `after_price`, `after_add_to_cart` of `product_meta`.
- `Brickhunt base URL`: standaard `https://www.brickhunt.nl`.

Het merchantdomein moet in Brickhunt op de whitelist staan. Anders geeft de Brickhunt API een `403` en rendert de widget niets.

## SKU mapping

Fase 1 gebruikt de WooCommerce SKU als LEGO-setnummer.

Voorbeelden:

- SKU `10316` -> `data-set-id="10316"`
- SKU `10316-1` -> `data-set-id="10316"`

Als de SKU leeg is of geen setnummer lijkt, rendert de badge niets.

## Product override

Op de product edit page staat een optioneel veld:

`Brickhunt set ID override`

Als dit veld gevuld is, gebruikt de plugin deze waarde boven de SKU. Dit is handig als de WooCommerce SKU intern anders is opgebouwd.

## Shortcode

Gebruik de shortcode als je de badge handmatig in een template, producttekst of page builder wilt plaatsen.

```text
[brickhunt_badge]
[brickhunt_badge set_id="10316"]
[brickhunt_badge set_id="10316" merchant="uniekebricks" mode="winner" layout="card"]
```

Zonder `set_id` gebruikt de shortcode de huidige WooCommerce product override of SKU. Zonder `merchant`, `mode` of `layout` gebruikt de shortcode de globale plugin settings.

## Packaging

Vanaf de repo-root:

```sh
cd plugins/woocommerce
zip -r brickhunt-price-badge.zip brickhunt-badge -x "*/.DS_Store"
```

Of vanuit deze plugin-map:

```sh
sh package.sh
```

De output heet `brickhunt-price-badge.zip`.

## Troubleshooting

### Badge verschijnt niet

Controleer:

- `Enable Brickhunt badge` staat aan.
- `Merchant slug` is ingevuld.
- Het product heeft een SKU of Brickhunt set ID override.
- De SKU lijkt op `10316` of `10316-1`.
- De gekozen positie bestaat in het actieve WooCommerce theme.
- Brickhunt heeft prijsdata voor deze set en merchant.

### 403 door domein whitelist

De Brickhunt API geeft `403` als het merchantdomein niet op de allowed origins staat. CORS-fouten betekenen meestal hetzelfde: de browser-origin is niet gewhitelist.

Voeg het productie- of stagingdomein toe aan de Brickhunt merchant-config. Voor tests in WordPress Playground moet `https://playground.wordpress.net` tijdelijk op de Brickhunt `partnerWidget.allowedOrigins` staan.

### 204 door geen prijsdata of mode mismatch

De widget rendert niets bij `204`. Dat kan kloppen wanneer:

- Brickhunt geen actuele prijs voor de merchant heeft.
- `mode="winner"` is gekozen, maar de merchant niet de laagste prijs heeft.
- `mode="top3"` is gekozen, maar de merchant buiten de top 3 valt.

### WooCommerce niet actief

De plugin activeert zonder fatal error, maar toont een admin notice. Activeer WooCommerce om settings, shortcode en product rendering te gebruiken.

## Handmatige testcases

- Plugin activeert zonder fatal error.
- WooCommerce ontbreekt -> admin notice.
- `enabled=false` -> geen output op productpagina.
- Merchant slug leeg -> geen output.
- SKU leeg -> geen output.
- SKU `10316` -> script bevat `data-set-id="10316"`.
- SKU `10316-1` -> script bevat `data-set-id="10316"`.
- Mode en layout instellingen komen terug in de script tag.
- Shortcode rendert met `set_id`, `merchant`, `mode` en `layout` overrides.
- Product set ID override wint van SKU.

## Pilotnotitie

Voor Unieke Bricks en Brickspoint:

- Zet de SKU op het LEGO-setnummer, of vul het product override veld.
- Gebruik meestal `mode="all"` en `layout="compact"` naast de prijs of add-to-cart.
- Test altijd op een echte productpagina met een gewhitelist domein.
