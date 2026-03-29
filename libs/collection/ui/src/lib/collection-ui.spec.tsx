import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OwnedSetToggleCard } from './collection-ui';

describe('OwnedSetToggleCard', () => {
  it('renders clear saved-state confirmation for owned sets', () => {
    const markup = renderToStaticMarkup(
      <OwnedSetToggleCard
        hasResolvedState
        isOwned
        setId="10316"
        successMessage="Saved to your owned collection. Your collector account updated immediately."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Saved to your owned collection.');
    expect(markup).toContain('Owned saved');
    expect(markup).toContain('Your collector account updated immediately.');
    expect(markup).toContain('Remove from owned');
  });
});
