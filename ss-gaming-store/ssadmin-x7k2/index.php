<?php
/**
 * SS Gaming Store - Hidden Admin Portal
 * Handles First-Time Password Setup, Secure Login, and Full Store Dashboard.
 */

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$sessionExpired = ss_admin_start_session();
$passwordConfigured = ss_is_password_configured();
$errorMsg = '';
$infoMsg = $sessionExpired ? 'Your session expired after 30 minutes of inactivity. Please sign in again.' : '';

// Handle First-Time Setup POST (permanently disabled once auth.json exists)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['form_type'] ?? '') === 'setup') {
    if ($passwordConfigured) {
        $errorMsg = 'Setup is permanently disabled because an admin password already exists.';
    } elseif (!ss_verify_csrf($_POST['csrf_token'] ?? '')) {
        $errorMsg = 'Invalid security token. Please refresh and try again.';
    } else {
        $pass1 = (string)($_POST['password'] ?? '');
        $pass2 = (string)($_POST['password_confirm'] ?? '');
        if (strlen($pass1) < 8) {
            $errorMsg = 'Password must be at least 8 characters long.';
        } elseif ($pass1 !== $pass2) {
            $errorMsg = 'Passwords do not match.';
        } else {
            $authPayload = [
                'password_hash' => password_hash($pass1, PASSWORD_DEFAULT),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ];
            $saveAuth = ss_json_write_atomic(SS_AUTH_FILE, $authPayload);
            if (!$saveAuth['ok']) {
                $errorMsg = 'Could not save password: ' . $saveAuth['error'];
            } else {
                session_regenerate_id(true);
                $_SESSION['ss_admin_logged_in'] = true;
                $_SESSION['last_activity'] = time();
                header('Location: ./');
                exit;
            }
        }
    }
}

// Handle Login POST
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['form_type'] ?? '') === 'login') {
    if (!$passwordConfigured) {
        header('Location: ./');
        exit;
    }

    $throttle = ss_check_login_throttle();
    if ($throttle['locked']) {
        $mins = (int)ceil($throttle['remaining_seconds'] / 60);
        $errorMsg = 'Too many wrong attempts. Login locked for ' . $mins . ' minute(s).';
    } elseif (!ss_verify_csrf($_POST['csrf_token'] ?? '')) {
        $errorMsg = 'Invalid security token. Please refresh the page and try again.';
    } else {
        $entered = (string)($_POST['password'] ?? '');
        $auth = ss_json_read(SS_AUTH_FILE);
        $hash = (string)($auth['password_hash'] ?? '');
        if ($hash !== '' && password_verify($entered, $hash)) {
            ss_clear_login_attempts();
            session_regenerate_id(true);
            $_SESSION['ss_admin_logged_in'] = true;
            $_SESSION['last_activity'] = time();
            header('Location: ./');
            exit;
        } else {
            $attemptInfo = ss_record_failed_login();
            $remainingTries = max(0, SS_MAX_LOGIN_ATTEMPTS - (int)$attemptInfo['count']);
            if ($remainingTries === 0) {
                $errorMsg = 'Too many wrong attempts. Login locked for 10 minutes.';
            } else {
                $errorMsg = 'Incorrect password. ' . $remainingTries . ' attempt(s) remaining before 10-minute lockout.';
            }
        }
    }
}

$isLoggedIn = $passwordConfigured && ss_is_logged_in();

// Prepare Dashboard Data if logged in
$draftData = null;
$publishedData = null;
$backupsList = [];
$hasUnpublishedChanges = false;
$diagnostics = [];

