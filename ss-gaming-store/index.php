<?php
/**
 * SS Gaming Store - Public Storefront Entry Point
 * Loads initial published data for SEO & fast first paint, then hydrates live from api.php.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

$isPreviewRequest = (($_GET['preview'] ?? '') === 'draft');
$previewActive = false;

if ($isPreviewRequest) {
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
    if (!empty($_SESSION['ss_admin_logged_in']) && $lastActivity > 0 && (time() - $lastActivity) <= SS_SESSION_IDLE_TIMEOUT) {
        $previewActive = true;
    }
}

$store = ss_json_read($previewActive ? SS_DRAFT_FILE : SS_PUBLISHED_FILE, []);
$settings = is_array($store['settings'] ?? null) ? $store['settings'] : [];
$banner = is_array($store['banner'] ?? null) ? $store['banner'] : [];

$shopName = (string)($settings['shop_name'] ?? 'SS Gaming Store');
$seoTitle = (string)($settings['seo_title'] ?? ($shopName . ' — Digital Top-Ups & Subscriptions Pakistan'));
$seoDesc = (string)($settings['seo_description'] ?? 'Buy gaming top-ups, UC, Game Pass, and digital subscriptions in Pakistan.');
$announcement = trim((string)($settings['announcement'] ?? ''));
$whatsapp = preg_replace('/\D+/', '', (string)($settings['whatsapp_number'] ?? '923424970004'));
$bannerImg = (string)($banner['image'] ?? '');
$hasLogoPng = is_file(SS_ASSETS_DIR . '/logo.png');
$copyrightText = (string)($settings['copyright_text'] ?? ('© ' . date('Y') . ' ' . $shopName));
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo ss_e($seoTitle); ?></title>
  <meta name="description" content="<?php echo ss_e($seoDesc); ?>">
  <meta property="og:title" content="<?php echo ss_e($seoTitle); ?>">
  <meta property="og:description" content="<?php echo ss_e($seoDesc); ?>">
  <meta property="og:type" content="website">
  <?php if ($bannerImg !== ''): ?>
  <meta property="og:image" content="<?php echo ss_e($bannerImg); ?>">
  <?php endif; ?>
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#070b14">
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body data-preview="<?php echo $previewActive ? 'draft' : 'published'; ?>">

  <?php if ($previewActive): ?>
  <div class="preview-banner" role="status">
    <span>Draft Preview Mode — Changes shown here are not live yet.</span>
    <a href="<?php echo ss_e(SS_ADMIN_FOLDER); ?>/">Back to Admin</a>
  </div>
  <?php endif; ?>

  <!-- Announcement Bar (hidden if empty) -->
  <div id="announcement-bar" class="announcement-bar" <?php echo $announcement === '' ? 'hidden' : ''; ?>>
    <div class="container announcement-inner">
      <span id="announcement-text"><?php echo ss_e($announcement); ?></span>
    </div>
  </div>

  <!-- Navbar -->
  <header class="site-header">
    <div class="container header-inner">
      <a href="#home" id="ss-logo-trigger" class="brand-link" aria-label="<?php echo ss_e($shopName); ?>">
        <?php if ($hasLogoPng): ?>
          <img src="assets/logo.png" alt="<?php echo ss_e($shopName); ?>" class="brand-logo-img">
        <?php else: ?>
          <span class="brand-mark" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="14" fill="#3b82f6" fill-opacity="0.16"/>
              <path d="M32 10L50 18V32C50 43.2 42.1 51.4 32 54.5C21.9 51.4 14 43.2 14 32V18L32 10Z" stroke="#3b82f6" stroke-width="4"/>
              <path d="M25 26C25 23.6 26.9 22 29.8 22H36.8V26H30C29.1 26 28.6 26.4 28.6 27.1C28.6 27.8 29.1 28.2 30.3 28.5L34.5 29.7C37.4 30.5 39 32.1 39 34.8C39 37.8 36.6 40 32.9 40H25.2V36H32.5C33.7 36 34.4 35.5 34.4 34.7C34.4 33.9 33.8 33.5 32.5 33.1L28.3 32C25.9 31.3 25 29.4 25 26Z" fill="#3b82f6"/>
            </svg>
          </span>
          <span id="brand-name-text" class="brand-wordmark"><?php echo ss_e($shopName); ?></span>
        <?php endif; ?>
      </a>

      <nav class="main-nav" aria-label="Primary Navigation">
        <a href="#home" class="nav-link">Home</a>
        <a href="#store" class="nav-link">Store</a>
        <a href="#contact" class="nav-link">Contact</a>
      </nav>

      <div class="header-actions">
        <a href="#store" class="btn btn-primary btn-sm nav-cta">Browse Deals</a>
        <button type="button" id="mobile-menu-btn" class="mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <div id="mobile-nav-drawer" class="mobile-nav-drawer" hidden>
      <a href="#home" class="mobile-nav-link">Home</a>
      <a href="#store" class="mobile-nav-link">Store</a>
      <a href="#policies" class="mobile-nav-link">Policies</a>
      <a href="#contact" class="mobile-nav-link">Contact</a>
    </div>
  </header>

  <main>
    <!-- Big Promo Banner -->
    <section id="home" class="hero-section">
      <div class="container">
        <div id="hero-banner" class="hero-banner">
          <?php if ($bannerImg !== ''): ?>
            <img id="hero-banner-img" src="<?php echo ss_e($bannerImg); ?>" alt="Featured gaming store promotion" class="hero-bg-img">
          <?php else: ?>
            <img id="hero-banner-img" src="" alt="" class="hero-bg-img" hidden>
          <?php endif; ?>
          <div class="hero-scrim" aria-hidden="true"></div>
          <div class="hero-content">
            <span id="hero-tag" class="hero-tag"><?php echo ss_e($banner['tag'] ?? "Pakistan's Digital Vault"); ?></span>
            <h1 id="hero-title" class="hero-title"><?php echo ss_e($banner['title'] ?? 'Instant Game Top-Ups & Premium Passes'); ?></h1>
            <p id="hero-text" class="hero-text"><?php echo ss_e($banner['text'] ?? 'Verified digital products delivered on WhatsApp.'); ?></p>
            <div class="hero-actions">
              <a href="#store" id="hero-btn" class="btn btn-primary btn-lg"><?php echo ss_e($banner['button_text'] ?? 'Explore Catalog'); ?></a>
              <a href="https://wa.me/<?php echo ss_e($whatsapp); ?>" target="_blank" rel="noopener noreferrer" id="hero-wa-btn" class="btn btn-secondary btn-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" aria-hidden="true"><path d="M12.031 2C6.51 2 2.018 6.492 2.018 12.013c0 1.766.462 3.49 1.339 5.01L2 22l5.106-1.339a9.975 9.975 0 0 0 4.925 1.293h.004c5.52 0 10.012-4.492 10.014-10.013C22.05 6.492 17.552 2 12.031 2Zm5.828 14.236c-.246.693-1.43 1.326-1.976 1.408-.497.074-1.142.106-1.842-.116-.424-.135-.969-.315-1.668-.617-2.936-1.268-4.853-4.237-5-4.432-.147-.195-1.193-1.588-1.193-3.03 0-1.441.756-2.15 1.024-2.444.268-.293.586-.366.781-.366.195 0 .391.002.562.01.18.009.422-.068.66.504.244.586.83 2.028.904 2.175.073.147.122.318.024.513-.098.195-.147.318-.293.489-.147.171-.309.382-.44.513-.146.146-.299.305-.129.598.171.293.758 1.251 1.628 2.027 1.119.998 2.062 1.307 2.355 1.454.293.147.464.122.635-.073.171-.195.732-.855.928-1.148.195-.293.39-.244.659-.146.268.097 1.708.806 2.001.952.293.147.488.22.561.342.073.122.073.708-.173 1.401Z"/></svg>
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Store Catalog Section -->
    <section id="store" class="store-section">
      <div class="container">
        <div class="store-toolbar">
          <div>
            <h2 class="section-title">Browse by Category</h2>
            <p class="section-subtitle">Select any product to compare packages and order in PKR.</p>
          </div>
          <div class="search-wrap">
            <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="search" id="product-search" class="search-input" placeholder="Search UC, Game Pass, Netflix..." aria-label="Search products">
          </div>
        </div>

        <!-- Category Chips -->
        <div id="category-chips" class="category-chips" role="tablist" aria-label="Product categories">
          <button type="button" class="cat-chip active" data-category="ALL">All Products</button>
        </div>

        <!-- Product Grid -->
        <div id="product-grid" class="product-grid" aria-live="polite">
          <div class="loading-state">Loading products...</div>
        </div>
      </div>
    </section>

    <!-- About, Refund Policy & Terms -->
    <section id="policies" class="info-section">
      <div class="container">
        <div class="info-grid">
          <article class="info-card" id="about">
            <h3>About SS Gaming Store</h3>
            <p>We supply gamers, creators, and streamers across Pakistan with authentic top-ups, Game Pass memberships, and digital subscriptions at fair PKR prices with fast manual verification on WhatsApp.</p>
          </article>
          <article class="info-card" id="refund-policy">
            <h3>Refund Policy</h3>
            <p><strong>No refund after code or account delivery.</strong> Because digital codes, UC top-ups, and activation slots are consumed immediately upon delivery, all completed orders are final. If an issue occurs before delivery, we provide a full replacement or refund.</p>
          </article>
          <article class="info-card" id="terms">
            <h3>Terms &amp; Delivery</h3>
            <p>Verify your Player ID / UID and selected package carefully before paying. After transferring via JazzCash, Easypaisa, or Meezan Bank, sending your payment screenshot on WhatsApp is mandatory to release your order.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Contact Section -->
    <section id="contact" class="contact-section">
      <div class="container">
        <div class="contact-box">
          <div>
            <h2>Need Help With an Order?</h2>
            <p>Message us directly on WhatsApp for custom bundles, bulk top-ups, or instant support across Pakistan.</p>
          </div>
          <a id="contact-wa-link" href="https://wa.me/<?php echo ss_e($whatsapp); ?>" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg">
            Message on WhatsApp
          </a>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-col">
          <div class="footer-brand" id="footer-shop-name"><?php echo ss_e($shopName); ?></div>
          <p class="footer-desc" id="footer-desc"><?php echo ss_e($settings['footer_text'] ?? ''); ?></p>
        </div>
        <div class="footer-col">
          <div class="footer-heading">Accepted Payments</div>
          <ul id="footer-payment-names" class="footer-list">
            <?php foreach (($settings['payment_methods'] ?? []) as $pm): ?>
              <li><?php echo ss_e($pm['name'] ?? ''); ?></li>
            <?php endforeach; ?>
          </ul>
        </div>
        <div class="footer-col">
          <div class="footer-heading">Quick Links</div>
          <ul class="footer-list">
            <li><a href="#about">About Us</a></li>
            <li><a href="#refund-policy">Refund Policy</a></li>
            <li><a href="#terms">Terms</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span id="ss-copyright-trigger" class="copyright-text" title="SS Gaming Store"><?php echo ss_e($copyrightText); ?></span>
        <span class="footer-region">Pakistan • PKR Manual Checkout</span>
      </div>
    </div>
  </footer>

  <!-- Floating WhatsApp Button -->
  <a id="floating-wa-btn" href="https://wa.me/<?php echo ss_e($whatsapp); ?>" target="_blank" rel="noopener noreferrer" class="floating-wa" aria-label="Chat on WhatsApp">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.031 2C6.51 2 2.018 6.492 2.018 12.013c0 1.766.462 3.49 1.339 5.01L2 22l5.106-1.339a9.975 9.975 0 0 0 4.925 1.293h.004c5.52 0 10.012-4.492 10.014-10.013C22.05 6.492 17.552 2 12.031 2Zm5.828 14.236c-.246.693-1.43 1.326-1.976 1.408-.497.074-1.142.106-1.842-.116-.424-.135-.969-.315-1.668-.617-2.936-1.268-4.853-4.237-5-4.432-.147-.195-1.193-1.588-1.193-3.03 0-1.441.756-2.15 1.024-2.444.268-.293.586-.366.781-.366.195 0 .391.002.562.01.18.009.422-.068.66.504.244.586.83 2.028.904 2.175.073.147.122.318.024.513-.098.195-.147.318-.293.489-.147.171-.309.382-.44.513-.146.146-.299.305-.129.598.171.293.758 1.251 1.628 2.027 1.119.998 2.062 1.307 2.355 1.454.293.147.464.122.635-.073.171-.195.732-.855.928-1.148.195-.293.39-.244.659-.146.268.097 1.708.806 2.001.952.293.147.488.22.561.342.073.122.073.708-.173 1.401Z"/>
    </svg>
    <span class="floating-wa-label">WhatsApp</span>
  </a>

  <!-- Product Variants Modal -->
  <div id="product-modal" class="modal-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="modal-product-title">
    <div class="modal-backdrop" data-close-modal></div>
    <div class="modal-card">
      <button type="button" class="modal-close" data-close-modal aria-label="Close popup">&times;</button>

      <!-- Step 1: Variant Picker -->
      <div id="modal-step-variants">
        <div class="modal-header">
          <div id="modal-product-thumb" class="modal-thumb"></div>
          <div>
            <span id="modal-product-cat" class="modal-cat-label"></span>
            <h2 id="modal-product-title" class="modal-title"></h2>
            <p id="modal-product-desc" class="modal-desc"></p>
          </div>
        </div>

        <div class="variant-section-label">Choose a Package</div>
        <div id="modal-variants-list" class="variants-list"></div>

        <div class="modal-actions">
          <button type="button" id="btn-order-now" class="btn btn-primary btn-lg">Order now</button>
          <a id="btn-ask-wa" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" aria-hidden="true"><path d="M12.031 2C6.51 2 2.018 6.492 2.018 12.013c0 1.766.462 3.49 1.339 5.01L2 22l5.106-1.339a9.975 9.975 0 0 0 4.925 1.293h.004c5.52 0 10.012-4.492 10.014-10.013C22.05 6.492 17.552 2 12.031 2Zm5.828 14.236c-.246.693-1.43 1.326-1.976 1.408-.497.074-1.142.106-1.842-.116-.424-.135-.969-.315-1.668-.617-2.936-1.268-4.853-4.237-5-4.432-.147-.195-1.193-1.588-1.193-3.03 0-1.441.756-2.15 1.024-2.444.268-.293.586-.366.781-.366.195 0 .391.002.562.01.18.009.422-.068.66.504.244.586.83 2.028.904 2.175.073.147.122.318.024.513-.098.195-.147.318-.293.489-.147.171-.309.382-.44.513-.146.146-.299.305-.129.598.171.293.758 1.251 1.628 2.027 1.119.998 2.062 1.307 2.355 1.454.293.147.464.122.635-.073.171-.195.732-.855.928-1.148.195-.293.39-.244.659-.146.268.097 1.708.806 2.001.952.293.147.488.22.561.342.073.122.073.708-.173 1.401Z"/></svg>
            Ask on WhatsApp
          </a>
        </div>
      </div>

      <!-- Step 2: Order Summary & Manual Payment -->
      <div id="modal-step-checkout" hidden>
        <button type="button" id="btn-back-variants" class="back-link">&larr; Change package</button>
        <h2 class="modal-title">Complete Your Order</h2>

        <div class="order-summary-box">
          <div class="summary-row">
            <span>Order Number</span>
            <strong id="summary-order-id" class="mono-num"></strong>
          </div>
          <div class="summary-row">
            <span>Product</span>
            <strong id="summary-product"></strong>
          </div>
          <div class="summary-row">
            <span>Package</span>
            <strong id="summary-variant"></strong>
          </div>
          <div class="summary-row summary-total">
            <span>Total Payable</span>
            <strong id="summary-total" class="mono-num"></strong>
          </div>
        </div>

        <div class="variant-section-label">Send Manual Payment To Any Account</div>
        <div id="checkout-payment-methods" class="payment-methods-list"></div>

        <div id="checkout-payment-warning" class="payment-warning" role="alert">
          <?php echo ss_e($settings['payment_warning'] ?? 'After payment, sending the screenshot is a must. Your codes will be delivered on the same WhatsApp chat.'); ?>
        </div>

        <a id="btn-send-screenshot-wa" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg btn-full">
          Send screenshot on WhatsApp
        </a>
      </div>
    </div>
  </div>

  <script src="app.js" defer></script>
</body>
</html>
