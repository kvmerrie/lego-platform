import { listCatalogThemes } from '@lego-platform/catalog/data-access';
import { CatalogThemeHighlight } from '@lego-platform/catalog/ui';

export function CatalogFeatureThemeList() {
  const catalogThemeSnapshots = listCatalogThemes();

  return (
    <section className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Theme coverage</p>
        <h2>
          Theme snapshots stay isolated from page logic and ready for CMS-driven
          expansion.
        </h2>
      </header>
      <div className="surface-grid">
        {catalogThemeSnapshots.map((catalogThemeSnapshot) => (
          <CatalogThemeHighlight
            key={catalogThemeSnapshot.name}
            themeSnapshot={catalogThemeSnapshot}
          />
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureThemeList;
