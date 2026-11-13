<?php
/**
 * SS Gaming Store - Central Configuration & Safe File Helpers
 * Compatible with PHP 8.0+ on Namecheap Shared Hosting (Apache / LiteSpeed)
 * Works in public_html root OR any subfolder using relative paths.
 */

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'config.php') {
    http_response_code(403);
    exit('Direct access forbidden.');
}

// ============================================================================
// 1. ADMIN FOLDER NAME (Change this if you rename the admin folder!)
// ============================================================================
define('SS_ADMIN_FOLDER', 'ssadmin-x7k2');

// ============================================================================
// 2. DIRECTORY & DATA FILE PATHS (Always relative to this file)
// ============================================================================
define('SS_ROOT_DIR', __DIR__);
define('SS_DATA_DIR', SS_ROOT_DIR . '/data');
define('SS_BACKUPS_DIR', SS_DATA_DIR . '/backups');
define('SS_IMAGES_DIR', SS_ROOT_DIR . '/images');
define('SS_ASSETS_DIR', SS_ROOT_DIR . '/assets');

define('SS_PUBLISHED_FILE', SS_DATA_DIR . '/published.json');
define('SS_DRAFT_FILE', SS_DATA_DIR . '/draft.json');
define('SS_AUTH_FILE', SS_DATA_DIR . '/auth.json');
define('SS_ATTEMPTS_FILE', SS_DATA_DIR . '/login_attempts.json');

// ============================================================================
// 3. SECURITY & UPLOAD LIMITS
// ============================================================================
define('SS_SESSION_NAME', 'SSGS_ADMIN_SID');
define('SS_SESSION_IDLE_TIMEOUT', 1800); // 30 minutes in seconds
define('SS_MAX_LOGIN_ATTEMPTS', 5);
define('SS_LOGIN_LOCKOUT_SECONDS', 600); // 10 minutes in seconds
define('SS_MAX_BACKUPS', 20);
define('SS_MAX_IMAGE_BYTES', 2 * 1024 * 1024); // 2 MB
define('SS_MAX_IMAGE_WIDTH', 900);

// ============================================================================
// 4. HELPER FUNCTIONS
// ============================================================================

/**
 * Escape text safely for HTML output.
 */
function ss_e(mixed $value): string
{
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Format PKR price like "Rs. 1,799".
 */
function ss_format_pkr(int|float|string $amount): string
{
    return 'Rs. ' . number_format((int)round((float)$amount));
}

/**
 * Read and decode a JSON file safely with shared lock.
 */
function ss_json_read(string $path, mixed $default = null): mixed
{
    if (!is_file($path) || !is_readable($path)) {
        return $default;
    }
    $fp = @fopen($path, 'rb');
    if ($fp === false) {
        return $default;
    }
    @flock($fp, LOCK_SH);
    $raw = stream_get_contents($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);

    if ($raw === false || trim($raw) === '') {
        return $default;
    }
    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return $default;
    }
    return $decoded;
}

/**
 * Write JSON safely using a temporary file, exclusive lock, and atomic rename.
 * Returns ['ok' => bool, 'error' => string].
 */
function ss_json_write_atomic(string $path, mixed $data): array
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true)) {
            return ['ok' => false, 'error' => 'Cannot create directory: ' . $dir];
        }
    }
    if (!is_writable($dir)) {
        return [
            'ok' => false,
            'error' => 'Directory "' . basename($dir) . '" is not writable. Set folder permissions to 755 in cPanel File Manager.'
        ];
    }
    if (file_exists($path) && !is_writable($path)) {
        return [
            'ok' => false,
            'error' => 'File "' . basename($path) . '" is not writable. Set file permissions to 644 in cPanel File Manager.'
        ];
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return ['ok' => false, 'error' => 'Failed to encode JSON: ' . json_last_error_msg()];
    }

    try {
        $suffix = bin2hex(random_bytes(5));
    } catch (Throwable $e) {
        $suffix = str_replace('.', '', uniqid('', true));
    }

    $tmpPath = $path . '.tmp.' . $suffix;
    $fp = @fopen($tmpPath, 'wb');
    if ($fp === false) {
        return ['ok' => false, 'error' => 'Unable to open temporary file for writing in ' . basename($dir) . '.'];
    }

    if (!@flock($fp, LOCK_EX)) {
        @fclose($fp);
        @unlink($tmpPath);
        return ['ok' => false, 'error' => 'Could not acquire file lock while saving ' . basename($path) . '.'];
    }

    $bytes = @fwrite($fp, $json);
    @fflush($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);

    if ($bytes === false || $bytes !== strlen($json)) {
        @unlink($tmpPath);
        return ['ok' => false, 'error' => 'Write failed or incomplete while saving ' . basename($path) . '.'];
    }

    if (!@rename($tmpPath, $path)) {
        @unlink($tmpPath);
        return ['ok' => false, 'error' => 'Failed to replace "' . basename($path) . '" (rename error).'];
    }

    @chmod($path, 0644);
    return ['ok' => true, 'error' => ''];
}

