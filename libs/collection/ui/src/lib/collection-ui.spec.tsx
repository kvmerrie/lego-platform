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
        successMessage="Saved to your private owned collection. Your collector account is up to date."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Saved to your owned collection.');
    expect(markup).toContain('Owned saved');
    expect(markup).toContain('Private collector state');
    expect(markup).toContain('Your collector account is up to date.');
    expect(markup).toContain(
      'Public set facts and reviewed buying guidance stay unchanged for other visitors.',
    );
    expect(markup).toContain('Remove from owned');
  });
});
