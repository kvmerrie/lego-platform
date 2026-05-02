# Editorial Agent foundation

## Fase 2a

Deze fase zet de eerste echte extraction-laag neer voor de interne Editorial Agent.

We hebben nu:

- een gedeeld article component manifest
- redactionele writing guidelines
- een werkende `FeaturedSet` MDX embed
- een werkende `SetSpotlightList` MDX embed voor release roundups
- runtime-veilige `SetRail` MDX syntax met `setIds="72050, 72037"`
- een admin pagina die een publieke nieuws-URL kan analyseren
- server-side URL-validatie, safe fetch en article extraction
- deterministic fact detection voor setnummers, thema’s, keywords, rumor-signalen en prijzen
- een facts-contract dat latere AI- of matchingstappen kan voeden
- een deterministic MDX draft preview die bewust `draft` blijft

## Wat deze fase bewust nog niet doet

Nog niet in deze stap:

- automatische publicatie
- notificaties
- volledige AI article generation
- perfecte catalog matching of related-set ranking
- handmatige hero-upload flow

Alles blijft dus veilig in de analyse- en draftfase.

## Ondersteunde article components

Het manifest exporteert de huidige ondersteunde embeds voor artikel-MDX:

- `FeaturedSet`
- `SetSpotlightList`
- `SetRail`
- `Callout`
- `Faq`
- `ImageGallery`
- `ThemeLink`
- `ArticleCard`

Voor `SetRail` gebruikt de echte MDX API de prop `setIds`, niet `setNumbers`.
Voor generated MDX gebruiken we daarbij bewust de runtime-veilige stringvorm:

- `<SetRail title="..." setIds="72050, 72037" />`
- `<SetSpotlightList setIds="11506, 43301" />`

Niet de array-literal vorm die in deze MDX-route minder betrouwbaar rendert.

De bron van waarheid staat in:

- `/Users/k40390/dev/lego-builder/libs/content/util/src/lib/editorial-agent.ts`

## Redactionele regels

De mock output en toekomstige generatieflow moeten schrijven als een kritische LEGO-fan die helpt kiezen, niet als een zakelijke producttekst.

Belangrijk:

- title, description en eerste zin mogen niet allemaal met exact dezelfde setnaam beginnen
- gebruik de volledige setnaam maximaal één keer in de eerste zichtbare sectie
- de intro mag de titel niet opnieuw vertellen, maar moet meteen duidelijk maken wat er speelt
- gegenereerde alinea’s beginnen altijd met een hoofdletter
- de eerste twee alinea’s plus `FeaturedSet` moeten samen genoeg zijn om te snappen:
  - wat het nieuws is
  - voor wie dit leuk is
  - of je nu moet pakken of beter wacht
- `Wanneer kopen?` moet altijd concrete beslislogica geven
- zeg liever:
  - heb je genoeg punten en wilde je hem al: pak hem nu
  - moet je extra aankopen doen of punten forceren: laat hem lopen
- vermijd vage zinnen zoals:
  - als hij op je plank past
  - wachten is prima
  - fans die de grap meteen zien
- gebruik een `SetRail` alleen als er minimaal 2 betrouwbare related sets zijn
- gebruik voor `release_roundup` een `SetSpotlightList` als hoofdblok voor de gematchte sets
- zo’n rail is redactionele doorstroom en commerciële context, geen advertentieblok
- zet direct genoemde sets eerst, daarna pas sterke thematische of koopgerichte matches
- houd een related rail op maximaal 6 sets
- vermijd vlakke koppen zoals `Gerelateerde sets`
- fandom en herkenning mogen
- hype, generieke lof en AI-achtige producttaal niet

## Related rails

Een related `SetRail` is bedoeld om lezers logisch door te sturen naar sets die echt iets toevoegen:

- een aanvulling op de primary set
- een upgrade
- een logisch alternatief
- een zelfde scene, thema of fandom-haakje

Niet gebruiken:

- als er minder dan 2 betrouwbare matches zijn
- als de rail alleen maar willekeurige catalogusvulling wordt

Voorbeeld:

> Een Spiny Shell is leuk, maar hij wordt pas echt grappig als er ook een Mario of Luigi is om van de baan te kegelen.

Daarna pas:

`<SetRail title="Mario Kart-sets voor naast de Spiny Shell" setIds="72050, 72037" />`

## SetSpotlightList