/**
 * Validate store JSON structure before saving or publishing.
 * Returns ['ok' => bool, 'error' => string].
 */
function ss_validate_store_data(mixed $data): array
{
    if (!is_array($data)) {
        return ['ok' => false, 'error' => 'Store data must be a valid JSON object.'];
    }

    $requiredKeys = ['settings', 'banner', 'categories', 'products'];
    foreach ($requiredKeys as $key) {
        if (!isset($data[$key]) || !is_array($data[$key])) {
            return ['ok' => false, 'error' => 'Missing or invalid "' . $key . '" section in store data.'];
        }
    }

    if (empty(trim((string)($data['settings']['shop_name'] ?? '')))) {
        return ['ok' => false, 'error' => 'Shop name cannot be empty.'];
    }

    if (empty(trim((string)($data['settings']['whatsapp_number'] ?? '')))) {
        return ['ok' => false, 'error' => 'WhatsApp number cannot be empty.'];
    }

    if (isset($data['settings']['payment_methods']) && is_array($data['settings']['payment_methods'])) {
        foreach ($data['settings']['payment_methods'] as $pmIdx => $pm) {
            if (!is_array($pm) || empty(trim((string)($pm['name'] ?? '')))) {
                return ['ok' => false, 'error' => 'Payment method #' . ($pmIdx + 1) . ' is missing a method name.'];
            }
        }
    }

    foreach ($data['categories'] as $idx => $cat) {
        if (!is_array($cat) || empty(trim((string)($cat['name'] ?? '')))) {
            return ['ok' => false, 'error' => 'Category #' . ($idx + 1) . ' is missing a name.'];
        }
    }

    foreach ($data['products'] as $pIdx => $product) {
        if (!is_array($product) || empty(trim((string)($product['name'] ?? '')))) {
            return ['ok' => false, 'error' => 'Product #' . ($pIdx + 1) . ' is missing a name.'];
        }
        if (!isset($product['variants']) || !is_array($product['variants']) || count($product['variants']) === 0) {
            return ['ok' => false, 'error' => 'Product "' . $product['name'] . '" must have at least one plan/variant.'];
        }
        foreach ($product['variants'] as $vIdx => $variant) {
            if (!is_array($variant) || empty(trim((string)($variant['label'] ?? '')))) {
                return ['ok' => false, 'error' => 'Variant #' . ($vIdx + 1) . ' on "' . $product['name'] . '" is missing a label.'];
            }
            if (!isset($variant['price']) || !is_numeric($variant['price']) || (float)$variant['price'] < 0) {
                return ['ok' => false, 'error' => 'Variant "' . $variant['label'] . '" on "' . $product['name'] . '" must have a valid non-negative price.'];
            }
            if (isset($variant['old_price']) && $variant['old_price'] !== null && $variant['old_price'] !== '' && (!is_numeric($variant['old_price']) || (float)$variant['old_price'] < 0)) {
                return ['ok' => false, 'error' => 'Old price for "' . $variant['label'] . '" on "' . $product['name'] . '" must be a valid number.'];
            }
        }
    }

    return ['ok' => true, 'error' => ''];
}

/**
 * List existing uploaded images in /images directory for picking in admin.
 */
function ss_list_images(): array
{
    if (!is_dir(SS_IMAGES_DIR)) {
        return [];
    }
    $files = glob(SS_IMAGES_DIR . '/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', GLOB_BRACE) ?: [];
    sort($files, SORT_STRING);
    $out = [];
    foreach ($files as $file) {
        if (is_file($file)) {
            $out[] = 'images/' . basename($file);
        }
    }
    return $out;
}

/**
 * Compute base relative path for cookies and links so subfolder installs work seamlessly.
 */
function ss_detect_base_path(): string
{
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '/index.php';
    $dir = str_replace('\\', '/', dirname($scriptName));
    $adminSegment = '/' . trim(SS_ADMIN_FOLDER, '/');
    if ($adminSegment !== '/' && str_ends_with($dir, $adminSegment)) {
        $dir = substr($dir, 0, -strlen($adminSegment));
    }
    $dir = rtrim($dir, '/');
    return $dir === '' ? '/' : $dir . '/';
}
