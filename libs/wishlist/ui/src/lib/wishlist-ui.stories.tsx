import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@lego-platform/shared/ui';
import { CollectorWishlistPanel, WantedSetToggleCard } from './wishlist-ui';

const meta = {
  title: 'Wishlist/UI',
  parameters: {
    layout: 'padded',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ProductToggleStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        margin: '0 auto',
        maxWidth: '24rem',
      }}
    >
      <WantedSetToggleCard
        alertsEnabled={false}
        hasResolvedState
        isWanted={false}
        productIntent="price-alert"
        setId="10316"
        variant="product"
        onToggle={() => undefined}
      />
      <WantedSetToggleCard
        alertsEnabled
        followedSetCount={4}
        hasResolvedState
        isWanted
        productIntent="price-alert"
        successMessage="Je volgt nu de prijs van deze set."
        setId="10316"
        variant="product"
        onToggle={() => undefined}
      />
      <WantedSetToggleCard
        hasResolvedState
        isAuthenticated={false}
        isWanted={false}
        productIntent="price-alert"
        setId="10316"
        variant="product"
        onToggle={() => undefined}
      />
      <WantedSetToggleCard
        hasResolvedState={false}
        isWanted={false}
        productIntent="price-alert"
        setId="10316"
        variant="product"
        onToggle={() => undefined}
      />
    </div>
  ),
};

export const InlineToggleStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '0.75rem',
        margin: '0 auto',
        maxWidth: '18rem',
      }}
    >
      <WantedSetToggleCard
        hasResolvedState
        isWanted={false}
        productIntent="price-alert"
        setId="10316"
        variant="inline"
        onToggle={() => undefined}
      />
      <WantedSetToggleCard
        hasResolvedState
        isWanted
        productIntent="wishlist"
        setId="10316"
        variant="inline"
        onToggle={() => undefined}
      />
      <WantedSetToggleCard
        hasResolvedState
        isPending
        isWanted={false}
        productIntent="price-alert"
        setId="10316"
        variant="inline"
        onToggle={() => undefined}
      />
    </div>
  ),
};

export const DefaultToggleCardStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        margin: '0 auto',
        maxWidth: '28rem',
      }}
    >
      <WantedSetToggleCard
        hasResolvedState
        isWanted={false}
        setId="10316"
        successMessage="Deze set staat nu op je verlanglijst."
        onToggle={() => undefined}
      />
      <WantedSetToggleCard
        hasResolvedState
        isWanted
        setId="10316"
        onToggle={() => undefined}
      />
      <WantedSetToggleCard
        errorMessage="Je verlanglijst kon nu niet worden bijgewerkt."
        hasResolvedState={false}
        isWanted={false}
        setId="10316"
        onToggle={() => undefined}
      />
    </div>
  ),
};

export const CollectorPanelStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        margin: '0 auto',
        maxWidth: '40rem',
      }}
    >
      <CollectorWishlistPanel
        controls={<Button tone="ghost">Sorteer op prijs</Button>}
        state="populated"
        statusMessage="2 sets zijn nu interessant geprijsd."
        wantedCount={4}
      >
        <p>Rivendell</p>
        <p>Avengers Tower</p>
      </CollectorWishlistPanel>
      <CollectorWishlistPanel hiddenWantedCount={2} state="empty" />
      <CollectorWishlistPanel state="signed-out" />
    </div>
  ),
};