`SetSpotlightList` is bedoeld voor discovery-content waarin meerdere sets zelf het hoofdverhaal zijn.

- geen carousel
- geen horizontale scroll
- sets staan rustig per themagroep in een eenvoudige responsive grid
- beeld is leidend; de lijst moet meer als editorial showcase voelen dan als datalijst
- alle exact gematchte sets mogen direct zichtbaar zijn
- onbekende setIds worden stil overgeslagen
- de lijst groepeert sets automatisch per thema, zodat je sneller per hoek van de releasegolf kunt scannen
- de grid blijft bewust eenvoudig en voorspelbaar:
  - desktop: 3 cards naast elkaar
  - tablet: 2 cards naast elkaar
  - mobiel: 1 card full-width
- per groep krijgt de sterkste set een deterministic highlight op basis van set- en contextsignalen
- de wrapper hergebruikt de bestaande Brickhunt set-card tiles in plaats van een apart article-card-systeem
- klikken op een afbeelding opent de bestaande Brickhunt gallery/lightbox over alle sets uit dezelfde `SetSpotlightList`
- de CTA hergebruikt de gewone Brickhunt set-CTA in plaats van een losse artikelknop
- generated MDX gebruikt ook hier de stringsyntax:
  - `<SetSpotlightList setIds="11506, 43301, 43304" />`

De editorial vibe komt hier dus vooral uit:

- grouping per thema
- beeld
- sectiekoppen en korte groepscopy

Niet uit fragiele masonry- of split-layouttrucs.

Praktisch verschil:

- `SetSpotlightList` = editorial discovery en vergelijken
- `SetRail` = navigatie, related sets en commerciële doorstroom

## Hero-afbeeldingen

`heroImage` is optioneel.

Dat betekent:

- als `heroImage` gevuld is, gebruiken we die gewoon
- als `heroImage` leeg is, gebruikt Brickhunt automatisch de afbeelding van de `primarySet`
- die `primarySet` leiden we af uit de eerste `<FeaturedSet ... />` in het artikel
- als ook daar geen beeld beschikbaar is, rendert het artikel zonder hero in plaats van te crashen

## URL extraction in fase 2a

De adminflow kan nu een publieke nieuws-URL analyseren en server-side facts teruggeven.

De extraction doet nu:

1. URL valideren
2. private of lokale adressen blokkeren
3. de bron veilig ophalen met timeout, redirectlimiet en response-size limiet
4. leesbare article text extraheren via `@mozilla/readability` + `jsdom`
5. fallbacken naar title/meta/body text als article parsing dun is
6. deterministic signals en facts opbouwen voor een latere AI- of matchingstap

## Veiligheidsregels

De URL-validatie accepteert alleen publieke `http`- en `https`-URL’s.

Geblokkeerd:

- lege URL’s
- `javascript:`
- `data:`
- `file:`
- `ftp:`
- `localhost`
- `127.0.0.0/8`
- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- `::1`
- `fc00::/7`
- link-local ranges waar praktisch

De fetchlaag gebruikt:

- timeout
- `BrickhuntEditorialAgent/0.1` als user-agent
- beperkte redirects
- beperkte response-grootte
- alleen bruikbare tekstcontent
- nette foutmeldingen zonder stacktraces in de admin UI

## Fact extraction contract

De analyse-output volgt nu dit contract:

```json
{
  "source": {
    "inputUrl": "",
    "finalUrl": "",
    "domain": "",
    "title": "",
    "description": "",
    "siteName": "",
    "byline": "",
    "language": "",
    "canonicalUrl": "",
    "extractedAt": "ISO_DATE",
    "textLength": 0
  },
  "facts": {
    "title": "",
    "summary": "",
    "theme": "",
    "setNumbers": [],
    "setNames": [],
    "releaseDate": "",
    "priceEUR": "",
    "isRumor": false,
    "keywords": [],
    "keyPoints": [],
    "uncertainClaims": []
  },
  "detected": {
    "setNumbers": [],
    "themes": [],
    "keywords": [],
    "prices": [],
    "rumorSignals": [],
    "dateSignals": []
  },
  "warnings": [],
  "extractedText": "",
  "extractedTextPreview": ""
}
```

## Beperkingen van deze fase

De deterministic extraction is bewust een eerste factslaag, geen perfecte einduitkomst.

Dat betekent:

