# Brickhunt for WooCommerce

**Independent LEGO price validation for WooCommerce stores.**

Brickhunt for WooCommerce helps LEGO retailers build trust by automatically displaying independent Brickhunt price validation badges on WooCommerce product pages.

Depending on the current market position, Brickhunt can show whether a product price has been:

- ✅ Checked
- 🏆 Validated as a Top Offer
- 🥇 Validated as the Best Price

The plugin is lightweight, requires minimal configuration and loads the existing Brickhunt widget through WordPress script enqueueing without performing remote API requests from PHP.

---

## Features

- Independent LEGO price validation
- Automatic WooCommerce integration
- Automatic SKU-to-LEGO-set mapping
- Product-level Brickhunt Set ID Override
- Compact and Card layouts
- Configurable display modes (`all`, `top3`, `winner`)
- Shortcode support
- Secure merchant domain validation
- WordPress-conform script enqueueing
- No remote API calls from PHP
- HPOS / Custom Order Tables compatible

---

## Installation

1. Copy this plugin to:

   ```
   wp-content/plugins/brickhunt-badge
   ```

2. Activate **Brickhunt for WooCommerce**.

3. Make sure WooCommerce is installed and activated.

4. Navigate to:

   ```
   WooCommerce → Brickhunt
   ```

5. Configure:
   - Enable badge
   - Merchant slug
   - Badge mode
   - Layout
   - Position

6. Save your settings.

---

## Settings

### Enable badge

Enables automatic rendering of Brickhunt badges on WooCommerce product pages.

### Merchant slug

Enter your Brickhunt merchant slug.

Examples:

- `uniekebricks`
- `brickspoint`

If you don't know your merchant slug, visit:

https://www.brickhunt.nl/winkels

or contact:

hello@brickhunt.nl

### Badge mode

Available modes:

- `all`
- `top3`
- `winner`

### Layout

Choose between:

- Compact
- Card

### Position

Available positions:

- After price
- After Add to Cart
- Product meta

---

## SKU Mapping

By default, the plugin uses the WooCommerce SKU as the LEGO set number.

Examples:

| WooCommerce SKU | Brickhunt Set ID |
| --------------- | ---------------- |
| 10316           | 10316            |
| 10316-1         | 10316            |
| 75313           | 75313            |

If the SKU is empty or does not contain a valid LEGO set number, no badge will be rendered.

---

## Product Override

Each WooCommerce product includes an optional field:

**Brickhunt Set ID Override**

When configured, this value takes precedence over the WooCommerce SKU.

This is useful when internal SKUs differ from official LEGO set numbers.

---

## Shortcode

The badge can also be rendered manually.

Examples:

```text
[brickhunt_badge]

[brickhunt_badge set_id="10316"]

[brickhunt_badge
    set_id="10316"
    merchant="uniekebricks"
    mode="winner"
    layout="card"]
```

Without a `set_id`, the shortcode automatically uses the current product's override or SKU.

Without `merchant`, `mode` or `layout`, the global plugin settings are used.

The shortcode uses the same WordPress-enqueued Brickhunt widget script as the automatic product-page integration.

---

## Packaging

Create a release ZIP by running:

```sh
cd plugins/woocommerce/brickhunt-badge
sh package.sh
```

The generated ZIP is intended for WordPress.org plugin submission. It contains the runtime plugin files and documentation, but excludes `package.sh` and WordPress.org directory assets such as icons, banners and screenshots.

Keep the files in `assets/` in the repository. After approval, upload icons, banners and screenshots separately through the WordPress.org SVN assets flow.

---

## Troubleshooting

### The badge does not appear

Check the following:

- The plugin is enabled.
- A merchant slug has been configured.
- The product has a valid SKU or Brickhunt Set ID Override.
- The selected WooCommerce hook exists in your theme.
- Brickhunt has price data available for this merchant and LEGO set.

---

### 403 Forbidden

A **403** response usually means the current domain has not yet been approved in the Brickhunt partner configuration.

This also results in a browser CORS error.

For local or staging environments, add the corresponding domain to the Brickhunt merchant allowlist.

For WordPress Playground testing, temporarily allow:

```
https://playground.wordpress.net
```

---

### 204 No Content

A **204** response is expected when:

- Brickhunt has no price data for this merchant.
- `winner` mode is selected but the merchant is not the lowest-priced offer.
- `top3` mode is selected but the merchant is not ranked within the top three.

In these cases the widget intentionally renders nothing.

---

### WooCommerce is not installed

The plugin activates without fatal errors but displays an admin notice.

Activate WooCommerce before using the plugin.

---

## Manual Test Checklist

- Plugin activates successfully.
- WooCommerce missing → admin notice.
- Enable badge = disabled → no output.
- Merchant slug empty → no output.
- Empty SKU → no output.
- SKU `10316` → renders `data-set-id="10316"`.
- SKU `10316-1` → renders `data-set-id="10316"`.
- Badge mode and layout are correctly reflected in the widget.
- Shortcode overrides work correctly.
- Product-level Set ID Override takes precedence over the SKU.
- HPOS compatibility warning is not shown.

---

## Merchant Onboarding

Recommended configuration for pilot merchants:

- Badge mode: **all**
- Layout: **compact**
- Position: **After price**

Before going live:

- Ensure your store domain has been approved by Brickhunt.
- Verify that WooCommerce SKUs match official LEGO set numbers.
- Test on a real product page.

---

## Support

Website

https://www.brickhunt.nl

Merchant directory

https://www.brickhunt.nl/winkels

Email

hello@brickhunt.nl

---

LEGO® is a trademark of the LEGO Group of companies which does not sponsor, authorize or endorse this plugin or Brickhunt.
