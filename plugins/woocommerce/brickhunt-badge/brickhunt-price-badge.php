<?php
/**
 * Plugin Name: Brickhunt Price Badge
 * Plugin URI: https://www.brickhunt.nl/
 * Description: Shows the Brickhunt partner price badge on WooCommerce product pages.
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * WC requires at least: 7.0
 * Author: Brickhunt
 * Text Domain: brickhunt-price-badge
 *
 * @package BrickhuntPriceBadge
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BHPB_VERSION', '0.1.0');
define('BHPB_OPTION_NAME', 'brickhunt_price_badge_options');
define('BHPB_OPTION_GROUP', 'brickhunt_price_badge');
define('BHPB_SET_ID_META_KEY', '_brickhunt_set_id_override');

add_action('plugins_loaded', 'bhpb_bootstrap');

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
    echo esc_html__(
        'Brickhunt Price Badge requires WooCommerce to be installed and active.',
        'brickhunt-price-badge'
    );
    echo '</p></div>';
}

/**
 * Default plugin options.
 *
 * @return array<string, mixed>
 */
function bhpb_default_options()
{
    return [
        'base_url' => 'https://www.brickhunt.nl',
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
        __('Badge settings', 'brickhunt-price-badge'),
        '__return_false',
        'brickhunt-price-badge'
    );

    add_settings_field(
        'bhpb_enabled',
        __('Enable Brickhunt badge', 'brickhunt-price-badge'),
        'bhpb_render_enabled_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_merchant_slug',
        __('Merchant slug', 'brickhunt-price-badge'),
        'bhpb_render_merchant_slug_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_mode',
        __('Badge mode', 'brickhunt-price-badge'),
        'bhpb_render_mode_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_layout',
        __('Layout', 'brickhunt-price-badge'),
        'bhpb_render_layout_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_position',
        __('Position', 'brickhunt-price-badge'),
        'bhpb_render_position_field',
        'brickhunt-price-badge',
        'bhpb_main_settings'
    );

    add_settings_field(
        'bhpb_base_url',
        __('Brickhunt base URL', 'brickhunt-price-badge'),
        'bhpb_render_base_url_field',
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
        'base_url' => bhpb_sanitize_base_url(
            isset($input['base_url']) ? $input['base_url'] : $defaults['base_url']
        ),
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
 * Sanitizes and validates the Brickhunt base URL.
 *
 * @param mixed $value Raw URL.
 * @return string
 */
function bhpb_sanitize_base_url($value)
{
    $default_url = bhpb_default_options()['base_url'];
    $url = esc_url_raw(bhpb_sanitize_scalar($value));
    $parts = wp_parse_url($url);

    if (
        empty($url) ||
        empty($parts['scheme']) ||
        empty($parts['host']) ||
        !in_array($parts['scheme'], ['http', 'https'], true)
    ) {
        return $default_url;
    }

    $normalized_url = $parts['scheme'] . '://' . $parts['host'];

    if (!empty($parts['port'])) {
        $normalized_url .= ':' . $parts['port'];
    }

    if (!empty($parts['path'])) {
        $normalized_url .= '/' . trim($parts['path'], '/');
    }

    return untrailingslashit($normalized_url);
}

/**
 * Registers the admin settings page under WooCommerce.
 */
function bhpb_register_settings_page()
{
    add_submenu_page(
        'woocommerce',
        __('Brickhunt Price Badge', 'brickhunt-price-badge'),
        __('Brickhunt Badge', 'brickhunt-price-badge'),
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
        wp_die(esc_html__('You do not have permission to manage this page.', 'brickhunt-price-badge'));
    }

    $brickhunt_home_url = add_query_arg(
        [
            'utm_campaign' => 'plugin_settings',
            'utm_medium' => 'settings',
            'utm_source' => 'woocommerce_plugin',
        ],
        'https://www.brickhunt.nl/'
    );
    ?>
    <div class="wrap">
        <h1><?php echo esc_html__('Brickhunt Price Badge', 'brickhunt-price-badge'); ?></h1>
        <p>
            <?php echo esc_html__('De badge toont wanneer Brickhunt de prijs van dit product heeft gecontroleerd of gevalideerd.', 'brickhunt-price-badge'); ?>
        </p>

        <form action="<?php echo esc_url(admin_url('options.php')); ?>" method="post">
            <?php
            settings_fields(BHPB_OPTION_GROUP);
            do_settings_sections('brickhunt-price-badge');
            submit_button();
            ?>
        </form>

        <hr>

        <h2><?php echo esc_html__('Pilot help', 'brickhunt-price-badge'); ?></h2>
        <p>
            <?php echo esc_html__('Gebruik de WooCommerce SKU als LEGO-setnummer, bijvoorbeeld 10316 of 10316-1. Een product override wint altijd van de SKU.', 'brickhunt-price-badge'); ?>
        </p>
        <p>
            <strong><?php echo esc_html__('Shortcode:', 'brickhunt-price-badge'); ?></strong>
            <code>[brickhunt_badge]</code>
            <code>[brickhunt_badge set_id=&quot;10316&quot; merchant=&quot;uniekebricks&quot; mode=&quot;winner&quot; layout=&quot;card&quot;]</code>
        </p>
        <p>
            <?php echo esc_html__('Het merchantdomein moet in Brickhunt op de whitelist staan. De badge rendert alleen als Brickhunt prijsdata voor deze set en merchant heeft.', 'brickhunt-price-badge'); ?>
        </p>
        <p>
            <a href="<?php echo esc_url($brickhunt_home_url); ?>" target="_blank" rel="noopener noreferrer">
                <?php echo esc_html__('Open Brickhunt', 'brickhunt-price-badge'); ?>
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
        <?php echo esc_html__('Show the Brickhunt badge on product pages.', 'brickhunt-price-badge'); ?>
    </label>
    <?php
}

/**
 * Renders the merchant slug field.
 */
function bhpb_render_merchant_slug_field()
{
    $options = bhpb_get_options();
    ?>
    <input
        class="regular-text"
        id="bhpb_merchant_slug"
        name="<?php echo esc_attr(BHPB_OPTION_NAME); ?>[merchant_slug]"
        type="text"
        value="<?php echo esc_attr($options['merchant_slug']); ?>"
        placeholder="uniekebricks"
    >
    <p class="description">
        <?php echo esc_html__('Lowercase Brickhunt merchant slug, for example uniekebricks or brickspoint.', 'brickhunt-price-badge'); ?>
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
            'all' => __('All validated states', 'brickhunt-price-badge'),
            'top3' => __('Only top 3 or winner', 'brickhunt-price-badge'),
            'winner' => __('Only winner', 'brickhunt-price-badge'),
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
            'compact' => __('Compact', 'brickhunt-price-badge'),
            'card' => __('Card', 'brickhunt-price-badge'),
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
            'after_price' => __('After price', 'brickhunt-price-badge'),
            'after_add_to_cart' => __('After add to cart', 'brickhunt-price-badge'),
            'product_meta' => __('Product meta', 'brickhunt-price-badge'),
        ]
    );
}