- setnummers worden niet verzonnen
- thema-detectie is keyword-based
- setnamen zijn best effort
- catalog matching blijft exact en deterministic
- related sets worden nog niet slim gerankt
- MDX generation is template-based en nog niet AI-gestuurd

## Lokaal testen

1. Start `apps/api` en `apps/admin`.
2. Open de admin route `/editorial-agent`.
3. Plak een publieke artikel-URL.
4. Klik op `Analyseer URL`.
5. Controleer:
   - source panel
   - warnings
   - detected set numbers, themes, keywords en prijzen
   - extracted text preview
   - facts JSON
   - draft MDX preview

## Vervolgstappen

Logische vervolgstappen na fase 2a:

1. URL extraction verfijnen
2. claims en setnamen beter structureren
3. eenvoudige catalog matching toevoegen
4. AI laten schrijven tegen manifest + facts contract
5. AI laten schrijven tegen deze deterministic laag als dat later nodig blijkt

## Fase 2b

Bovenop de extractionlaag draait nu ook een kleine deterministic beslislaag.

Die doet vier dingen:

1. `articleType` bepalen
2. detected setnummers exact tegen de catalog matchen
3. een `primarySet` kiezen of bewust leeg laten
4. simpele `relatedCandidates` en een event fingerprint opbouwen

Belangrijk:

- geen AI
- geen fuzzy matching
- geen guesses
- geen complexe scoring

## Article type

De agent onderscheidt nu deze simpele types:

- `single_set_news`
- `gwp_reward`
- `release_roundup`
- `deal`
- `unknown`

Regels zijn bewust klein:

- één setnummer wijst meestal op `single_set_news`
- termen als `Insiders`, `reward` of `GWP` maken er `gwp_reward` van
- meerdere setnummers plus duidelijke datumsignalen maken er `release_roundup` van
- termen als `korting`, `deal` of `sale` maken er `deal` van

## Catalog matching

Setmatching is in fase 2b expres exact en deterministic.

We doen nu alleen:

- detected setnummers normaliseren
- exact zoeken op setnummer in de bestaande catalog
- matches en misses apart teruggeven

Dus:

- geen fuzzy naammatch
- geen thematische guesses
- geen AI-correcties

## Primary set en related candidates

De selectie blijft ook bewust simpel:

- `single_set_news` en `gwp_reward` pakken de eerste exacte catalog match
- `release_roundup` kiest standaard géén primary set
- alleen als één set duidelijk de titel draagt, mag die de `primarySet` worden
- `deal` pakt de eerste match

`relatedCandidates`:

- maximaal 6
- geen duplicates
- `primarySet` wordt uitgesloten
- volgorde blijft gelijk aan de gedetecteerde volgorde

## Event fingerprint

Om eenvoudige event-detectie mogelijk te maken, bouwen we nu een klein fingerprint-object:

- single set / reward / deal: meestal op setnummer
- roundup: op jaar-maand uit de gedetecteerde datumsignalen
- fallback: slug-achtige sleutel uit de brontitel

De huidige `findExistingEvent(...)` gebruikt alleen een simpele in-memory store. Dat is genoeg voor deze fase om de contractlaag en UI te bewijzen, maar nog geen echte persistentie.

## Admin-output in fase 2b

De admin pagina laat nu ook zien:

- `articleType`
- matched sets
- unmatched setnummers
- `primarySet`
- `relatedCandidates`
- event fingerprint
- of het event al bestaat

De nieuwe laag helpt dus vooral om de latere AI-flow betere input te geven, terwijl de admin nu al een veilig deterministic draft kan tonen.

## Fase 3

Fase 3 bouwt bovenop extraction + matching nu ook echte draft generation.

Belangrijk:

- output blijft altijd `draft`
- er is nog steeds geen publishflow
- er worden geen setIds verzonnen
- alleen exact gematchte catalog sets mogen in `FeaturedSet`, `SetSpotlightList` of `SetRail` landen

## Hoe draft generation nu werkt

De generator gebruikt nu alleen:

- `source`
- `facts`
- `detected`
- `matching.articleType`
- `matching.matchedSets`
- `matching.unmatchedSetNumbers`
- `primarySet`
- `relatedCandidates`
- de component manifest-regels
- de writing guidelines

De basisoutput is bewust deterministic en template-based.
Daar bovenop kan nu optioneel een AI rewrite-laag draaien die alleen de tekst oppoetst.