if ($isLoggedIn) {
    $draftData = ss_json_read(SS_DRAFT_FILE);
    $publishedData = ss_json_read(SS_PUBLISHED_FILE);

    if (!is_array($draftData) && is_array($publishedData)) {
        $draftData = $publishedData;
    }

    if (is_array($draftData) && is_array($publishedData)) {
        $dClean = $draftData;
        $pClean = $publishedData;
        unset($dClean['meta'], $pClean['meta']);
        $hasUnpublishedChanges = (json_encode($dClean) !== json_encode($pClean));
    }

    if (is_dir(SS_BACKUPS_DIR)) {
        $files = glob(SS_BACKUPS_DIR . '/published_*.json') ?: [];
        rsort($files, SORT_STRING);
        foreach ($files as $f) {
            $mtime = @filemtime($f) ?: 0;
            $backupsList[] = [
                'filename' => basename($f),
                'date' => $mtime ? date('Y-m-d H:i:s', $mtime) : basename($f),
                'size_kb' => round((@filesize($f) ?: 0) / 1024, 1),
            ];
        }
    }

    // Server Diagnostics
    $gdLoaded = extension_loaded('gd');
    $gdInfo = $gdLoaded && function_exists('gd_info') ? gd_info() : [];
    $finfoLoaded = extension_loaded('fileinfo');

    $diagnostics = [
        [
            'label' => 'PHP Version',
            'ok' => version_compare(PHP_VERSION, '8.0.0', '>='),
            'value' => PHP_VERSION,
            'fix' => 'Select PHP 8.1 or 8.2 in cPanel -> Select PHP Version.'
        ],
        [
            'label' => '/data Folder Writable',
            'ok' => is_dir(SS_DATA_DIR) && is_writable(SS_DATA_DIR),
            'value' => is_writable(SS_DATA_DIR) ? 'Writable' : 'Not writable',
            'fix' => 'In cPanel File Manager, set permissions on /data to 755 (or 775 if needed).'
        ],
        [
            'label' => '/data/backups Folder Writable',
            'ok' => is_dir(SS_BACKUPS_DIR) && is_writable(SS_BACKUPS_DIR),
            'value' => is_writable(SS_BACKUPS_DIR) ? 'Writable' : 'Not writable',
            'fix' => 'Create /data/backups if missing and set permissions to 755.'
        ],
        [
            'label' => 'draft.json & published.json Writable',
            'ok' => is_writable(SS_DRAFT_FILE) && is_writable(SS_PUBLISHED_FILE),
            'value' => (is_writable(SS_DRAFT_FILE) && is_writable(SS_PUBLISHED_FILE)) ? 'Writable' : 'Not writable',
            'fix' => 'Set permissions on data/draft.json and data/published.json to 644.'
        ],
        [
            'label' => '/images Folder Writable',
            'ok' => is_dir(SS_IMAGES_DIR) && is_writable(SS_IMAGES_DIR),
            'value' => is_writable(SS_IMAGES_DIR) ? 'Writable' : 'Not writable',
            'fix' => 'In cPanel File Manager, set permissions on /images to 755.'
        ],
        [
            'label' => 'GD Image Resize Extension',
            'ok' => $gdLoaded,
            'value' => $gdLoaded ? ('Available (WebP: ' . (!empty($gdInfo['WebP Support']) ? 'Yes' : 'No') . ')') : 'Not loaded',
            'fix' => 'Enable "gd" in cPanel -> Select PHP Version (uploads still work without GD, just without auto-resize).'
        ],
        [
            'label' => 'Fileinfo MIME Check',
            'ok' => $finfoLoaded,
            'value' => $finfoLoaded ? 'Available' : 'Missing',
            'fix' => 'Enable "fileinfo" extension in cPanel -> Select PHP Version.'
        ],
        [
            'label' => 'PHP Sessions Working',
            'ok' => (session_status() === PHP_SESSION_ACTIVE && is_writable(session_save_path() ?: sys_get_temp_dir())),
            'value' => session_status() === PHP_SESSION_ACTIVE ? 'Active' : 'Inactive',
            'fix' => 'Check PHP session.save_path in cPanel PHP Options.'
        ]
    ];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Admin Portal — SS Gaming Store</title>
  <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
  <link rel="stylesheet" href="admin.css">
</head>
<body>

<?php if (!$passwordConfigured): ?>
  <!-- FIRST-TIME SETUP SCREEN -->
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-badge">First-Time Setup</div>
      <h1>Create Admin Password</h1>
      <p class="auth-sub">Set your admin password once. After saving, this setup screen is permanently locked.</p>

      <?php if ($errorMsg !== ''): ?>
        <div class="alert alert-error"><?php echo ss_e($errorMsg); ?></div>
      <?php endif; ?>

      <form method="post" action="./" class="auth-form">
        <input type="hidden" name="form_type" value="setup">
        <input type="hidden" name="csrf_token" value="<?php echo ss_e(ss_csrf_token()); ?>">

        <label class="field">
          <span>New Password (min 8 characters)</span>
          <input type="password" name="password" required minlength="8" autocomplete="new-password" autofocus>
        </label>

        <label class="field">
          <span>Confirm Password</span>
          <input type="password" name="password_confirm" required minlength="8" autocomplete="new-password">
        </label>

        <button type="submit" class="btn btn-primary btn-lg btn-full">Save Password &amp; Open Dashboard</button>
      </form>
      <a href="../" class="auth-back-link">&larr; Back to Store</a>
    </div>
  </div>

<?php elseif (!$isLoggedIn): ?>
  <!-- LOGIN SCREEN -->
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-badge">SS Gaming Store</div>
      <h1>Admin Login</h1>
      <p class="auth-sub">Enter your admin password to manage products, pricing, and banners.</p>

      <?php if ($infoMsg !== ''): ?>
        <div class="alert alert-warn"><?php echo ss_e($infoMsg); ?></div>
      <?php endif; ?>
      <?php if ($errorMsg !== ''): ?>
        <div class="alert alert-error"><?php echo ss_e($errorMsg); ?></div>
      <?php endif; ?>

      <form method="post" action="./" class="auth-form">
        <input type="hidden" name="form_type" value="login">
        <input type="hidden" name="csrf_token" value="<?php echo ss_e(ss_csrf_token()); ?>">

        <label class="field">
          <span>Admin Password</span>
          <input type="password" name="password" required autocomplete="current-password" autofocus>
        </label>

        <button type="submit" class="btn btn-primary btn-lg btn-full">Sign In</button>
      </form>
      <a href="../" class="auth-back-link">&larr; Back to Store</a>
    </div>
  </div>

<?php else: ?>
  <!-- AUTHENTICATED ADMIN DASHBOARD -->
  <div class="admin-app">
    <header class="admin-topbar">
      <div class="topbar-left">
        <div class="admin-brand">SS Gaming Admin</div>
        <div class="publish-meta">
          <span>Last published: <strong id="last-published-label"><?php echo ss_e($publishedData['meta']['last_published_at'] ?? 'Never'); ?></strong></span>
          <span id="unpublished-badge" class="status-warn" <?php echo $hasUnpublishedChanges ? '' : 'hidden'; ?>>Unpublished changes</span>
        </div>
      </div>
      <div class="topbar-actions">
        <a href="../?preview=draft" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Preview draft</a>
        <button type="button" id="btn-save-draft" class="btn btn-secondary">Save</button>
        <button type="button" id="btn-publish-live" class="btn btn-publish">PUBLISH</button>
        <a href="logout.php" class="btn btn-danger-outline">Logout</a>
      </div>
    </header>

    <div id="admin-feedback" class="admin-feedback" hidden role="alert"></div>

    <?php if (!is_array($draftData)): ?>
      <div class="container-pad">
        <div class="alert alert-error">
          <strong>Error loading store data:</strong> <code>data/draft.json</code> or <code>data/published.json</code> is missing or contains invalid JSON. Check file permissions (644 on JSON files, 755 on /data) or upload fresh copies.
        </div>
      </div>
    <?php else: ?>

    <nav class="admin-tabs" role="tablist">
      <button type="button" class="tab-btn active" data-tab="products">Products</button>
      <button type="button" class="tab-btn" data-tab="prices">Quick Prices</button>
      <button type="button" class="tab-btn" data-tab="categories">Categories</button>
      <button type="button" class="tab-btn" data-tab="banner">Banner &amp; Ticker</button>
      <button type="button" class="tab-btn" data-tab="settings">Settings &amp; Payments</button>
      <button type="button" class="tab-btn" data-tab="backups">Restore / Backups</button>
      <button type="button" class="tab-btn" data-tab="password">Change Password</button>
      <button type="button" class="tab-btn" data-tab="diagnostics">Diagnostics</button>
    </nav>

    <main class="admin-main">
      <!-- TAB: PRODUCTS -->
      <section id="tab-products" class="tab-panel active">
        <div class="panel-header">
          <div>
            <h2>Products &amp; Variants</h2>
            <p>Add, edit, duplicate, reorder, hide/show products, or toggle Sold Out.</p>
          </div>
          <button type="button" id="btn-add-product" class="btn btn-primary">+ Add Product</button>
        </div>
        <div id="admin-products-list" class="admin-list"></div>
      </section>

      <!-- TAB: QUICK PRICE EDITOR & BULK ADJUSTMENT -->
      <section id="tab-prices" class="tab-panel" hidden>
        <div class="panel-header">
          <div>
            <h2>Quick Price Editor</h2>
            <p>Edit all product prices and stock in one table, or select products for bulk % / Rs. price updates.</p>
          </div>
          <button type="button" id="btn-save-all-prices-top" class="btn btn-primary">Save all</button>
        </div>

        <div class="form-card bulk-card">
          <div class="bulk-top-row">
            <strong>Bulk Price Action</strong>
            <div class="item-actions">
              <button type="button" id="btn-bulk-select-all" class="btn btn-secondary btn-sm">Select All Products</button>
              <button type="button" id="btn-bulk-deselect-all" class="btn btn-secondary btn-sm">Deselect All</button>
            </div>
          </div>
          <div class="bulk-controls">
            <label class="field">
              <span>Action</span>
              <select id="bulk-direction">
                <option value="increase">Increase prices by</option>
                <option value="decrease">Decrease prices by</option>
              </select>
            </label>
            <label class="field">
              <span>Amount</span>
              <input type="number" id="bulk-amount" min="0" step="1" placeholder="e.g. 10 or 100">
            </label>
            <label class="field">
              <span>Type</span>
              <select id="bulk-mode">
                <option value="percent">% (Percent)</option>
                <option value="fixed">Rs. (Fixed PKR)</option>
              </select>
            </label>
            <label class="toggle-field">
              <input type="checkbox" id="bulk-include-old">
              <span>Also adjust Old Price</span>
            </label>
            <button type="button" id="btn-apply-bulk" class="btn btn-primary">Apply to Selected</button>
          </div>
        </div>

        <div class="table-scroll">
          <table class="price-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Product</th>
                <th>Plan / Variant</th>
                <th>Price (PKR)</th>
                <th>Old Price (Optional)</th>
                <th>In Stock</th>
              </tr>
            </thead>
            <tbody id="quick-price-tbody"></tbody>
          </table>
        </div>

        <div class="panel-footer-bar">
          <button type="button" id="btn-save-all-prices-bottom" class="btn btn-primary btn-lg">Save all</button>
        </div>
      </section>

      <!-- TAB: CATEGORIES -->
      <section id="tab-categories" class="tab-panel" hidden>
        <div class="panel-header">
          <div>
            <h2>Categories</h2>
            <p>Create, rename, reorder, or remove category tabs shown on the storefront.</p>
          </div>
          <button type="button" id="btn-add-category" class="btn btn-primary">+ Add Category</button>
        </div>
        <div id="admin-categories-list" class="admin-list"></div>
      </section>

      <!-- TAB: BANNER & ANNOUNCEMENT -->
      <section id="tab-banner" class="tab-panel" hidden>
        <div class="panel-header">
          <div>
            <h2>Promo Banner &amp; Announcement Bar</h2>
            <p>Edit the top announcement bar (leave blank to hide) and main hero banner.</p>
          </div>
        </div>
        <div class="form-card">
          <label class="field">
            <span>Announcement Bar Text (leave empty to hide)</span>
            <input type="text" id="inp-announcement">
          </label>
          <div class="grid-2">
            <label class="field">
              <span>Banner Tag</span>
              <input type="text" id="inp-banner-tag">
            </label>
            <label class="field">
              <span>Banner Button Text</span>
              <input type="text" id="inp-banner-btn">
            </label>
          </div>
          <label class="field">
            <span>Banner Heading</span>
            <input type="text" id="inp-banner-title">
          </label>
          <label class="field">
            <span>Banner Description Text</span>
            <textarea id="inp-banner-text" rows="3"></textarea>
          </label>

          <div class="field">
            <span>Banner Background Image (JPG, PNG, WEBP, max 2 MB)</span>
            <div class="upload-row">
              <div id="banner-img-preview" class="thumb-box"></div>
              <div class="upload-controls">
                <input type="file" id="file-banner-img" accept="image/jpeg,image/png,image/webp">
                <div class="item-actions">
                  <button type="button" id="btn-pick-banner-img" class="btn btn-secondary btn-sm">Pick Existing Image</button>
                  <button type="button" id="btn-clear-banner-img" class="btn btn-secondary btn-sm">Remove Image</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB: SETTINGS & PAYMENTS -->
      <section id="tab-settings" class="tab-panel" hidden>
        <div class="panel-header">
          <div>
            <h2>Store Settings &amp; Payment Accounts</h2>
            <p>Manage WhatsApp number, shop identity, checkout warning, WhatsApp template, and payment accounts.</p>
          </div>
          <button type="button" id="btn-save-settings" class="btn btn-primary">Save Settings</button>
        </div>

        <div class="form-card">
          <div class="grid-2">
            <label class="field">
              <span>Shop Name</span>
              <input type="text" id="inp-shop-name">
            </label>
            <label class="field">
              <span>WhatsApp Number (digits with country code, e.g. 923424970004)</span>
              <input type="text" id="inp-whatsapp">
            </label>
          </div>
          <label class="field">
            <span>Tagline</span>
            <input type="text" id="inp-tagline">
          </label>
          <label class="field">
            <span>Checkout Payment Warning Message</span>
            <textarea id="inp-payment-warning" rows="2"></textarea>
          </label>
          <label class="field">
            <span>WhatsApp Order Message Template (Placeholders: {shop_name}, {order_id}, {product}, {variant}, {total})</span>
            <textarea id="inp-whatsapp-template" rows="4"></textarea>
          </label>
          <label class="field">
            <span>SEO Page Title</span>
            <input type="text" id="inp-seo-title">
          </label>
          <label class="field">
            <span>SEO Meta Description</span>
            <textarea id="inp-seo-desc" rows="2"></textarea>
          </label>
          <div class="grid-2">
            <label class="field">
              <span>Footer Description</span>
              <input type="text" id="inp-footer-text">
            </label>
            <label class="field">
              <span>Footer Copyright Line</span>
              <input type="text" id="inp-copyright-text">
            </label>
          </div>
        </div>

        <div class="panel-header sub-header">
          <h3>Manual Payment Methods</h3>
          <button type="button" id="btn-add-payment" class="btn btn-primary">+ Add Payment Method</button>
        </div>
        <div id="admin-payments-list" class="admin-list"></div>
      </section>

      <!-- TAB: RESTORE / BACKUPS -->
      <section id="tab-backups" class="tab-panel" hidden>
        <div class="panel-header">
          <div>
            <h2>Restore &amp; Backups</h2>
            <p>Every time you click PUBLISH, a backup of the previous live version is saved automatically (last 20 kept).</p>
          </div>
          <button type="button" id="btn-reset-draft" class="btn btn-secondary">Reset draft to published</button>
        </div>
        <div id="admin-backups-list" class="admin-list"></div>
      </section>

      <!-- TAB: CHANGE PASSWORD -->
      <section id="tab-password" class="tab-panel" hidden>
        <div class="panel-header">
          <div>
            <h2>Change Admin Password</h2>
            <p>Choose a strong password of at least 8 characters.</p>
          </div>
        </div>
        <form id="form-change-password" class="form-card narrow-card">
          <label class="field">
            <span>Current Password</span>
            <input type="password" id="inp-cur-pass" required autocomplete="current-password">
          </label>
          <label class="field">
            <span>New Password (min 8 characters)</span>
            <input type="password" id="inp-new-pass" required minlength="8" autocomplete="new-password">
          </label>
          <label class="field">
            <span>Confirm New Password</span>
            <input type="password" id="inp-confirm-pass" required minlength="8" autocomplete="new-password">
          </label>
          <button type="submit" class="btn btn-primary btn-lg">Update Password</button>
        </form>
      </section>

      <!-- TAB: DIAGNOSTICS -->
      <section id="tab-diagnostics" class="tab-panel" hidden>
        <div class="panel-header">
          <div>
            <h2>Server &amp; Hosting Diagnostics</h2>
            <p>Checks PHP 8 compatibility, writable folders, GD image resizer, and sessions.</p>
          </div>
        </div>
        <div class="diag-grid">
          <?php foreach ($diagnostics as $d): ?>
            <div class="diag-card <?php echo $d['ok'] ? 'diag-ok' : 'diag-fail'; ?>">
              <div class="diag-top">
                <strong><?php echo ss_e($d['label']); ?></strong>
                <span class="diag-status"><?php echo $d['ok'] ? 'PASS' : 'FIX NEEDED'; ?></span>
              </div>
              <div class="diag-val"><?php echo ss_e($d['value']); ?></div>
              <?php if (!$d['ok']): ?>
                <div class="diag-fix">How to fix: <?php echo ss_e($d['fix']); ?></div>
              <?php endif; ?>
            </div>
          <?php endforeach; ?>
        </div>
      </section>
    </main>

    <!-- PRODUCT EDITOR MODAL -->
    <div id="product-editor-modal" class="modal-overlay" hidden>
      <div class="modal-backdrop" id="close-editor-backdrop"></div>
      <div class="modal-card">
        <div class="modal-head">
          <h3 id="editor-modal-title">Edit Product</h3>
          <button type="button" id="btn-close-editor" class="btn btn-secondary btn-sm">&times;</button>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <label class="field">
              <span>Product Name</span>
              <input type="text" id="ed-prod-name">
            </label>
            <label class="field">
              <span>Category</span>
              <select id="ed-prod-category"></select>
            </label>
          </div>

          <label class="field">
            <span>Description</span>
            <textarea id="ed-prod-desc" rows="2"></textarea>
          </label>

          <div class="grid-2">
            <label class="field">
              <span>Fallback Icon (used if no image)</span>
              <select id="ed-prod-icon">
                <option value="gamepad">Gamepad</option>
                <option value="crosshair">Crosshair / Shooter</option>
                <option value="shield">Shield</option>
                <option value="coins">Coins</option>
                <option value="dice">Dice / Board</option>
                <option value="flame">Flame</option>
                <option value="sparkles">Sparkles / AI</option>
                <option value="cpu">CPU / Tech</option>
                <option value="video">Video</option>
                <option value="music">Music</option>
                <option value="tv">TV / Streaming</option>
                <option value="film">Film</option>
                <option value="radio">Radio / IPTV</option>
                <option value="play">Play Button</option>
              </select>
            </label>
            <label class="toggle-field">
              <input type="checkbox" id="ed-prod-visible">
              <span>Visible in public store</span>
            </label>
          </div>

          <div class="field">
            <span>Product Image (JPG, PNG, WEBP, max 2 MB, auto-resized to 900px)</span>
            <div class="upload-row">
              <div id="ed-prod-img-preview" class="thumb-box"></div>
              <div class="upload-controls">
                <input type="file" id="file-prod-img" accept="image/jpeg,image/png,image/webp">
                <div class="item-actions">
                  <button type="button" id="btn-pick-prod-img" class="btn btn-secondary btn-sm">Pick Existing Image</button>
                  <button type="button" id="btn-clear-prod-img" class="btn btn-secondary btn-sm">Remove Image</button>
                </div>
              </div>
            </div>
          </div>

          <div class="panel-header sub-header">
            <h4>Variants / Plans (PKR)</h4>
            <button type="button" id="btn-add-variant" class="btn btn-secondary btn-sm">+ Add Variant</button>
          </div>
          <div id="ed-variants-list" class="variants-editor-list"></div>
        </div>
        <div class="modal-foot">
          <button type="button" id="btn-cancel-editor" class="btn btn-secondary">Cancel</button>
          <button type="button" id="btn-apply-product" class="btn btn-primary">Save Product to Draft</button>
        </div>
      </div>
    </div>

    <!-- EXISTING IMAGE PICKER MODAL -->
    <div id="image-picker-modal" class="modal-overlay" hidden>
      <div class="modal-backdrop" id="close-picker-backdrop"></div>
      <div class="modal-card">
        <div class="modal-head">
          <h3>Pick Existing Image from /images</h3>
          <button type="button" id="btn-close-picker" class="btn btn-secondary btn-sm">&times;</button>
        </div>
        <div class="modal-body">
          <div id="image-picker-grid" class="image-picker-grid"></div>
        </div>
      </div>
    </div>

    <script>
      window.SS_ADMIN_BOOTSTRAP = <?php echo json_encode([
          'csrfToken' => ss_csrf_token(),
          'draft' => $draftData,
          'published' => $publishedData,
          'backups' => $backupsList,
          'existingImages' => ss_list_images(),
          'hasUnpublishedChanges' => $hasUnpublishedChanges,
      ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
    </script>
    <script src="admin.js" defer></script>
    <?php endif; ?>
  </div>
<?php endif; ?>

</body>
</html>
