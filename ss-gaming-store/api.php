<?php
/**
 * SS Gaming Store - Public JSON API
 * Serves ONLY published store data to visitors (or draft data to an authenticated admin).
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$action = (string)($_GET['action'] ?? '');

// Secret 5-click portal path resolver (keeps admin folder name out of public HTML)
if ($action === 'portal') {
    echo json_encode([
        'ok' => true,
        'url' => './' . rawurlencode(SS_ADMIN_FOLDER) . '/'
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$isPreview = (($_GET['preview'] ?? '') === 'draft');

if ($isPreview) {
    // Verify active admin session before exposing draft.json
    $cookiePath = ss_detect_base_path();
    session_name(SS_SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $cookiePath,
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    ]);
    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }

    $lastActivity = (int)($_SESSION['last_activity'] ?? 0);
    $isAuthed = !empty($_SESSION['ss_admin_logged_in'])
        && $lastActivity > 0
        && (time() - $lastActivity) <= SS_SESSION_IDLE_TIMEOUT;

    if (!$isAuthed) {
        http_response_code(403);
        echo json_encode([
            'ok' => false,
            'error' => 'Draft preview requires an active admin login session.'
        ]);
        exit;
    }

    $data = ss_json_read(SS_DRAFT_FILE);
    if (!is_array($data)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not read draft.json.']);
        exit;
    }
} else {
    $data = ss_json_read(SS_PUBLISHED_FILE);
    if (!is_array($data)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Store data is currently unavailable.']);
        exit;
    }
}

// Filter out hidden products for public visitors (in preview mode, mark visibility clearly)
$products = [];
foreach (($data['products'] ?? []) as $product) {
    if (!is_array($product)) {
        continue;
    }
    $visible = !isset($product['visible']) || (bool)$product['visible'] === true;
    if (!$isPreview && !$visible) {
        continue;
    }
    $products[] = $product;
}

$settings = $data['settings'] ?? [];
$publicPayload = [
    'ok' => true,
    'is_preview' => $isPreview,
    'settings' => [
        'shop_name' => (string)($settings['shop_name'] ?? 'SS Gaming Store'),
        'tagline' => (string)($settings['tagline'] ?? ''),
        'whatsapp_number' => preg_replace('/\D+/', '', (string)($settings['whatsapp_number'] ?? '')),
        'announcement' => (string)($settings['announcement'] ?? ''),
        'footer_text' => (string)($settings['footer_text'] ?? ''),
        'copyright_text' => (string)($settings['copyright_text'] ?? ''),
        'payment_warning' => (string)($settings['payment_warning'] ?? 'After payment, sending the screenshot is a must. Your codes will be delivered on the same WhatsApp chat.'),
        'whatsapp_template' => (string)($settings['whatsapp_template'] ?? "Assalam-o-Alaikum {shop_name}!\nOrder No: {order_id}\nProduct: {product}\nPackage: {variant}\nTotal: {total}\nI have paid, screenshot attached."),
        'payment_methods' => array_values(is_array($settings['payment_methods'] ?? null) ? $settings['payment_methods'] : []),
    ],
    'banner' => $data['banner'] ?? [],
    'categories' => array_values(is_array($data['categories'] ?? null) ? $data['categories'] : []),
    'products' => $products,
];

echo json_encode($publicPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
