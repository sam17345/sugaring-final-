<?php
/**
 * SS Gaming Store - Admin AJAX Actions (Save Draft, Publish, Backups, Upload, Password)
 * Always returns readable JSON error messages (never a blank page).
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

// Catch fatal errors or uncaught exceptions and return readable JSON instead of a blank 500
set_exception_handler(function (Throwable $e): void {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Server error: ' . $e->getMessage()
    ]);
    exit;
});

register_shutdown_function(function (): void {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'ok' => false,
            'error' => 'Fatal PHP error: ' . $err['message'] . ' (line ' . $err['line'] . ')'
        ]);
    }
});

require_once __DIR__ . '/auth.php';

$expired = ss_admin_start_session();
if ($expired || !ss_is_logged_in()) {
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'error' => $expired
            ? 'Your session expired after 30 minutes of inactivity. Please log in again.'
            : 'Authentication required. Please log in.'
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
    exit;
}

$action = (string)($_POST['action'] ?? '');
$csrf = $_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

// Support JSON request bodies as well as multipart/form-data
$jsonBody = null;
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== false) {
    $rawBody = file_get_contents('php://input');
    $jsonBody = json_decode((string)$rawBody, true);
    if (is_array($jsonBody)) {
        $action = (string)($jsonBody['action'] ?? $action);
        $csrf = (string)($jsonBody['csrf_token'] ?? $csrf);
    }
}

if (!ss_verify_csrf((string)$csrf)) {
    http_response_code(403);
    echo json_encode([
        'ok' => false,
        'error' => 'Invalid or expired security token (CSRF). Please refresh the admin page and try again.'
    ]);
    exit;
}

/**
 * Helper to list backup files newest-first.
 */
function ss_list_backups(): array
{
    if (!is_dir(SS_BACKUPS_DIR)) {
        return [];
    }
    $files = glob(SS_BACKUPS_DIR . '/published_*.json') ?: [];
    rsort($files, SORT_STRING);
    $list = [];
    foreach ($files as $file) {
        $name = basename($file);
        $mtime = @filemtime($file) ?: 0;
        $list[] = [
            'filename' => $name,
            'date' => $mtime ? date('Y-m-d H:i:s', $mtime) : $name,
            'size_kb' => round((@filesize($file) ?: 0) / 1024, 1)
        ];
    }
    return $list;
}

/**
 * Helper to save a timestamped backup of published.json and keep last 20.
 */
function ss_create_published_backup(): array
{
    if (!is_file(SS_PUBLISHED_FILE)) {
        return ['ok' => true, 'error' => ''];
    }
    $currentPublished = ss_json_read(SS_PUBLISHED_FILE);
    if (!is_array($currentPublished)) {
        return ['ok' => false, 'error' => 'Existing published.json could not be parsed for backup.'];
    }
    $backupName = 'published_' . date('Y-m-d_His') . '.json';
    $backupPath = SS_BACKUPS_DIR . '/' . $backupName;
    // Avoid collision if published twice within the same second
    if (file_exists($backupPath)) {
        $backupPath = SS_BACKUPS_DIR . '/published_' . date('Y-m-d_His') . '_' . bin2hex(random_bytes(2)) . '.json';
    }

    $res = ss_json_write_atomic($backupPath, $currentPublished);
    if (!$res['ok']) {
        return $res;
    }

    // Prune older backups, keeping the newest SS_MAX_BACKUPS (20)
    $files = glob(SS_BACKUPS_DIR . '/published_*.json') ?: [];
    rsort($files, SORT_STRING);
    if (count($files) > SS_MAX_BACKUPS) {
        foreach (array_slice($files, SS_MAX_BACKUPS) as $oldFile) {
            @unlink($oldFile);
        }
    }

    return ['ok' => true, 'error' => ''];
}

// ============================================================================
// ACTION ROUTER
// ============================================================================