Belangrijk:

- de deterministic draft blijft de bron van waarheid
- de AI rewrite mag alleen de bestaande tekst natuurlijker maken
- structuur, componenten en setIds blijven vaststaan

## Strikte template-selectie

Template-keuze is nu hard gekoppeld aan `articleType`.

- `release_roundup` gebruikt alleen het roundup-template
- `single_set_news` en `gwp_reward` gebruiken alleen het single-set-template
- `deal` gebruikt alleen het deal-template
- `unknown` blijft op het voorzichtige fallback-template

Dat betekent ook:

- geen `SetSpotlightList` in `single_set_news` of `gwp_reward`
- geen maand-intro of roundup-jump-link in single-set-artikelen
- geen `theme: "Multiple"` buiten echte roundups
- geen cross-template leakage tussen roundup- en single-set-copy

Binnen het single-set-template zit nu ook een harde tonesplit:

- announcement-gedreven `single_set_news` blijft discovery-achtig
- `gwp_reward`, `deal` en decision-gedreven `single_set_news` blijven koopgericht

## Decision vs discovery

De draftgenerator maakt nu ook bewust verschil in toon per `articleType`.

Decision content:

- `gwp_reward`
- `deal`
- decision-gedreven `single_set_news`

Deze drafts blijven kritisch en koopgericht. Daar mag `Wanneer kopen?` dus concreet en beslissend zijn.

Discovery content:

- `release_roundup`
- `unknown`
- announcement-gedreven `single_set_news`

Deze drafts mogen lichter voelen. Een roundup hoeft niet elke alinea als koopadvies te gebruiken; plezier, herkenning en ontdekking mogen daar meer ruimte krijgen.

Voor single-set aankondigingen betekent dat:

- de nadruk ligt op wat er is aangekondigd
- `Wanneer verschijnt hij?` is belangrijker dan `Wanneer kopen?`
- rustig volgen wint van directe koopdruk
- headings zoals `Wat is er aangekondigd?` en `Voor wie is dit leuk?` passen daar beter dan harde kooptaal

Voor roundups betekent dat bijvoorbeeld:

- liever `dit is zo’n maand waarin je wishlist vanzelf langer wordt`
- liever `er is genoeg om vrolijk doorheen te bladeren`
- liever `dit zijn de releases waar je meteen even op klikt`

En juist niet:

- `shortlist`
- `ruis`
- `optimaliseren`
- `strategie`
- `budgetdiscipline`

De copy mag dus lichter en fan-gerichter zijn, maar hoeft zichzelf binnen één draft niet steeds met dezelfde formule te herhalen.

## AI rewrite / polish

Na de deterministic draft kan de adminflow nu optioneel een tweede stap draaien:

1. `generateEditorialMdxDraft(...)`
2. `rewriteDraftWithAI(...)`
3. output tonen of veilig terugvallen

De adminpagina heeft hiervoor een toggle:

- `AI polish` aan of uit

Als die stap aanstaat, krijgt het model:

- de volledige deterministic MDX
- `articleType`
- de bekende facts
- de bestaande writing guidelines

De AI is hier dus geen schrijver, maar een editor.

Doel:

- tekst natuurlijker maken
- zinnen vloeiender maken
- variatie toevoegen
- Brickhunt-gevoel versterken

Niet toegestaan:

- nieuwe headings
- nieuwe secties
- componenten toevoegen of verwijderen
- setIds aanpassen
- feiten, data, prijzen of setnummers veranderen

De prompt dwingt daarom af dat:

- headings exact gelijk blijven
- `<FeaturedSet />`, `<SetSpotlightList />` en `<SetRail />` exact blijven staan
- alleen de lopende tekst herschreven mag worden

## Rewrite guardrails en fallback

Na de AI-output valideren we altijd opnieuw of:

- de frontmatter gelijk bleef
- headings gelijk bleven
- dezelfde MDX componenten en props nog aanwezig zijn
- setnummers exact gelijk bleven

Als dat mislukt:

- wordt de rewrite afgekeurd
- valt de flow automatisch terug op de deterministic draft
- krijgt de admin een duidelijke warning, zonder stacktrace

De deterministic laag blijft dus altijd de waarheid.

## Draft guardrails

De generator houdt nu deze grenzen aan:

