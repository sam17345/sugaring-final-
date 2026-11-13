/**
 * SS Gaming Store — Public Storefront Vanilla JavaScript
 * Loads live published JSON from api.php, safely escapes all text,
 * powers category/search filters, variant modal, manual order summary,
 * WhatsApp handoff, and the secret 5-click admin portal opener.
 */

(function () {
  'use strict';

  const state = {
    data: null,
    selectedCategory: 'ALL',
    searchQuery: '',
    activeProduct: null,
    selectedVariantId: null,
    currentOrderId: ''
  };

  // DOM References
  const elAnnouncementBar = document.getElementById('announcement-bar');
  const elAnnouncementText = document.getElementById('announcement-text');
  const elCategoryChips = document.getElementById('category-chips');
  const elProductGrid = document.getElementById('product-grid');
  const elSearchInput = document.getElementById('product-search');
  const elHeroBannerImg = document.getElementById('hero-banner-img');
  const elHeroTag = document.getElementById('hero-tag');
  const elHeroTitle = document.getElementById('hero-title');
  const elHeroText = document.getElementById('hero-text');
  const elHeroBtn = document.getElementById('hero-btn');
  const elHeroWaBtn = document.getElementById('hero-wa-btn');
  const elContactWaLink = document.getElementById('contact-wa-link');
  const elFloatingWaBtn = document.getElementById('floating-wa-btn');
  const elFooterPaymentNames = document.getElementById('footer-payment-names');
  const elFooterDesc = document.getElementById('footer-desc');
  const elFooterShopName = document.getElementById('footer-shop-name');
  const elBrandNameText = document.getElementById('brand-name-text');
  const elCopyright = document.getElementById('ss-copyright-trigger');
  const elLogoTrigger = document.getElementById('ss-logo-trigger');

  // Mobile Menu
  const elMobileMenuBtn = document.getElementById('mobile-menu-btn');
  const elMobileNavDrawer = document.getElementById('mobile-nav-drawer');

  // Modal Elements
  const elModal = document.getElementById('product-modal');
  const elStepVariants = document.getElementById('modal-step-variants');
  const elStepCheckout = document.getElementById('modal-step-checkout');
  const elModalThumb = document.getElementById('modal-product-thumb');
  const elModalCat = document.getElementById('modal-product-cat');
  const elModalTitle = document.getElementById('modal-product-title');
  const elModalDesc = document.getElementById('modal-product-desc');
  const elVariantsList = document.getElementById('modal-variants-list');
  const elBtnOrderNow = document.getElementById('btn-order-now');
  const elBtnAskWa = document.getElementById('btn-ask-wa');
  const elBtnBackVariants = document.getElementById('btn-back-variants');
  const elSummaryOrderId = document.getElementById('summary-order-id');
  const elSummaryProduct = document.getElementById('summary-product');
  const elSummaryVariant = document.getElementById('summary-variant');
  const elSummaryTotal = document.getElementById('summary-total');
  const elCheckoutPayments = document.getElementById('checkout-payment-methods');
  const elCheckoutWarning = document.getElementById('checkout-payment-warning');
  const elBtnSendScreenshot = document.getElementById('btn-send-screenshot-wa');

  /**
   * Escape HTML special characters before inserting untrusted strings into DOM.
   */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Validate relative image path safely.
   */
  function safeImagePath(path) {
    const clean = String(path ?? '').trim();
    if (!clean) return '';
    if (/^(images|assets)\/[a-zA-Z0-9._\-\/]+$/.test(clean) && !clean.includes('..')) {
      return clean;
    }
    return '';
  }

  /**
   * Format PKR price as "Rs. 1,799".
   */
  function formatPKR(amount) {
    const num = Math.round(Number(amount) || 0);
    return 'Rs. ' + num.toLocaleString('en-PK');
  }

  /**
   * Generate order reference SS-XXXXXX.
   */
  function generateOrderId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'SS-' + code;
  }

  /**
   * Return clean inline SVG icon based on product icon key.
   */
  function getProductSvg(iconKey) {
    const icons = {
      gamepad: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>',
      crosshair: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>',
      shield: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      coins: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/></svg>',
      dice: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8.5" cy="15.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/></svg>',
      flame: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
      sparkles: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/></svg>',
      cpu: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>',
      video: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
      music: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      tv: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
      film: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
      radio: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
      play: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>'
    };
    return icons[iconKey] || icons.gamepad;
  }

  /**
   * Build WhatsApp URL with encoded message.
   */
  function buildWhatsAppUrl(message) {
    const phone = (state.data && state.data.settings && state.data.settings.whatsapp_number) || '923424970004';
    return 'https://wa.me/' + encodeURIComponent(phone) + '?text=' + encodeURIComponent(message);
  }

  /**
   * Fetch store data from api.php (published by default, or draft when previewing).
   */
  async function loadStoreData() {
    const isPreview = document.body.getAttribute('data-preview') === 'draft';
    const endpoint = isPreview ? 'api.php?preview=draft' : 'api.php';

    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to load store catalog.');
      }
      state.data = json;
      renderStoreChrome();
      renderCategories();
      renderProducts();
    } catch (err) {
      elProductGrid.innerHTML =
        '<div class="empty-state">Unable to load products right now. ' + escapeHtml(err.message) + '</div>';
    }
  }

  /**
   * Populate announcement bar, banner, footer, and WhatsApp links.
   */
  function renderStoreChrome() {
    const { settings, banner } = state.data;

    const announcement = String(settings.announcement || '').trim();
    if (announcement) {
      elAnnouncementText.textContent = announcement;
      elAnnouncementBar.hidden = false;
    } else {
      elAnnouncementBar.hidden = true;
    }

    if (elBrandNameText) {
      elBrandNameText.textContent = settings.shop_name || 'SS Gaming Store';
    }
    if (elFooterShopName) {
      elFooterShopName.textContent = settings.shop_name || 'SS Gaming Store';
    }
    if (elFooterDesc) {
      elFooterDesc.textContent = settings.footer_text || '';
    }
    if (elCopyright) {
      elCopyright.textContent = settings.copyright_text || '© 2026 SS Gaming Store';
    }

    elHeroTag.textContent = banner.tag || '';
    elHeroTitle.textContent = banner.title || '';
    elHeroText.textContent = banner.text || '';
    elHeroBtn.textContent = banner.button_text || 'Explore Catalog';

    const safeBanner = safeImagePath(banner.image);
    if (safeBanner) {
      elHeroBannerImg.src = safeBanner;
      elHeroBannerImg.hidden = false;
    } else {
      elHeroBannerImg.hidden = true;
    }

    const defaultWaUrl = buildWhatsAppUrl('Assalam-o-Alaikum! I want to inquire about an order at ' + (settings.shop_name || 'SS Gaming Store') + '.');
    elHeroWaBtn.href = defaultWaUrl;
    elContactWaLink.href = defaultWaUrl;
    elFloatingWaBtn.href = defaultWaUrl;

    // Render payment method names in footer
    elFooterPaymentNames.innerHTML = '';
    (settings.payment_methods || []).forEach(function (pm) {
      const li = document.createElement('li');
      li.textContent = pm.name || '';
      elFooterPaymentNames.appendChild(li);
    });
  }

  /**
   * Render interactive "Browse by Category" chips.
   */
  function renderCategories() {
    const categories = state.data.categories || [];
    elCategoryChips.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'cat-chip' + (state.selectedCategory === 'ALL' ? ' active' : '');
    allBtn.textContent = 'All Products';
    allBtn.addEventListener('click', function () {
      state.selectedCategory = 'ALL';
      renderCategories();
      renderProducts();
    });
    elCategoryChips.appendChild(allBtn);

    categories.forEach(function (cat) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-chip' + (state.selectedCategory === cat.name ? ' active' : '');
      btn.textContent = cat.name;
      btn.addEventListener('click', function () {
        state.selectedCategory = cat.name;
        renderCategories();
        renderProducts();
      });
      elCategoryChips.appendChild(btn);
    });
  }

  /**
   * Render product card grid based on active category & search query.
   */
  function renderProducts() {
    const products = state.data.products || [];
    const query = state.searchQuery.trim().toLowerCase();

    const filtered = products.filter(function (p) {
      const matchesCat = state.selectedCategory === 'ALL' || p.category === state.selectedCategory;
      const matchesSearch = !query ||
        String(p.name || '').toLowerCase().includes(query) ||
        String(p.category || '').toLowerCase().includes(query) ||
        String(p.description || '').toLowerCase().includes(query);
      return matchesCat && matchesSearch;
    });

    elProductGrid.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No products match your filter.';
      elProductGrid.appendChild(empty);
      return;
    }

    filtered.forEach(function (product) {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const inStockPrices = variants
        .filter(function (v) { return v.in_stock !== false; })
        .map(function (v) { return Number(v.price) || 0; });

      const hasStock = inStockPrices.length > 0;
      const lowestPrice = hasStock ? Math.min.apply(null, inStockPrices) : 0;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'product-card';
      card.addEventListener('click', function () {
        openProductModal(product);
      });

      const imgSrc = safeImagePath(product.image);
      const mediaHtml = imgSrc
        ? '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
        : '<div class="card-icon-wrap">' + getProductSvg(product.icon) + '</div>';

      const priceText = hasStock ? ('From ' + formatPKR(lowestPrice)) : 'Out of stock';
      const hiddenBadge = product.visible === false ? ' · Hidden' : '';

      card.innerHTML =
        '<div class="card-media">' + mediaHtml + '</div>' +
        '<div class="card-body">' +
          '<span class="card-cat-badge">' + escapeHtml(product.category) + escapeHtml(hiddenBadge) + '</span>' +
          '<h3 class="card-title">' + escapeHtml(product.name) + '</h3>' +
          '<div class="card-footer">' +
            '<span class="card-price mono-num' + (hasStock ? '' : ' sold-out') + '">' + escapeHtml(priceText) + '</span>' +
            '<span class="card-action-hint">' + (hasStock ? 'View packs &rarr;' : 'Unavailable') + '</span>' +
          '</div>' +
        '</div>';

      elProductGrid.appendChild(card);
    });
  }

  /**
   * Open product popup and populate selectable variants.
   */
  function openProductModal(product) {
    state.activeProduct = product;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const firstInStock = variants.find(function (v) { return v.in_stock !== false; });
    state.selectedVariantId = firstInStock ? firstInStock.id : null;

    const imgSrc = safeImagePath(product.image);
    elModalThumb.innerHTML = imgSrc
      ? '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(product.name) + '">'
      : getProductSvg(product.icon);

    elModalCat.textContent = product.category || '';
    elModalTitle.textContent = product.name || '';
    elModalDesc.textContent = product.description || '';

    renderVariantRows();
    updateAskWhatsAppLink();

    elStepVariants.hidden = false;
    elStepCheckout.hidden = true;
    elModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function renderVariantRows() {
    const variants = Array.isArray(state.activeProduct.variants) ? state.activeProduct.variants : [];
    elVariantsList.innerHTML = '';

    variants.forEach(function (variant) {
      const inStock = variant.in_stock !== false;
      const isSelected = inStock && variant.id === state.selectedVariantId;
      const price = Number(variant.price) || 0;
      const oldPrice = variant.old_price ? Number(variant.old_price) : 0;

      let discountHtml = '';
      if (oldPrice > price) {
        const pct = Math.round(((oldPrice - price) / oldPrice) * 100);
        discountHtml =
          '<span class="variant-old-price mono-num">' + escapeHtml(formatPKR(oldPrice)) + '</span>' +
          (pct > 0 ? '<span class="variant-off-badge">' + pct + '% OFF</span>' : '');
      }

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'variant-row' + (isSelected ? ' selected' : '') + (!inStock ? ' sold-out' : '');
      row.disabled = !inStock;

      row.innerHTML =
        '<span class="variant-label">' + escapeHtml(variant.label) + '</span>' +
        '<span class="variant-pricing">' +
          discountHtml +
          (inStock
            ? '<span class="variant-price mono-num">' + escapeHtml(formatPKR(price)) + '</span>'
            : '<span class="variant-sold-tag">Sold out</span>') +
        '</span>';

      if (inStock) {
        row.addEventListener('click', function () {
          state.selectedVariantId = variant.id;
          renderVariantRows();
          updateAskWhatsAppLink();
        });
      }

      elVariantsList.appendChild(row);
    });

    elBtnOrderNow.disabled = !state.selectedVariantId;
  }

  function getSelectedVariant() {
    if (!state.activeProduct || !state.selectedVariantId) return null;
    return (state.activeProduct.variants || []).find(function (v) {
      return v.id === state.selectedVariantId && v.in_stock !== false;
    }) || null;
  }

  function updateAskWhatsAppLink() {
    const product = state.activeProduct;
    const variant = getSelectedVariant();
    const msg = variant
      ? 'Assalam-o-Alaikum! I have a question about ' + product.name + ' (' + variant.label + ').'
      : 'Assalam-o-Alaikum! I have a question about ' + product.name + '.';
    elBtnAskWa.href = buildWhatsAppUrl(msg);
  }

  /**
   * Switch modal to Order Summary & Manual Payment screen.
   */
  function showCheckoutStep() {
    const product = state.activeProduct;
    const variant = getSelectedVariant();
    if (!product || !variant) return;

    state.currentOrderId = generateOrderId();
    const totalFormatted = formatPKR(variant.price);

    elSummaryOrderId.textContent = state.currentOrderId;
    elSummaryProduct.textContent = product.name;
    elSummaryVariant.textContent = variant.label;
    elSummaryTotal.textContent = totalFormatted;

    elCheckoutPayments.innerHTML = '';
    const methods = (state.data && state.data.settings && state.data.settings.payment_methods) || [];

    methods.forEach(function (pm) {
      const card = document.createElement('div');
      card.className = 'payment-card';

      const infoDiv = document.createElement('div');
      const nameEl = document.createElement('div');
      nameEl.className = 'payment-name';
      nameEl.textContent = pm.name || '';
      infoDiv.appendChild(nameEl);

      const linesWrap = document.createElement('div');
      linesWrap.className = 'payment-lines';

      const displayLines = [];
      if (pm.account_title) displayLines.push('Account Title: ' + pm.account_title);
      if (pm.account_number) displayLines.push('Account / IBAN: ' + pm.account_number);
      if (pm.extra_note) displayLines.push(pm.extra_note);
      if (displayLines.length === 0 && Array.isArray(pm.lines)) {
        pm.lines.forEach(function (l) { if (l) displayLines.push(l); });
      }

      displayLines.forEach(function (line) {
        const lineEl = document.createElement('span');
        lineEl.textContent = line;
        linesWrap.appendChild(lineEl);
      });
      infoDiv.appendChild(linesWrap);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', function () {
        copyToClipboard(pm.copy_value || pm.account_number || '', copyBtn);
      });

      card.appendChild(infoDiv);
      card.appendChild(copyBtn);
      elCheckoutPayments.appendChild(card);
    });

    const settings = (state.data && state.data.settings) || {};
    if (elCheckoutWarning) {
      elCheckoutWarning.textContent = settings.payment_warning || 'After payment, sending the screenshot is a must. Your codes will be delivered on the same WhatsApp chat.';
    }

    const template = String(
      settings.whatsapp_template ||
      'Assalam-o-Alaikum {shop_name}!\nOrder No: {order_id}\nProduct: {product}\nPackage: {variant}\nTotal: {total}\nI have paid, screenshot attached.'
    );

    const waMsg = template
      .replace(/\{shop_name\}/g, settings.shop_name || 'SS Gaming Store')
      .replace(/\{order_id\}/g, state.currentOrderId)
      .replace(/\{product\}/g, product.name)
      .replace(/\{variant\}/g, variant.label)
      .replace(/\{total\}/g, totalFormatted);

    elBtnSendScreenshot.href = buildWhatsAppUrl(waMsg);

    elStepVariants.hidden = true;
    elStepCheckout.hidden = false;
  }

  function copyToClipboard(text, btn) {
    const val = String(text || '');
    if (!val) return;

    const markCopied = function () {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = orig;
        btn.classList.remove('copied');
      }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val).then(markCopied).catch(function () {
        fallbackCopy(val);
        markCopied();
      });
    } else {
      fallbackCopy(val);
      markCopied();
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function closeModal() {
    elModal.hidden = true;
    document.body.style.overflow = '';
  }

  /**
   * Secret 5-click trigger on Logo or Copyright text to open hidden admin portal.
   */
  function attachSecretPortalTrigger(el) {
    if (!el) return;
    let clicks = 0;
    let timer = null;

    el.addEventListener('click', async function (e) {
      clicks++;
      if (clicks >= 2 && el.tagName === 'A') {
        e.preventDefault();
      }
      clearTimeout(timer);
      timer = setTimeout(function () {
        clicks = 0;
      }, 2200);

      if (clicks >= 5) {
        clicks = 0;
        clearTimeout(timer);
        try {
          const res = await fetch('api.php?action=portal', { cache: 'no-store' });
          const data = await res.json();
          if (data && data.ok && data.url) {
            window.location.href = data.url;
          }
        } catch (err) {
          // Silent fail so normal visitors notice nothing
        }
      }
    });
  }

  // Event Wiring
  if (elSearchInput) {
    elSearchInput.addEventListener('input', function () {
      state.searchQuery = elSearchInput.value;
      renderProducts();
    });
  }

  if (elMobileMenuBtn && elMobileNavDrawer) {
    elMobileMenuBtn.addEventListener('click', function () {
      const isHidden = elMobileNavDrawer.hidden;
      elMobileNavDrawer.hidden = !isHidden;
      elMobileMenuBtn.setAttribute('aria-expanded', String(isHidden));
    });
    elMobileNavDrawer.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        elMobileNavDrawer.hidden = true;
        elMobileMenuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('[data-close-modal]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !elModal.hidden) {
      closeModal();
    }
  });

  if (elBtnOrderNow) {
    elBtnOrderNow.addEventListener('click', showCheckoutStep);
  }
  if (elBtnBackVariants) {
    elBtnBackVariants.addEventListener('click', function () {
      elStepCheckout.hidden = true;
      elStepVariants.hidden = false;
    });
  }

  attachSecretPortalTrigger(elLogoTrigger);
  attachSecretPortalTrigger(elCopyright);

  // Initialize Store
  loadStoreData();
})();
