<?php
/**
 * Plugin Name: Brickhunt for WooCommerce
 * Description: Independent LEGO price validation.
 * Version: 0.1.1
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * WC requires at least: 7.0
 * WC tested up to: 10.8
 * Author: Kasper van Merrienboer
 * Author URI: https://www.brickhunt.nl
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: brickhunt-for-woocommerce
 *
 * @package BrickhuntPriceBadge
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BHPB_VERSION', '0.1.1');
define('BHPB_BRICKHUNT_BASE_URL', 'https://www.brickhunt.nl');
define('BHPB_OPTION_NAME', 'brickhunt_price_badge_options');
define('BHPB_OPTION_GROUP', 'brickhunt_price_badge');
define('BHPB_SET_ID_META_KEY', '_brickhunt_set_id_override');
define('BHPB_WIDGET_SCRIPT_HANDLE_PREFIX', 'brickhunt-for-woocommerce-widget');

add_action('before_woocommerce_init', 'bhpb_declare_woocommerce_feature_compatibility');
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'bhpb_plugin_action_links');
add_action('plugins_loaded', 'bhpb_bootstrap');

/**
 * Declares compatibility with WooCommerce feature flags.
 */
function bhpb_declare_woocommerce_feature_compatibility()
{
    if (!class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
        return;
    }

    // Brickhunt for WooCommerce does not read or write WooCommerce orders, so it is compatible with HPOS/custom order tables.
    \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
        'custom_order_tables',
        __FILE__,
        true
    );
}

/**
 * Initializes the plugin once WordPress plugins have loaded.
 */
function bhpb_bootstrap()
{
    if (!bhpb_is_woocommerce_active()) {
        add_action('admin_notices', 'bhpb_render_woocommerce_missing_notice');

        return;
    }

    add_action('admin_init', 'bhpb_register_settings');
    add_action('admin_menu', 'bhpb_register_settings_page');
    add_filter(
        'option_page_capability_' . BHPB_OPTION_GROUP,
        'bhpb_settings_capability'
    );

    add_action('woocommerce_single_product_summary', 'bhpb_render_after_price', 11);
    add_action('woocommerce_after_add_to_cart_form', 'bhpb_render_after_add_to_cart');
    add_action('woocommerce_product_meta_end', 'bhpb_render_product_meta');
    add_filter('script_loader_tag', 'bhpb_add_widget_script_attributes', 10, 3);

    add_shortcode('brickhunt_badge', 'bhpb_render_shortcode');

    add_action(
        'woocommerce_product_options_general_product_data',
        'bhpb_render_product_set_id_override_field'
    );
    add_action(
        'woocommerce_admin_process_product_object',
        'bhpb_save_product_set_id_override_field'
    );
}

/**
 * Checks whether WooCommerce is active enough for this plugin to run.
 *
 * @return bool
 */
function bhpb_is_woocommerce_active()
{
    return class_exists('WooCommerce') && function_exists('wc_get_product');
}

/**
 * Capability required to manage the plugin settings.
 *
 * @return string
 */
function bhpb_settings_capability()
{
    return current_user_can('manage_woocommerce') ? 'manage_woocommerce' : 'manage_options';
}

/**
 * Shows a safe admin notice when WooCommerce is missing.
 */
function bhpb_render_woocommerce_missing_notice()
{
    if (!current_user_can('activate_plugins')) {
        return;
    }

    echo '<div class="notice notice-warning"><p>';
    echo esc_html__('Brickhunt for WooCommerce requires WooCommerce to be installed and active.', 'brickhunt-for-woocommerce');
    echo '</p></div>';
}

/**
 * Adds useful links on the WordPress plugins page.
 *
 * @param array<int|string, string> $links Existing plugin action links.
 * @return array<int|string, string>
 */
function bhpb_plugin_action_links($links)
{
    $plugin_links = [
        'settings' => sprintf(
            '<a href="%s">%s</a>',
            esc_url(admin_url('admin.php?page=brickhunt-price-badge')),
            esc_html__('Settings', 'brickhunt-for-woocommerce')
        ),
        'docs' => sprintf(
            '<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
            esc_url(trailingslashit(BHPB_BRICKHUNT_BASE_URL) . 'winkels'),
            esc_html__('Docs', 'brickhunt-for-woocommerce')
        ),
        'support' => sprintf(
            '<a href="%s">%s</a>',
            esc_url('mailto:hello@brickhunt.nl'),
            esc_html__('Support', 'brickhunt-for-woocommerce')
        ),
    ];

    return array_merge($plugin_links, $links);
}

