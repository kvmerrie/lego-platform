import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WantedSetToggleCard } from './wishlist-ui';

describe('WantedSetToggleCard', () => {
  it('renders clear saved-state confirmation for wanted sets', () => {
    const markup = renderToStaticMarkup(
      <WantedSetToggleCard
        hasResolvedState
        isWanted
        setId="21348"
        successMessage="Saved to your wanted list. Your collector account updated immediately."
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('Saved to your wanted list.');
    expect(markup).toContain('Wanted saved');
    expect(markup).toContain('Your collector account updated immediately.');
    expect(markup).toContain('Remove from wanted');
  });
});