/**
 * Renders the base URL field.
 */
function bhpb_render_base_url_field()
{
    $options = bhpb_get_options();
    ?>
    <input
        class="regular-text code"
        id="bhpb_base_url"
        name="<?php echo esc_attr(BHPB_OPTION_NAME); ?>[base_url]"
        type="url"
        value="<?php echo esc_attr($options['base_url']); ?>"
        placeholder="https://www.brickhunt.nl"
    >
    <p class="description">
        <?php echo esc_html__('Use https://www.brickhunt.nl for production. Change this only for staging tests.', 'brickhunt-price-badge'); ?>
    </p>
    <?php
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

    return bhpb_build_badge_script_tag(
        $set_id,
        (string) $options['merchant_slug'],
        (string) $options['mode'],
        (string) $options['layout'],
        (string) $options['base_url']
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
 * Builds the widget script tag with escaped attributes.
 *
 * @param string $set_id Set ID.
 * @param string $merchant_slug Merchant slug.
 * @param string $mode Badge mode.
 * @param string $layout Badge layout.
 * @param string $base_url Brickhunt base URL.
 * @return string
 */
function bhpb_build_badge_script_tag($set_id, $merchant_slug, $mode, $layout, $base_url)
{
    $set_id = bhpb_normalize_set_id($set_id);
    $merchant_slug = bhpb_sanitize_merchant_slug($merchant_slug);
    $mode = bhpb_sanitize_mode($mode);
    $layout = bhpb_sanitize_layout($layout);
    $base_url = bhpb_sanitize_base_url($base_url);

    if (empty($set_id) || empty($merchant_slug)) {
        return '';
    }

    $script_url = trailingslashit($base_url) . 'widgets/partner-badge.js';

    return sprintf(
        "\n<script\n  src=\"%s\"\n  data-set-id=\"%s\"\n  data-merchant-slug=\"%s\"\n  data-mode=\"%s\"\n  data-layout=\"%s\">\n</script>\n",
        esc_url($script_url),
        esc_attr($set_id),
        esc_attr($merchant_slug),
        esc_attr($mode),
        esc_attr($layout)
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

    return bhpb_build_badge_script_tag(
        $set_id,
        $merchant_slug,
        $mode,
        $layout,
        (string) $options['base_url']
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
            'description' => __(
                'Optional. Use 10316 or 10316-1. This overrides the WooCommerce SKU for the Brickhunt badge.',
                'brickhunt-price-badge'
            ),
            'id' => BHPB_SET_ID_META_KEY,
            'label' => __('Brickhunt set ID override', 'brickhunt-price-badge'),
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

    $set_id = isset($_POST[BHPB_SET_ID_META_KEY])
        ? bhpb_normalize_set_id(wp_unslash($_POST[BHPB_SET_ID_META_KEY]))
        : '';

    if (method_exists($product, 'update_meta_data')) {
        if (!empty($set_id)) {
            $product->update_meta_data(BHPB_SET_ID_META_KEY, $set_id);
        } else {
            $product->delete_meta_data(BHPB_SET_ID_META_KEY);
        }
    }
}
