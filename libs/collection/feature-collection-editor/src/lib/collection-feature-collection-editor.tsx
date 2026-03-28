import { listCollectionEditorSections } from '@lego-platform/collection/data-access';

export function CollectionFeatureCollectionEditor() {
  const collectionEditorSections = listCollectionEditorSections();

  return (
    <section className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Collection editor</p>
        <h2>
          CRUD-ready collection sections with space for future admin workflows.
        </h2>
      </header>
      <div className="surface-grid">
        {collectionEditorSections.map((collectionEditorSection) => (
          <article
            className="surface stack"
            key={collectionEditorSection.title}
          >
            <h3 className="surface-title">{collectionEditorSection.title}</h3>
            <p>{collectionEditorSection.description}</p>
            <ul className="list">
              {collectionEditorSection.fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export default CollectionFeatureCollectionEditor;