/**
 * Default plugin options.
 *
 * @return array<string, mixed>
 */
function bhpb_default_options()
{
    return [
        'enabled' => 0,
        'layout' => 'compact',
        'merchant_slug' => '',
        'mode' => 'all',
        'position' => 'after_price',
    ];
}

/**
 * Gets normalized runtime options.
 *
 * @return array<string, mixed>
 */
function bhpb_get_options()
{
    $stored = get_option(BHPB_OPTION_NAME, []);

    if (!is_array($stored)) {
        $stored = [];
    }

    return bhpb_sanitize_options(array_merge(bhpb_default_options(), $stored));
}

/**
 * Registers the settings page fields.
 */
function bhpb_register_settings()
{
    register_setting(
        BHPB_OPTION_GROUP,
        BHPB_OPTION_NAME,
        [
            'default' => bhpb_default_options(),
            'sanitize_callback' => 'bhpb_sanitize_options',
            'type' => 'array',
        ]
    );

    add_settings_section(
        'bhpb_main_settings',
        __('Badge settings', 'brickhunt-for-woocommerce'),
        '__return_false',
        'brickhunt-price-badge'
    );

    add_settings_field(
        'bhpb_enabled',
        __('Enable badge', 'brickhunt-for-woocommerce'),
        'bhpb_render_enabled_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_merchant_slug',
        __('Merchant slug', 'brickhunt-for-woocommerce'),
        'bhpb_render_merchant_slug_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_mode',
        __('Badge mode', 'brickhunt-for-woocommerce'),
        'bhpb_render_mode_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_layout',
        __('Layout', 'brickhunt-for-woocommerce'),
        'bhpb_render_layout_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_position',
        __('Position', 'brickhunt-for-woocommerce'),
        'bhpb_render_position_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );
}

/**
 * Sanitizes the full settings option.
 *
 * @param mixed $input Raw option value.
 * @return array<string, mixed>
 */
function bhpb_sanitize_options($input)
{
    $defaults = bhpb_default_options();
    $input = is_array($input) ? wp_unslash($input) : [];

    return [
        'enabled' => !empty($input['enabled']) ? 1 : 0,
        'layout' => bhpb_sanitize_layout(
            isset($input['layout']) ? $input['layout'] : $defaults['layout']
        ),
        'merchant_slug' => bhpb_sanitize_merchant_slug(
            isset($input['merchant_slug']) ? $input['merchant_slug'] : ''
        ),
        'mode' => bhpb_sanitize_mode(
            isset($input['mode']) ? $input['mode'] : $defaults['mode']
        ),
        'position' => bhpb_sanitize_position(
            isset($input['position']) ? $input['position'] : $defaults['position']
        ),
    ];
}

/**
 * Sanitizes scalar text-like values.
 *
 * @param mixed $value Raw value.
 * @return string
 */
function bhpb_sanitize_scalar($value)
{
    if (is_array($value) || is_object($value)) {
        return '';
    }

    return trim(sanitize_text_field((string) $value));
}

/**
 * Sanitizes a Brickhunt merchant slug.
 *
 * @param mixed $value Raw slug.
 * @return string
 */
function bhpb_sanitize_merchant_slug($value)
{
    $slug = strtolower(bhpb_sanitize_scalar($value));

    return (string) preg_replace('/[^a-z0-9_-]/', '', $slug);
}

/**
 * Sanitizes and validates a mode.
 *
 * @param mixed $value Raw mode.
 * @return string
 */
function bhpb_sanitize_mode($value)
{
    $mode = bhpb_sanitize_scalar($value);
    $allowed_modes = ['all', 'top3', 'winner'];

    return in_array($mode, $allowed_modes, true) ? $mode : 'all';
}

/**
 * Sanitizes and validates a layout.
 *
 * @param mixed $value Raw layout.
 * @return string
 */
function bhpb_sanitize_layout($value)
{
    $layout = bhpb_sanitize_scalar($value);
    $allowed_layouts = ['compact', 'card'];

    return in_array($layout, $allowed_layouts, true) ? $layout : 'compact';
}

/**
 * Sanitizes and validates an automatic render position.
 *
 * @param mixed $value Raw position.
 * @return string
 */
function bhpb_sanitize_position($value)
{
    $position = bhpb_sanitize_scalar($value);
    $allowed_positions = ['after_price', 'after_add_to_cart', 'product_meta'];

    return in_array($position, $allowed_positions, true) ? $position : 'after_price';
}

/**
 * Registers the admin settings page under WooCommerce.
 */
function bhpb_register_settings_page()
{
    add_submenu_page(
        'woocommerce',
        __('Brickhunt for WooCommerce', 'brickhunt-for-woocommerce'),
        __('Brickhunt', 'brickhunt-for-woocommerce'),
        bhpb_settings_capability(),
        'brickhunt-price-badge',
        'bhpb_render_settings_page'
    );
}

/**
 * Renders the settings page.
 */
function bhpb_render_settings_page()
{
    if (!current_user_can(bhpb_settings_capability())) {
        wp_die(esc_html__('You do not have permission to manage this page.', 'brickhunt-for-woocommerce'));
    }

    $brickhunt_home_url = add_query_arg(
        [
            'utm_campaign' => 'plugin_settings',
            'utm_medium' => 'settings',
            'utm_source' => 'woocommerce_plugin',
        ],
        trailingslashit(BHPB_BRICKHUNT_BASE_URL)
    );
    $brickhunt_shops_url = trailingslashit(BHPB_BRICKHUNT_BASE_URL) . 'winkels';
    $contact_email = 'hello@brickhunt.nl';
    ?>
    <div class="wrap">
        <h1><?php echo esc_html__('Brickhunt for WooCommerce', 'brickhunt-for-woocommerce'); ?></h1>
        <?php settings_errors(); ?>
        <p>
            <?php echo esc_html__('Independent LEGO price validation.', 'brickhunt-for-woocommerce'); ?>
        </p>

        <form action="<?php echo esc_url(admin_url('options.php')); ?>" method="post">
            <?php
            settings_fields(BHPB_OPTION_GROUP);
            do_settings_sections('brickhunt-price-badge');
            submit_button();
            ?>
        </form>

        <hr>

        <h2><?php echo esc_html__('Pilot help', 'brickhunt-for-woocommerce'); ?></h2>
        <p>
            <?php echo esc_html__('Gebruik de WooCommerce SKU als LEGO-setnummer, bijvoorbeeld 10316 of 10316-1. Een product override wint altijd van de SKU.', 'brickhunt-for-woocommerce'); ?>
        </p>
        <p>
            <strong><?php echo esc_html__('Shortcode:', 'brickhunt-for-woocommerce'); ?></strong>
            <code>[brickhunt_badge]</code>
            <code>[brickhunt_badge set_id=&quot;10316&quot; merchant=&quot;uniekebricks&quot; mode=&quot;winner&quot; layout=&quot;card&quot;]</code>
        </p>
        <p>
            <?php echo esc_html__('Het merchantdomein moet in Brickhunt op de whitelist staan. De badge rendert alleen als Brickhunt prijsdata voor deze set en merchant heeft.', 'brickhunt-for-woocommerce'); ?>
        </p>
        <p>
            <?php echo esc_html__('Weet je je merchant slug niet? Zoek je winkel op Brickhunt of mail ons.', 'brickhunt-for-woocommerce'); ?>
        </p>
        <p>
            <strong><?php echo esc_html__('Contact:', 'brickhunt-for-woocommerce'); ?></strong>
            <a href="<?php echo esc_url('mailto:' . $contact_email); ?>"><?php echo esc_html($contact_email); ?></a>
            <br>
            <a href="<?php echo esc_url($brickhunt_shops_url); ?>" target="_blank" rel="noopener noreferrer">
                <?php echo esc_html($brickhunt_shops_url); ?>
            </a>
        </p>
        <p>
            <a href="<?php echo esc_url($brickhunt_home_url); ?>" target="_blank" rel="noopener noreferrer">
                <?php echo esc_html__('Open Brickhunt', 'brickhunt-for-woocommerce'); ?>
            </a>
        </p>
    </div>
    <?php
}

/**
 * Renders the enabled field.
 */
function bhpb_render_enabled_field()
{
    $options = bhpb_get_options();
    ?>
    <label>
        <input
            type="checkbox"
            name="<?php echo esc_attr(BHPB_OPTION_NAME); ?>[enabled]"
            value="1"
            <?php checked(1, (int) $options['enabled']); ?>
        >
        <?php echo esc_html__('Show independent Brickhunt price validation badges on product pages.', 'brickhunt-for-woocommerce'); ?>
    </label>
    <?php
}

/**
 * Renders the merchant slug field.
 */
function bhpb_render_merchant_slug_field()
{
    $options = bhpb_get_options();
    $brickhunt_shops_url = trailingslashit(BHPB_BRICKHUNT_BASE_URL) . 'winkels';
    ?>
    <input
        class="regular-text"
        id="bhpb_merchant_slug"
        name="<?php echo esc_attr(BHPB_OPTION_NAME); ?>[merchant_slug]"
        type="text"
        value="<?php echo esc_attr($options['merchant_slug']); ?>"
        placeholder="jouw-webshop-slug"
    >
    <p class="description">
        <?php
        echo esc_html(
            sprintf(
                /* translators: 1: Brickhunt shops URL. */
                __('Je Brickhunt merchant slug vind je op %1$s of vraag hem op via hello@brickhunt.nl.', 'brickhunt-for-woocommerce'),
                $brickhunt_shops_url
            )
        );
        ?>
    </p>
    <?php
}

/**
 * Renders the mode field.
 */
function bhpb_render_mode_field()
{
    bhpb_render_select_field(
        'mode',
        bhpb_get_options()['mode'],
        [
            'all' => __('All validated states', 'brickhunt-for-woocommerce'),
            'top3' => __('Only top 3 or winner', 'brickhunt-for-woocommerce'),
            'winner' => __('Only winner', 'brickhunt-for-woocommerce'),
        ]
    );
}

/**
 * Renders the layout field.
 */
function bhpb_render_layout_field()
{
    bhpb_render_select_field(
        'layout',
        bhpb_get_options()['layout'],
        [
            'compact' => __('Compact', 'brickhunt-for-woocommerce'),
            'card' => __('Card', 'brickhunt-for-woocommerce'),
        ]
    );
}

/**
 * Renders the position field.
 */
function bhpb_render_position_field()
{
    bhpb_render_select_field(
        'position',
        bhpb_get_options()['position'],
        [
            'after_price' => __('After price', 'brickhunt-for-woocommerce'),
            'after_add_to_cart' => __('After add to cart', 'brickhunt-for-woocommerce'),
            'product_meta' => __('Product meta', 'brickhunt-for-woocommerce'),
        ]
    );
}

/**
 * Renders a sanitized select field.
 *
 * @param string               $name Current option key.
 * @param string               $selected Current selected value.
 * @param array<string,string> $options Selectable values.
 */
function bhpb_render_select_field($name, $selected, $options)
{
    ?>
    <select name="<?php echo esc_attr(BHPB_OPTION_NAME . '[' . $name . ']'); ?>">
        <?php foreach ($options as $value => $label) : ?>
            <option value="<?php echo esc_attr($value); ?>" <?php selected($selected, $value); ?>>
                <?php echo esc_html($label); ?>
            </option>
        <?php endforeach; ?>
    </select>
    <?php
}

/**
 * Renders the badge after the product price.
 */
function bhpb_render_after_price()
{
    bhpb_render_badge_for_position('after_price');
}

/**
 * Renders the badge after the add-to-cart form.
 */
function bhpb_render_after_add_to_cart()
{
    bhpb_render_badge_for_position('after_add_to_cart');
}

/**
 * Renders the badge inside product meta.
 */
function bhpb_render_product_meta()
{
    bhpb_render_badge_for_position('product_meta');
}

/**
 * Renders the configured badge for a WooCommerce hook position.
 *
 * @param string $position Position key.
 */
function bhpb_render_badge_for_position($position)
{
    $options = bhpb_get_options();

    if (
        empty($options['enabled']) ||
        empty($options['merchant_slug']) ||
        $options['position'] !== $position
    ) {
        return;
    }

    $product = bhpb_get_current_product();

    if (!$product) {
        return;
    }

    echo bhpb_get_product_badge_markup($product, $options); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}

/**
 * Returns the current WooCommerce product object.
 *
 * @return object|null
 */
function bhpb_get_current_product()
{
    global $product;

    if (is_object($product) && is_a($product, 'WC_Product')) {
        return $product;
    }

    $product_id = get_the_ID();

    if ($product_id && function_exists('wc_get_product')) {
        $resolved_product = wc_get_product($product_id);

        return $resolved_product && is_object($resolved_product) ? $resolved_product : null;
    }

    return null;
}

/**
 * Builds badge markup for a product.
 *
 * @param object               $product WooCommerce product.
 * @param array<string, mixed> $options Runtime options.
 * @return string
 */
function bhpb_get_product_badge_markup($product, $options)
{
    $set_id = bhpb_get_product_set_id($product);

    if (empty($set_id)) {
        return '';
    }

    return bhpb_build_badge_markup(
        $set_id,
        (string) $options['merchant_slug'],
        (string) $options['mode'],
        (string) $options['layout']
    );
}

/**
 * Resolves the Brickhunt set ID from override first, then SKU.
 *
 * @param object $product WooCommerce product.
 * @return string
 */
function bhpb_get_product_set_id($product)
{
    $override = '';

    if (is_object($product) && method_exists($product, 'get_meta')) {
        $override = (string) $product->get_meta(BHPB_SET_ID_META_KEY, true);
    }

    $override_set_id = bhpb_normalize_set_id($override);

    if (!empty($override_set_id)) {
        return $override_set_id;
    }

    if (is_object($product) && method_exists($product, 'get_sku')) {
        return bhpb_normalize_set_id((string) $product->get_sku());
    }

    return '';
}

/**
 * Sanitizes and normalizes LEGO set IDs.
 *
 * @param mixed $value Raw set ID or SKU.
 * @return string
 */
function bhpb_normalize_set_id($value)
{
    $set_id = preg_replace('/\s+/', '', bhpb_sanitize_scalar($value));

    if (preg_match('/^([0-9]{3,8})(?:-[0-9]+)?$/', $set_id, $matches)) {
        return $matches[1];
    }

    return '';
}

/**
 * Builds the widget placeholder and enqueues the widget script.
 *
 * @param string $set_id Set ID.
 * @param string $merchant_slug Merchant slug.
 * @param string $mode Badge mode.
 * @param string $layout Badge layout.
 * @return string
 */
function bhpb_build_badge_markup($set_id, $merchant_slug, $mode, $layout)
{
    $set_id = bhpb_normalize_set_id($set_id);
    $merchant_slug = bhpb_sanitize_merchant_slug($merchant_slug);
    $mode = bhpb_sanitize_mode($mode);
    $layout = bhpb_sanitize_layout($layout);

    if (empty($set_id) || empty($merchant_slug)) {
        return '';
    }

    $target_id = bhpb_enqueue_badge_widget_script($set_id, $merchant_slug, $mode, $layout);

    return sprintf(
        "\n<div id=\"%s\" class=\"brickhunt-badge-placeholder\"></div>\n",
        esc_attr($target_id)
    );
}

/**
 * Enqueues one configured widget script instance and returns its target ID.
 *
 * @param string $set_id Set ID.
 * @param string $merchant_slug Merchant slug.
 * @param string $mode Badge mode.
 * @param string $layout Badge layout.
 * @return string
 */
function bhpb_enqueue_badge_widget_script($set_id, $merchant_slug, $mode, $layout)
{
    global $bhpb_widget_script_attributes;

    static $instance = 0;

    $instance++;

    $target_id = 'brickhunt-badge-' . $instance;
    $handle = BHPB_WIDGET_SCRIPT_HANDLE_PREFIX . '-' . $instance;
    $script_url = trailingslashit(BHPB_BRICKHUNT_BASE_URL) . 'widgets/partner-badge.js';

    if (!is_array($bhpb_widget_script_attributes)) {
        $bhpb_widget_script_attributes = [];
    }

    $bhpb_widget_script_attributes[$handle] = [
        'layout' => $layout,
        'merchant_slug' => $merchant_slug,
        'mode' => $mode,
        'set_id' => $set_id,
        'target_id' => $target_id,
    ];

    wp_enqueue_script($handle, $script_url, [], BHPB_VERSION, true);

    return $target_id;
}

/**
 * Adds Brickhunt widget configuration attributes to enqueued script tags.
 *
 * @param string $tag Script tag generated by WordPress.
 * @param string $handle Script handle.
 * @param string $src Script URL.
 * @return string
 */
function bhpb_add_widget_script_attributes($tag, $handle, $src)
{
    global $bhpb_widget_script_attributes;

    if (
        !is_array($bhpb_widget_script_attributes) ||
        empty($bhpb_widget_script_attributes[$handle]) ||
        strpos($handle, BHPB_WIDGET_SCRIPT_HANDLE_PREFIX . '-') !== 0
    ) {
        return $tag;
    }

    $attributes = $bhpb_widget_script_attributes[$handle];

    return wp_get_script_tag(
        [
            'data-layout' => $attributes['layout'],
            'data-merchant-slug' => $attributes['merchant_slug'],
            'data-mode' => $attributes['mode'],
            'data-set-id' => $attributes['set_id'],
            'data-target-id' => $attributes['target_id'],
            'id' => $handle . '-js',
            'src' => $src,
        ]
    );
}

/**
 * Renders the [brickhunt_badge] shortcode.
 *
 * @param array<string, mixed> $atts Shortcode attributes.
 * @return string
 */
function bhpb_render_shortcode($atts)
{
    $options = bhpb_get_options();

    if (empty($options['enabled'])) {
        return '';
    }

    $atts = shortcode_atts(
        [
            'layout' => '',
            'merchant' => '',
            'mode' => '',
            'set_id' => '',
        ],
        is_array($atts) ? $atts : [],
        'brickhunt_badge'
    );

    $merchant_slug = !empty($atts['merchant'])
        ? bhpb_sanitize_merchant_slug($atts['merchant'])
        : (string) $options['merchant_slug'];
    $mode = !empty($atts['mode'])
        ? bhpb_sanitize_mode($atts['mode'])
        : (string) $options['mode'];
    $layout = !empty($atts['layout'])
        ? bhpb_sanitize_layout($atts['layout'])
        : (string) $options['layout'];
    $set_id = !empty($atts['set_id'])
        ? bhpb_normalize_set_id($atts['set_id'])
        : '';

    if (empty($set_id)) {
        $product = bhpb_get_current_product();
        $set_id = $product ? bhpb_get_product_set_id($product) : '';
    }

    return bhpb_build_badge_markup(
        $set_id,
        $merchant_slug,
        $mode,
        $layout
    );
}

/**
 * Adds a small product-level Brickhunt set ID override field.
 */
function bhpb_render_product_set_id_override_field()
{
    if (!function_exists('woocommerce_wp_text_input')) {
        return;
    }

    $product_id = get_the_ID();
    $value = $product_id ? get_post_meta($product_id, BHPB_SET_ID_META_KEY, true) : '';

    woocommerce_wp_text_input(
        [
            'desc_tip' => true,
            'description' => __('Optional. Use 10316 or 10316-1. This overrides the WooCommerce SKU for the Brickhunt badge.', 'brickhunt-for-woocommerce'),
            'id' => BHPB_SET_ID_META_KEY,
            'label' => __('Brickhunt set ID override', 'brickhunt-for-woocommerce'),
            'placeholder' => '10316',
            'value' => bhpb_normalize_set_id($value),
        ]
    );
}

/**
 * Saves the product-level Brickhunt set ID override.
 *
 * @param object $product WooCommerce product object.
 */
function bhpb_save_product_set_id_override_field($product)
{
    if (!is_object($product) || !method_exists($product, 'get_id')) {
        return;
    }

    $product_id = (int) $product->get_id();

    if (!$product_id || !current_user_can('edit_product', $product_id)) {
        return;
    }

    $nonce = isset($_POST['woocommerce_meta_nonce'])
        ? sanitize_text_field(wp_unslash($_POST['woocommerce_meta_nonce']))
        : '';

    if (empty($nonce) || !wp_verify_nonce($nonce, 'woocommerce_save_data')) {
        return;
    }

    $raw_set_id = isset($_POST[BHPB_SET_ID_META_KEY])
        ? sanitize_text_field(wp_unslash($_POST[BHPB_SET_ID_META_KEY]))
        : '';
    $set_id = bhpb_normalize_set_id($raw_set_id);

    if (method_exists($product, 'update_meta_data')) {
        if (!empty($set_id)) {
            $product->update_meta_data(BHPB_SET_ID_META_KEY, $set_id);
        } else {
            $product->delete_meta_data(BHPB_SET_ID_META_KEY);
        }
    }
}
