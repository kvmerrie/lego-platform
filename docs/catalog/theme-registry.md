# Brickhunt Theme Registry

Brickhunt gebruikt Rebrickable en de catalogus als bron van waarheid voor
thema's. De Theme Registry is alleen een override-laag voor presentatie.

## Waarom

Rebrickable bevat theme names en parent/child structuur. Die data bepaalt in
principe welke productlijnen bestaan. Nieuwe geldige productlijnen, zoals Lord
of the Rings, hoeven daarom geen handmatige registry-entry te krijgen om op
Brickhunt zichtbaar te worden.

De registry bestaat voor uitzonderingen:

- publieke LEGO-schrijfwijze, zoals Star Wars™
- aliases voor oude of afwijkende bronnamen
- visibility overrides
- image, logo en kleur overrides
- featured/sort priority voor home

Catalog records worden hiervoor niet destructief gemigreerd.

## Canonical Mapping

Child themes mogen naar hun parent groeperen wanneer de Rebrickable-hierarchie
dat logisch maakt. Toy Story onder Disney wordt dus Disney. Advent onder City
kan City worden. Een productlijn die zelf centraal staat, blijft zichzelf:
Lord of the Rings blijft Lord of the Rings als er geen override bestaat.

Utility/source themes worden standaard verborgen via regels:

- Gear
- Books
- BrickLink Designer Program
- Powered UP
- SERIOUS PLAY

Toon zo'n thema alleen met een expliciete `isVisible: true` override.

## Override Toevoegen

Overrides staan in:

`libs/catalog/util/src/lib/theme-registry.ts`

Voeg alleen iets toe als presentatie of zichtbaarheid afwijkt van de catalogus.

Voorbeeld:

```ts
createThemeOverride({
  displayName: 'Sonic the Hedgehog™',
  aliases: ['Sonic The Hedgehog', 'Sonic the Hedgehog', 'Sonic'],
});
```

Voor een nieuw normaal thema hoef je meestal niets te doen.

## ImageSetId Kiezen

`imageSetId` wijst naar een bestaande catalog set die als theme tile beeld mag
dienen. Kies een set die:

- herkenbaar is voor het thema
- geen overwegend wit of leeg beeld heeft
- al in de catalogus staat
- ook op kleine tegels duidelijk blijft

Als de set niet in de huidige lijst zit, valt de theme tile terug op de
bestaande signature set of de eerste beschikbare setafbeelding.

## Homepage Sortering

Gebruik `sortPriority` en `isFeatured` voor populaire thema's op home. Lage
`sortPriority` komt eerst. Thema's zonder prioriteit vallen terug op set count
en daarna alfabetisch.

## Later

De registry heeft alvast velden voor `logoAsset` en `colorToken`. Die zijn
bedoeld voor toekomstige visuele verfijning, niet voor admin CRUD in deze stap.
