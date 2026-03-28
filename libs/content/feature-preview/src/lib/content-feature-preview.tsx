import { getPreviewPanel } from '@lego-platform/content/data-access';

export function ContentFeaturePreview() {
  const previewPanel = getPreviewPanel();

  return (
    <section className="surface split-card">
      <div className="stack">
        <p className="eyebrow">Preview flow</p>
        <h2 className="surface-title">{previewPanel.status}</h2>
        <p>{previewPanel.summary}</p>
      </div>
      <p className="muted">Updated {previewPanel.updatedAt}</p>
    </section>
  );
}

export default ContentFeaturePreview;