if ($action === 'save_draft') {
    $store = $jsonBody['store'] ?? null;
    $check = ss_validate_store_data($store);
    if (!$check['ok']) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $check['error']]);
        exit;
    }

    $existingPublished = ss_json_read(SS_PUBLISHED_FILE, []);
    $lastPub = $existingPublished['meta']['last_published_at'] ?? ($store['meta']['last_published_at'] ?? '');
    $store['meta'] = [
        'last_published_at' => (string)$lastPub,
        'draft_updated_at' => date('Y-m-d H:i:s'),
    ];

    $writeRes = ss_json_write_atomic(SS_DRAFT_FILE, $store);
    if (!$writeRes['ok']) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $writeRes['error']]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Draft saved.',
        'draft' => $store
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'publish') {
    // If store payload was sent with publish request, save it to draft first
    $draft = is_array($jsonBody['store'] ?? null) ? $jsonBody['store'] : ss_json_read(SS_DRAFT_FILE);
    $check = ss_validate_store_data($draft);
    if (!$check['ok']) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Cannot publish invalid data: ' . $check['error']]);
        exit;
    }

    $backupRes = ss_create_published_backup();
    if (!$backupRes['ok']) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Backup failed before publish: ' . $backupRes['error']]);
        exit;
    }

    $nowStr = date('Y-m-d H:i:s');
    $draft['meta'] = [
        'last_published_at' => $nowStr,
        'draft_updated_at' => $nowStr,
    ];

    $pubWrite = ss_json_write_atomic(SS_PUBLISHED_FILE, $draft);
    if (!$pubWrite['ok']) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $pubWrite['error']]);
        exit;
    }

    $draftWrite = ss_json_write_atomic(SS_DRAFT_FILE, $draft);
    if (!$draftWrite['ok']) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Published live, but failed to sync draft.json: ' . $draftWrite['error']]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Store published live!',
        'last_published_at' => $nowStr,
        'draft' => $draft,
        'backups' => ss_list_backups()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'reset_draft') {
    $published = ss_json_read(SS_PUBLISHED_FILE);
    $check = ss_validate_store_data($published);
    if (!$check['ok']) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Published file is missing or invalid: ' . $check['error']]);
        exit;
    }

    $res = ss_json_write_atomic(SS_DRAFT_FILE, $published);
    if (!$res['ok']) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $res['error']]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Draft reset to match live published version.',
        'draft' => $published
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'restore_backup') {
    $filename = (string)($jsonBody['filename'] ?? '');
    if (!preg_match('/^published_\d{4}-\d{2}-\d{2}_\d{6}(?:_[a-f0-9]{4})?\.json$/', $filename)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid backup filename.']);
        exit;
    }

    $backupPath = SS_BACKUPS_DIR . '/' . $filename;
    if (!is_file($backupPath)) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Selected backup file no longer exists.']);
        exit;
    }

    $backupData = ss_json_read($backupPath);
    $check = ss_validate_store_data($backupData);
    if (!$check['ok']) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Backup JSON is corrupted: ' . $check['error']]);
        exit;
    }

    // Save current published version as backup before restoring
    ss_create_published_backup();

    $nowStr = date('Y-m-d H:i:s');
    $backupData['meta']['last_published_at'] = $nowStr;
    $pubRes = ss_json_write_atomic(SS_PUBLISHED_FILE, $backupData);
    if (!$pubRes['ok']) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $pubRes['error']]);
        exit;
    }

    $alsoDraft = !empty($jsonBody['also_draft']);
    if ($alsoDraft) {
        $backupData['meta']['draft_updated_at'] = $nowStr;
        ss_json_write_atomic(SS_DRAFT_FILE, $backupData);
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Backup "' . $filename . '" restored as published version.',
        'last_published_at' => $nowStr,
        'draft' => $alsoDraft ? $backupData : ss_json_read(SS_DRAFT_FILE),
        'backups' => ss_list_backups()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($action === 'upload_image') {
    if (!isset($_FILES['image'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'No image file received.']);
        exit;
    }

    $file = $_FILES['image'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errMap = [
            UPLOAD_ERR_INI_SIZE => 'File exceeds server upload_max_filesize limit.',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds form size limit.',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded.',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded.',
            UPLOAD_ERR_NO_TMP_DIR => 'Server missing temporary upload directory.',
            UPLOAD_ERR_CANT_WRITE => 'Server failed to write uploaded file to disk.',
        ];
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $errMap[$file['error']] ?? 'Upload error code ' . $file['error']]);
        exit;
    }

    if ($file['size'] > SS_MAX_IMAGE_BYTES) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Image is too large. Maximum allowed size is 2 MB.']);
        exit;
    }

    if (!is_dir(SS_IMAGES_DIR) && !@mkdir(SS_IMAGES_DIR, 0755, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Cannot create /images folder. Check permissions.']);
        exit;
    }
    if (!is_writable(SS_IMAGES_DIR)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => '/images folder is not writable. Set permissions to 755 in cPanel File Manager.']);
        exit;
    }

    // Validate real image type via finfo + getimagesize
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? finfo_file($finfo, $file['tmp_name']) : '';
    if ($finfo) {
        finfo_close($finfo);
    }

    $imgInfo = @getimagesize($file['tmp_name']);
    if ($imgInfo === false) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Uploaded file is not a valid image.']);
        exit;
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    if (!isset($allowed[$mime]) || !isset($allowed[$imgInfo['mime'] ?? ''])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Only JPG, PNG, and WEBP images are allowed.']);
        exit;
    }

    $ext = $allowed[$mime];
    $newFilename = 'img_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $destPath = SS_IMAGES_DIR . '/' . $newFilename;

    $width = (int)$imgInfo[0];
    $height = (int)$imgInfo[1];
    $savedWithGd = false;

    // Auto-resize to max 900px width using GD if available
    if (extension_loaded('gd') && $width > SS_MAX_IMAGE_WIDTH) {
        $srcImg = match ($ext) {
            'jpg' => @imagecreatefromjpeg($file['tmp_name']),
            'png' => @imagecreatefrompng($file['tmp_name']),
            'webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($file['tmp_name']) : false,
            default => false,
        };

        if ($srcImg) {
            $newWidth = SS_MAX_IMAGE_WIDTH;
            $newHeight = (int)round(($height / $width) * $newWidth);
            $dstImg = imagecreatetruecolor($newWidth, $newHeight);

            if ($ext === 'png' || $ext === 'webp') {
                imagealphablending($dstImg, false);
                imagesavealpha($dstImg, true);
                $transparent = imagecolorallocatealpha($dstImg, 0, 0, 0, 127);
                imagefilledrectangle($dstImg, 0, 0, $newWidth, $newHeight, $transparent);
            }

            imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

            $savedWithGd = match ($ext) {
                'jpg' => @imagejpeg($dstImg, $destPath, 86),
                'png' => @imagepng($dstImg, $destPath, 6),
                'webp' => function_exists('imagewebp') ? @imagewebp($dstImg, $destPath, 86) : false,
                default => false,
            };

            imagedestroy($srcImg);
            imagedestroy($dstImg);
        }
    }

    if (!$savedWithGd) {
        if (!@move_uploaded_file($file['tmp_name'], $destPath)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Failed to move uploaded image into /images.']);
            exit;
        }
    }

    @chmod($destPath, 0644);
    echo json_encode([
        'ok' => true,
        'path' => 'images/' . $newFilename,
        'resized' => $savedWithGd,
        'images' => ss_list_images()
    ]);
    exit;
}

if ($action === 'change_password') {
    $current = (string)($jsonBody['current_password'] ?? '');
    $newPass = (string)($jsonBody['new_password'] ?? '');
    $confirm = (string)($jsonBody['confirm_password'] ?? '');

    $auth = ss_json_read(SS_AUTH_FILE);
    if (!is_array($auth) || empty($auth['password_hash'])) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Admin password file is missing.']);
        exit;
    }

    if (!password_verify($current, (string)$auth['password_hash'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Current password is incorrect.']);
        exit;
    }
    if (strlen($newPass) < 8) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'New password must be at least 8 characters long.']);
        exit;
    }
    if ($newPass !== $confirm) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'New password and confirmation do not match.']);
        exit;
    }

    $auth['password_hash'] = password_hash($newPass, PASSWORD_DEFAULT);
    $auth['updated_at'] = date('Y-m-d H:i:s');

    $write = ss_json_write_atomic(SS_AUTH_FILE, $auth);
    if (!$write['ok']) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $write['error']]);
        exit;
    }

    session_regenerate_id(true);
    echo json_encode(['ok' => true, 'message' => 'Admin password updated successfully.']);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action requested.']);