- `status` is altijd `draft`
- `sourceUrl` komt uit `source.finalUrl` of `source.inputUrl`
- `FeaturedSet` verschijnt alleen als er een betrouwbare `primarySet` is
- `SetSpotlightList` gebruikt alleen exact gematchte sets uit `matching.matchedSets`
- `release_roundup` gebruikt `SetSpotlightList` als hoofdblok en toont daarin alle exact gematchte sets
- `release_roundup` mag een subtiele jump-link naar de setsectie bevatten:
  - `[Bekijk meteen de nieuwe sets ↓](#nieuwe-sets-die-opvallen)`
- de highlight in `SetSpotlightList` wordt deterministic gekozen op basis van beschikbaarheid, prijs, formaat, thema en article-context
- `SetSpotlightList` hergebruikt de gewone Brickhunt set-card tiles; grouping en article-context zitten in de wrapper, niet in een los tweede card-systeem
- per-set teasers zijn bewust verwijderd/uitgesteld totdat daar sterkere redactionele input voor is
- `SetRail` verschijnt alleen bij minimaal 2 betrouwbare related candidates
- `SetRail` gebruikt altijd de runtime-veilige stringsyntax:
  - `<SetRail title="..." setIds="72050, 72037" />`
- `SetSpotlightList` gebruikt dezelfde stringsyntax:
  - `<SetSpotlightList setIds="11506, 43301" />`
- unmatched setnummers mogen niet in `FeaturedSet`, `SetSpotlightList` of `SetRail` terechtkomen
- `unknown`-artikelen blijven voorzichtig en laten embeds standaard weg
- AI rewrite mag alleen tekst wijzigen; structuur en componenten blijven exact gelijk

## Theme-regel voor roundups

Bij `release_roundup` kijkt de generator nu anders naar `theme`:

- meerdere gedetecteerde thema’s => `theme: "Multiple"`
- één duidelijk gedetecteerd thema => gebruik dat thema
- andere articleTypes houden de bestaande logica

Voor `theme: "Multiple"` gebruiken article `SetRail`s bewust de neutrale Brickhunt rail-styling, niet één van de themakleuren.

## Extraction robuustheid

De extractionlaag valt nu ook veiliger terug als een bron technisch rommelig is:

- Readability of DOM parsing mag falen zonder de hele flow te breken
- dan vallen we terug op meta title, meta description en zichtbare body text
- lange artikelen worden ingekort met warning in plaats van hard te crashen
- als catalog matching stukloopt, blijft de extraction leven en krijg je een warning in plaats van een generieke 500

Voorbeeldwarning:

- `De brontekst is ingekort voordat de fact extraction erop draaide.`
- `Catalog matching kon niet volledig worden uitgevoerd; deze analyse gebruikt alleen de extraction-signalen.`

## Gerichte catalog-import voor drafts

Vlak voor draft generation kan de Editorial Agent nu optioneel ontbrekende setnummers gericht proberen te importeren.

Belangrijk:

- dit gebeurt alleen voor exact gedetecteerde, nog niet gematchte setnummers
- er worden geen fake catalog records aangemaakt
- de flow gebruikt bestaande Rebrickable- en catalog-sync patronen
- na een geslaagde import loopt de matching opnieuw, zodat `primarySet`, `relatedCandidates` en `FeaturedSet` alleen op echte catalog data draaien

De volgorde is nu:

1. extraction en facts bouwen
2. exact matchen tegen de lokale catalogus
3. ontbrekende setnummers optioneel gericht importeren
4. opnieuw exact matchen
5. pas daarna het draft genereren

Guardrails:

- als import mislukt of een set niet bestaat, blijft die set buiten `FeaturedSet`, `SetSpotlightList` en `SetRail`
- warnings blijven expliciet, bijvoorbeeld:
  - `Set 40926 is genoemd in de bron, maar staat nog niet in de catalogus.`
- de draft gebruikt alleen sets die na import echt in de catalogus staan
- brede catalog-sync of handmatig verzonnen placeholders horen niet in deze stap

## Admin-output vanaf fase 3

Na `Analyseer URL` zie je nu:

- source
- warnings uit extraction
- facts
- detected signals
- matching
- event fingerprint
- catalog import status, inclusief `importedSets` en `stillMissingSetNumbers`
- generated MDX draft
- rewrite status
- deterministic origineel naast AI-polished versie als de rewrite gelukt is
- generation warnings

De copy-knop blijft gewoon bestaan.
