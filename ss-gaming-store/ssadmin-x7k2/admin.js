/**
 * SS Gaming Store — Upgraded Admin Portal JavaScript
 * Full CMS control: Products (Add/Edit/Duplicate/Delete/Reorder),
 * Variants (Add/Edit/Duplicate/Delete/Reorder + Live Rs. Preview),
 * Quick Price Editor ("Save all") + Bulk % / Rs. Adjustments,
 * Existing Image Picker + Upload, Structured Payment Methods (Reorder/CRUD),
 * Checkout Warning & WhatsApp Message Template, Categories, Banner, Draft/Publish/Restore.
 */

(function () {
  'use strict';

  const boot = window.SS_ADMIN_BOOTSTRAP || {};
  const state = {
    csrfToken: boot.csrfToken || '',
    draft: boot.draft || null,
    published: boot.published || null,
    backups: boot.backups || [],
    existingImages: boot.existingImages || [],
    hasUnpublishedChanges: Boolean(boot.hasUnpublishedChanges),
    editingProductIndex: -1,
    editingProductDraft: null,
    selectedBulkProductIds: new Set(),
    pickerTarget: 'product' // 'product' or 'banner'
  };

  if (!state.draft) return;

  const elFeedback = document.getElementById('admin-feedback');
  const elUnpublishedBadge = document.getElementById('unpublished-badge');
  const elLastPublished = document.getElementById('last-published-label');

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPKR(val) {
    const num = Math.round(Number(val) || 0);
    return 'Rs. ' + num.toLocaleString('en-PK');
  }

  function digitsOnly(val) {
    return String(val ?? '').replace(/[^0-9]/g, '');
  }

  function showFeedback(message, isError) {
    elFeedback.textContent = message;
    elFeedback.className = 'admin-feedback ' + (isError ? 'is-err' : 'is-ok');
    elFeedback.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!isError) {
      setTimeout(function () {
        elFeedback.hidden = true;
      }, 4000);
    }
  }

  function updateUnpublishedIndicator() {
    if (!state.draft || !state.published) return;
    const d = JSON.parse(JSON.stringify(state.draft));
    const p = JSON.parse(JSON.stringify(state.published));
    delete d.meta;
    delete p.meta;
    const dirty = JSON.stringify(d) !== JSON.stringify(p);
    state.hasUnpublishedChanges = dirty;
    elUnpublishedBadge.hidden = !dirty;
  }

  function validateDraftLocally() {
    const s = state.draft.settings || {};
    if (!String(s.shop_name || '').trim()) {
      return 'Shop name cannot be empty.';
    }
    if (!String(s.whatsapp_number || '').trim()) {
      return 'WhatsApp number cannot be empty.';
    }
    const methods = s.payment_methods || [];
    for (let i = 0; i < methods.length; i++) {
      if (!String(methods[i].name || '').trim()) {
        return 'Payment method #' + (i + 1) + ' must have a method name.';
      }
    }
    const products = state.draft.products || [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!String(p.name || '').trim()) {
        return 'Product #' + (i + 1) + ' is missing a name.';
      }
      if (!Array.isArray(p.variants) || p.variants.length === 0) {
        return 'Product "' + p.name + '" must have at least 1 plan/variant.';
      }
      for (let j = 0; j < p.variants.length; j++) {
        const v = p.variants[j];
        if (!String(v.label || '').trim()) {
          return 'Plan #' + (j + 1) + ' on "' + p.name + '" is missing a label.';
        }
        if (isNaN(Number(v.price)) || Number(v.price) < 0) {
          return 'Plan "' + v.label + '" on "' + p.name + '" must have a valid price.';
        }
      }
    }
    return '';
  }

  async function postAction(action, payload) {
    const res = await fetch('action.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action, csrf_token: state.csrfToken }, payload || {}))
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Server returned invalid response (HTTP ' + res.status + '). Check PHP error logs.');
    }
    if (!res.ok || !data.ok) {
      throw new Error(data.error || ('Save failed (HTTP ' + res.status + ')'));
    }
    return data;
  }

  async function saveDraft(silent) {
    collectStaticFormFields();
    const validationErr = validateDraftLocally();
    if (validationErr) {
      showFeedback('Validation Error: ' + validationErr, true);
      return false;
    }
    try {
      const data = await postAction('save_draft', { store: state.draft });
      state.draft = data.draft;
      updateUnpublishedIndicator();
      if (!silent) {
        showFeedback('Saved to draft! Click PUBLISH when ready to push live.', false);
      }
      return true;
    } catch (err) {
      showFeedback('Save Error: ' + err.message, true);
      return false;
    }
  }

  async function publishLive() {
    collectStaticFormFields();
    const validationErr = validateDraftLocally();
    if (validationErr) {
      showFeedback('Cannot publish: ' + validationErr, true);
      return;
    }
    try {
      const data = await postAction('publish', { store: state.draft });
      state.draft = data.draft;
      state.published = JSON.parse(JSON.stringify(data.draft));
      state.backups = data.backups || state.backups;
      elLastPublished.textContent = data.last_published_at || 'Just now';
      updateUnpublishedIndicator();
      renderBackups();
      showFeedback('Published live! Automatic backup saved.', false);
    } catch (err) {
      showFeedback('Publish Error: ' + err.message, true);
    }
  }

  async function uploadImageFile(file) {
    const fd = new FormData();
    fd.append('action', 'upload_image');
    fd.append('csrf_token', state.csrfToken);
    fd.append('image', file);

    const res = await fetch('action.php', { method: 'POST', body: fd });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Upload failed with non-JSON server response (HTTP ' + res.status + ').');
    }
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Image upload failed.');
    }
    if (Array.isArray(data.images)) {
      state.existingImages = data.images;
    }
    return data.path;
  }

  // =========================================================================
  // TABS
  // =========================================================================
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const target = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.hidden = true; });
      btn.classList.add('active');
      document.getElementById('tab-' + target).hidden = false;
      if (target === 'prices') {
        renderQuickPriceTable();
      }
    });
  });

  // =========================================================================
  // PRODUCTS LIST (Add, Edit, Duplicate, Delete, Reorder, Quick Stock)
  // =========================================================================
  function renderProducts() {
    const wrap = document.getElementById('admin-products-list');
    wrap.innerHTML = '';

    (state.draft.products || []).forEach(function (prod, idx) {
      const card = document.createElement('div');
      card.className = 'item-card';

      const thumbHtml = prod.image
        ? '<img src="../' + escapeHtml(prod.image) + '" alt="">'
        : '<span>ICON</span>';

      const visLabel = prod.visible === false ? 'Hidden' : 'Visible';

      const topRow = document.createElement('div');
      topRow.className = 'item-row-top';
      topRow.innerHTML =
        '<div class="item-info">' +
          '<div class="item-thumb">' + thumbHtml + '</div>' +
          '<div>' +
            '<div class="item-title">' + escapeHtml(prod.name) + '</div>' +
            '<div class="item-sub">' + escapeHtml(prod.category) + ' &bull; ' + (prod.variants || []).length + ' plan(s) &bull; ' + visLabel + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="item-actions"></div>';

      const actionsDiv = topRow.querySelector('.item-actions');

      actionsDiv.appendChild(makeBtn('Up', 'btn btn-secondary btn-sm', idx === 0, function () {
        swapItems(state.draft.products, idx, idx - 1);
        renderProducts();
        saveDraft(true);
      }));
      actionsDiv.appendChild(makeBtn('Down', 'btn btn-secondary btn-sm', idx === state.draft.products.length - 1, function () {
        swapItems(state.draft.products, idx, idx + 1);
        renderProducts();
        saveDraft(true);
      }));
      actionsDiv.appendChild(makeBtn('Edit', 'btn btn-primary btn-sm', false, function () {
        openProductEditor(idx);
      }));
      actionsDiv.appendChild(makeBtn('Duplicate', 'btn btn-secondary btn-sm', false, function () {
        const copy = JSON.parse(JSON.stringify(prod));
        copy.id = 'prod_' + Date.now();
        copy.name = prod.name + ' (Copy)';
        copy.variants = (copy.variants || []).map(function (v, vi) {
          v.id = 'v_' + Date.now() + '_' + vi;
          return v;
        });
        state.draft.products.splice(idx + 1, 0, copy);
        renderProducts();
        saveDraft(false);
      }));
      actionsDiv.appendChild(makeBtn('Delete', 'btn btn-danger-outline btn-sm', false, function () {
        if (!confirm('Are you sure you want to delete "' + prod.name + '"?')) return;
        state.draft.products.splice(idx, 1);
        renderProducts();
        saveDraft(false);
      }));

      card.appendChild(topRow);

      if (Array.isArray(prod.variants) && prod.variants.length > 0) {
        const varWrap = document.createElement('div');
        varWrap.className = 'quick-variants';
        prod.variants.forEach(function (v) {
          const inStock = v.in_stock !== false;
          const row = document.createElement('div');
          row.className = 'quick-var-row' + (inStock ? '' : ' is-out');

          const left = document.createElement('span');
          left.textContent = v.label + ' — ' + formatPKR(v.price);

          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'stock-toggle-btn ' + (inStock ? 'in-stock' : 'sold-out');
          toggleBtn.textContent = inStock ? 'In Stock (Mark Sold Out)' : 'Sold Out (Restock)';
          toggleBtn.addEventListener('click', function () {
            v.in_stock = !inStock;
            renderProducts();
            saveDraft(true);
          });

          row.appendChild(left);
          row.appendChild(toggleBtn);
          varWrap.appendChild(row);
        });
        card.appendChild(varWrap);
      }

      wrap.appendChild(card);
    });
  }

  // =========================================================================
  // QUICK PRICE EDITOR TABLE & BULK PRICE ADJUSTMENT
  // =========================================================================
  function renderQuickPriceTable() {
    const tbody = document.getElementById('quick-price-tbody');
    tbody.innerHTML = '';

    (state.draft.products || []).forEach(function (prod) {
      const variants = prod.variants || [];
      variants.forEach(function (v, vIdx) {
        const tr = document.createElement('tr');

        // Product Checkbox (on first variant row of each product)
        const tdCheck = document.createElement('td');
        if (vIdx === 0) {
          const chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.checked = state.selectedBulkProductIds.has(prod.id);
          chk.setAttribute('aria-label', 'Select ' + prod.name);
          chk.addEventListener('change', function () {
            if (chk.checked) {
              state.selectedBulkProductIds.add(prod.id);
            } else {
              state.selectedBulkProductIds.delete(prod.id);
            }
          });
          tdCheck.appendChild(chk);
        }
        tr.appendChild(tdCheck);

        // Product Name
        const tdProd = document.createElement('td');
        if (vIdx === 0) {
          tdProd.innerHTML = '<strong>' + escapeHtml(prod.name) + '</strong><div class="item-sub">' + escapeHtml(prod.category) + '</div>';
        }
        tr.appendChild(tdProd);

        // Variant Label
        const tdLabel = document.createElement('td');
        const labelInp = document.createElement('input');
        labelInp.type = 'text';
        labelInp.value = v.label || '';
        labelInp.addEventListener('input', function () {
          v.label = labelInp.value;
          updateUnpublishedIndicator();
        });
        tdLabel.appendChild(labelInp);
        tr.appendChild(tdLabel);

        // Price (numbers only + Rs. preview)
        const tdPrice = document.createElement('td');
        const priceInp = document.createElement('input');
        priceInp.type = 'number';
        priceInp.min = '0';
        priceInp.step = '1';
        priceInp.value = String(v.price ?? 0);
        const pricePrev = document.createElement('div');
        pricePrev.className = 'price-preview';
        pricePrev.textContent = formatPKR(v.price);

        priceInp.addEventListener('input', function () {
          const clean = digitsOnly(priceInp.value);
          priceInp.value = clean;
          v.price = Number(clean) || 0;
          pricePrev.textContent = formatPKR(v.price);
          updateUnpublishedIndicator();
        });
        tdPrice.appendChild(priceInp);
        tdPrice.appendChild(pricePrev);
        tr.appendChild(tdPrice);

        // Old Price (optional + % OFF preview)
        const tdOld = document.createElement('td');
        const oldInp = document.createElement('input');
        oldInp.type = 'number';
        oldInp.min = '0';
        oldInp.step = '1';
        oldInp.placeholder = 'Optional';
        oldInp.value = v.old_price !== null && v.old_price !== undefined ? String(v.old_price) : '';
        const oldPrev = document.createElement('div');
        oldPrev.className = 'price-preview';
        oldPrev.textContent = formatOldPreview(v.price, v.old_price);

        oldInp.addEventListener('input', function () {
          const clean = digitsOnly(oldInp.value);
          oldInp.value = clean;
          v.old_price = clean === '' ? null : Number(clean);
          oldPrev.textContent = formatOldPreview(v.price, v.old_price);
          updateUnpublishedIndicator();
        });
        tdOld.appendChild(oldInp);
        tdOld.appendChild(oldPrev);
        tr.appendChild(tdOld);

        // In Stock
        const tdStock = document.createElement('td');
        const stockChk = document.createElement('input');
        stockChk.type = 'checkbox';
        stockChk.checked = v.in_stock !== false;
        stockChk.addEventListener('change', function () {
          v.in_stock = stockChk.checked;
          updateUnpublishedIndicator();
        });
        tdStock.appendChild(stockChk);
        tr.appendChild(tdStock);

        tbody.appendChild(tr);
      });
    });
  }

  function formatOldPreview(price, oldPrice) {
    const p = Number(price) || 0;
    const o = Number(oldPrice) || 0;
    if (!o) return '';
    if (o > p && p >= 0) {
      const pct = Math.round(((o - p) / o) * 100);
      return formatPKR(o) + (pct > 0 ? ' (' + pct + '% OFF)' : '');
    }
    return formatPKR(o);
  }

  document.getElementById('btn-bulk-select-all').addEventListener('click', function () {
    (state.draft.products || []).forEach(function (p) {
      state.selectedBulkProductIds.add(p.id);
    });
    renderQuickPriceTable();
  });

  document.getElementById('btn-bulk-deselect-all').addEventListener('click', function () {
    state.selectedBulkProductIds.clear();
    renderQuickPriceTable();
  });

  document.getElementById('btn-apply-bulk').addEventListener('click', function () {
    if (state.selectedBulkProductIds.size === 0) {
      showFeedback('Please tick at least one product checkbox first.', true);
      return;
    }
    const direction = document.getElementById('bulk-direction').value; // increase | decrease
    const mode = document.getElementById('bulk-mode').value; // percent | fixed
    const amount = Number(document.getElementById('bulk-amount').value);
    const includeOld = document.getElementById('bulk-include-old').checked;

    if (isNaN(amount) || amount <= 0) {
      showFeedback('Please enter a positive number for the bulk price amount.', true);
      return;
    }

    const sign = direction === 'decrease' ? -1 : 1;
    let updatedCount = 0;

    (state.draft.products || []).forEach(function (prod) {
      if (!state.selectedBulkProductIds.has(prod.id)) return;
      (prod.variants || []).forEach(function (v) {
        const oldP = Number(v.price) || 0;
        const delta = mode === 'percent' ? (oldP * (amount / 100)) : amount;
        v.price = Math.max(0, Math.round(oldP + sign * delta));

        if (includeOld && v.old_price !== null && v.old_price !== undefined && Number(v.old_price) > 0) {
          const oldOld = Number(v.old_price);
          const oldDelta = mode === 'percent' ? (oldOld * (amount / 100)) : amount;
          v.old_price = Math.max(0, Math.round(oldOld + sign * oldDelta));
        }
        updatedCount++;
      });
    });

    renderQuickPriceTable();
    renderProducts();
    updateUnpublishedIndicator();
    showFeedback('Updated ' + updatedCount + ' plan price(s) in draft. Click "Save all" to write to draft.json.', false);
  });

  ['btn-save-all-prices-top', 'btn-save-all-prices-bottom'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', async function () {
      const ok = await saveDraft(false);
      if (ok) {
        renderProducts();
      }
    });
  });

  // =========================================================================
  // PRODUCT EDITOR MODAL (with Duplicate Variant, Reorder, Image Picker)
  // =========================================================================
  const elEditorModal = document.getElementById('product-editor-modal');
  const elEdName = document.getElementById('ed-prod-name');
  const elEdCategory = document.getElementById('ed-prod-category');
  const elEdDesc = document.getElementById('ed-prod-desc');
  const elEdIcon = document.getElementById('ed-prod-icon');
  const elEdVisible = document.getElementById('ed-prod-visible');
  const elEdImgPreview = document.getElementById('ed-prod-img-preview');
  const elEdVariants = document.getElementById('ed-variants-list');

  function openProductEditor(index) {
    state.editingProductIndex = index;
    if (index === -1) {
      const defaultCat = (state.draft.categories[0] && state.draft.categories[0].name) || 'Gaming';
      state.editingProductDraft = {
        id: 'prod_' + Date.now(),
        name: '',
        category: defaultCat,
        icon: 'gamepad',
        image: '',
        description: '',
        visible: true,
        variants: [{ id: 'v_' + Date.now(), label: '1 Month', price: 500, old_price: null, in_stock: true }]
      };
      document.getElementById('editor-modal-title').textContent = 'Add Product';
    } else {
      state.editingProductDraft = JSON.parse(JSON.stringify(state.draft.products[index]));
      document.getElementById('editor-modal-title').textContent = 'Edit Product';
    }

    const p = state.editingProductDraft;
    elEdName.value = p.name || '';
    elEdDesc.value = p.description || '';
    elEdIcon.value = p.icon || 'gamepad';
    elEdVisible.checked = p.visible !== false;

    elEdCategory.innerHTML = '';
    (state.draft.categories || []).forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      if (c.name === p.category) opt.selected = true;
      elEdCategory.appendChild(opt);
    });

    renderThumbPreview(elEdImgPreview, p.image);
    renderEditorVariants();
    elEditorModal.hidden = false;
  }

  function renderEditorVariants() {
    const variants = state.editingProductDraft.variants || [];
    elEdVariants.innerHTML = '';

    variants.forEach(function (v, vIdx) {
      const row = document.createElement('div');
      row.className = 'variant-editor-row';

      row.innerHTML =
        '<label class="field"><span>Plan / Duration Label</span><input type="text" class="v-label" value="' + escapeHtml(v.label) + '"></label>' +
        '<label class="field"><span>Price (PKR)</span><input type="number" min="0" step="1" class="v-price" value="' + escapeHtml(v.price) + '"><small class="price-preview v-price-prev">' + escapeHtml(formatPKR(v.price)) + '</small></label>' +
        '<label class="field"><span>Old Price (optional)</span><input type="number" min="0" step="1" class="v-old" value="' + escapeHtml(v.old_price ?? '') + '"><small class="price-preview v-old-prev">' + escapeHtml(formatOldPreview(v.price, v.old_price)) + '</small></label>' +
        '<label class="toggle-field"><input type="checkbox" class="v-stock"' + (v.in_stock !== false ? ' checked' : '') + '><span>In Stock</span></label>' +
        '<div class="item-actions"></div>';

      const inpLabel = row.querySelector('.v-label');
      const inpPrice = row.querySelector('.v-price');
      const inpOld = row.querySelector('.v-old');
      const prevPrice = row.querySelector('.v-price-prev');
      const prevOld = row.querySelector('.v-old-prev');

      inpLabel.addEventListener('input', function () { v.label = inpLabel.value; });
      inpPrice.addEventListener('input', function () {
        const clean = digitsOnly(inpPrice.value);
        inpPrice.value = clean;
        v.price = Number(clean) || 0;
        prevPrice.textContent = formatPKR(v.price);
        prevOld.textContent = formatOldPreview(v.price, v.old_price);
      });
      inpOld.addEventListener('input', function () {
        const clean = digitsOnly(inpOld.value);
        inpOld.value = clean;
        v.old_price = clean === '' ? null : Number(clean);
        prevOld.textContent = formatOldPreview(v.price, v.old_price);
      });
      row.querySelector('.v-stock').addEventListener('change', function (e) { v.in_stock = e.target.checked; });

      const act = row.querySelector('.item-actions');
      act.appendChild(makeBtn('↑', 'btn btn-secondary btn-sm', vIdx === 0, function () {
        swapItems(variants, vIdx, vIdx - 1);
        renderEditorVariants();
      }));
      act.appendChild(makeBtn('↓', 'btn btn-secondary btn-sm', vIdx === variants.length - 1, function () {
        swapItems(variants, vIdx, vIdx + 1);
        renderEditorVariants();
      }));
      act.appendChild(makeBtn('Duplicate', 'btn btn-secondary btn-sm', false, function () {
        const dup = JSON.parse(JSON.stringify(v));
        dup.id = 'v_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        dup.label = (v.label || 'Plan') + ' (Copy)';
        variants.splice(vIdx + 1, 0, dup);
        renderEditorVariants();
      }));
      act.appendChild(makeBtn('Delete', 'btn btn-danger-outline btn-sm', variants.length <= 1, function () {
        if (!confirm('Delete variant "' + (v.label || 'this plan') + '"?')) return;
        variants.splice(vIdx, 1);
        renderEditorVariants();
      }));

      elEdVariants.appendChild(row);
    });
  }

  document.getElementById('btn-add-product').addEventListener('click', function () {
    openProductEditor(-1);
  });

  document.getElementById('btn-add-variant').addEventListener('click', function () {
    state.editingProductDraft.variants.push({
      id: 'v_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      label: '',
      price: 0,
      old_price: null,
      in_stock: true
    });
    renderEditorVariants();
  });

  document.getElementById('file-prod-img').addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const path = await uploadImageFile(file);
      state.editingProductDraft.image = path;
      renderThumbPreview(elEdImgPreview, path);
      showFeedback('Product image uploaded and saved to /images.', false);
    } catch (err) {
      showFeedback('Image Upload Error: ' + err.message, true);
    }
    e.target.value = '';
  });

  document.getElementById('btn-clear-prod-img').addEventListener('click', function () {
    state.editingProductDraft.image = '';
    renderThumbPreview(elEdImgPreview, '');
  });

  document.getElementById('btn-apply-product').addEventListener('click', async function () {
    const p = state.editingProductDraft;
    p.name = elEdName.value.trim();
    p.category = elEdCategory.value;
    p.description = elEdDesc.value.trim();
    p.icon = elEdIcon.value;
    p.visible = elEdVisible.checked;

    if (!p.name) {
      alert('Please enter a product name.');
      return;
    }

    for (let i = 0; i < p.variants.length; i++) {
      if (!String(p.variants[i].label || '').trim()) {
        alert('Please enter a label for plan #' + (i + 1));
        return;
      }
      if (isNaN(Number(p.variants[i].price)) || Number(p.variants[i].price) < 0) {
        alert('Please enter a valid PKR price for plan "' + p.variants[i].label + '"');
        return;
      }
    }

    if (state.editingProductIndex === -1) {
      state.draft.products.unshift(p);
    } else {
      state.draft.products[state.editingProductIndex] = p;
    }

    elEditorModal.hidden = true;
    renderProducts();
    await saveDraft(false);
  });

  ['btn-close-editor', 'btn-cancel-editor', 'close-editor-backdrop'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', function () {
      elEditorModal.hidden = true;
    });
  });

  // =========================================================================
  // EXISTING IMAGE PICKER MODAL (shared by Product Editor & Banner)
  // =========================================================================
  const elPickerModal = document.getElementById('image-picker-modal');
  const elPickerGrid = document.getElementById('image-picker-grid');

  function openImagePicker(target) {
    state.pickerTarget = target;
    elPickerGrid.innerHTML = '';

    if (!state.existingImages || state.existingImages.length === 0) {
      elPickerGrid.innerHTML = '<div class="item-sub">No images found in /images yet. Upload one first.</div>';
    } else {
      state.existingImages.forEach(function (imgPath) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'picker-item';
        btn.innerHTML = '<img src="../' + escapeHtml(imgPath) + '" alt=""><span>' + escapeHtml(imgPath.replace('images/', '')) + '</span>';
        btn.addEventListener('click', function () {
          if (state.pickerTarget === 'product' && state.editingProductDraft) {
            state.editingProductDraft.image = imgPath;
            renderThumbPreview(elEdImgPreview, imgPath);
          } else if (state.pickerTarget === 'banner') {
            state.draft.banner.image = imgPath;
            renderThumbPreview(document.getElementById('banner-img-preview'), imgPath);
            updateUnpublishedIndicator();
          }
          elPickerModal.hidden = true;
        });
        elPickerGrid.appendChild(btn);
      });
    }
    elPickerModal.hidden = false;
  }

  document.getElementById('btn-pick-prod-img').addEventListener('click', function () {
    openImagePicker('product');
  });
  document.getElementById('btn-pick-banner-img').addEventListener('click', function () {
    openImagePicker('banner');
  });
  ['btn-close-picker', 'close-picker-backdrop'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', function () {
      elPickerModal.hidden = true;
    });
  });

  // =========================================================================
  // CATEGORIES
  // =========================================================================
  function renderCategories() {
    const wrap = document.getElementById('admin-categories-list');
    wrap.innerHTML = '';

    (state.draft.categories || []).forEach(function (cat, idx) {
      const card = document.createElement('div');
      card.className = 'item-card';

      const row = document.createElement('div');
      row.className = 'item-row-top';
      row.innerHTML =
        '<div><div class="item-title">' + escapeHtml(cat.name) + '</div></div>' +
        '<div class="item-actions"></div>';

      const act = row.querySelector('.item-actions');
      act.appendChild(makeBtn('Up', 'btn btn-secondary btn-sm', idx === 0, function () {
        swapItems(state.draft.categories, idx, idx - 1);
        renderCategories();
        saveDraft(true);
      }));
      act.appendChild(makeBtn('Down', 'btn btn-secondary btn-sm', idx === state.draft.categories.length - 1, function () {
        swapItems(state.draft.categories, idx, idx + 1);
        renderCategories();
        saveDraft(true);
      }));
      act.appendChild(makeBtn('Rename', 'btn btn-secondary btn-sm', false, function () {
        const nextName = prompt('Rename category:', cat.name);
        if (!nextName || !nextName.trim()) return;
        const oldName = cat.name;
        cat.name = nextName.trim();
        (state.draft.products || []).forEach(function (p) {
          if (p.category === oldName) p.category = cat.name;
        });
        renderCategories();
        renderProducts();
        saveDraft(false);
      }));
      act.appendChild(makeBtn('Delete', 'btn btn-danger-outline btn-sm', state.draft.categories.length <= 1, function () {
        if (!confirm('Delete category "' + cat.name + '"?')) return;
        state.draft.categories.splice(idx, 1);
        renderCategories();
        saveDraft(false);
      }));

      card.appendChild(row);
      wrap.appendChild(card);
    });
  }

  document.getElementById('btn-add-category').addEventListener('click', function () {
    const name = prompt('Enter new category name:');
    if (!name || !name.trim()) return;
    state.draft.categories.push({ id: 'cat_' + Date.now(), name: name.trim() });
    renderCategories();
    saveDraft(false);
  });

  // =========================================================================
  // BANNER, SETTINGS & STRUCTURED PAYMENTS
  // =========================================================================
  function populateStaticFormFields() {
    const s = state.draft.settings || {};
    const b = state.draft.banner || {};

    document.getElementById('inp-announcement').value = s.announcement || '';
    document.getElementById('inp-banner-tag').value = b.tag || '';
    document.getElementById('inp-banner-btn').value = b.button_text || '';
    document.getElementById('inp-banner-title').value = b.title || '';
    document.getElementById('inp-banner-text').value = b.text || '';
    renderThumbPreview(document.getElementById('banner-img-preview'), b.image || '');

    document.getElementById('inp-shop-name').value = s.shop_name || '';
    document.getElementById('inp-whatsapp').value = s.whatsapp_number || '';
    document.getElementById('inp-tagline').value = s.tagline || '';
    document.getElementById('inp-payment-warning').value = s.payment_warning || 'After payment, sending the screenshot is a must. Your codes will be delivered on the same WhatsApp chat.';
    document.getElementById('inp-whatsapp-template').value = s.whatsapp_template || "Assalam-o-Alaikum {shop_name}!\nOrder No: {order_id}\nProduct: {product}\nPackage: {variant}\nTotal: {total}\nI have paid, screenshot attached.";
    document.getElementById('inp-seo-title').value = s.seo_title || '';
    document.getElementById('inp-seo-desc').value = s.seo_description || '';
    document.getElementById('inp-footer-text').value = s.footer_text || '';
    document.getElementById('inp-copyright-text').value = s.copyright_text || '';
  }

  function collectStaticFormFields() {
    state.draft.settings.announcement = document.getElementById('inp-announcement').value.trim();
    state.draft.banner.tag = document.getElementById('inp-banner-tag').value.trim();
    state.draft.banner.button_text = document.getElementById('inp-banner-btn').value.trim();
    state.draft.banner.title = document.getElementById('inp-banner-title').value.trim();
    state.draft.banner.text = document.getElementById('inp-banner-text').value.trim();

    state.draft.settings.shop_name = document.getElementById('inp-shop-name').value.trim();
    state.draft.settings.whatsapp_number = document.getElementById('inp-whatsapp').value.replace(/\D+/g, '');
    state.draft.settings.tagline = document.getElementById('inp-tagline').value.trim();
    state.draft.settings.payment_warning = document.getElementById('inp-payment-warning').value.trim();
    state.draft.settings.whatsapp_template = document.getElementById('inp-whatsapp-template').value.trim();
    state.draft.settings.seo_title = document.getElementById('inp-seo-title').value.trim();
    state.draft.settings.seo_description = document.getElementById('inp-seo-desc').value.trim();
    state.draft.settings.footer_text = document.getElementById('inp-footer-text').value.trim();
    state.draft.settings.copyright_text = document.getElementById('inp-copyright-text').value.trim();
  }

  document.getElementById('file-banner-img').addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const path = await uploadImageFile(file);
      state.draft.banner.image = path;
      renderThumbPreview(document.getElementById('banner-img-preview'), path);
      await saveDraft(false);
    } catch (err) {
      showFeedback('Banner Upload Error: ' + err.message, true);
    }
    e.target.value = '';
  });

  document.getElementById('btn-clear-banner-img').addEventListener('click', function () {
    state.draft.banner.image = '';
    renderThumbPreview(document.getElementById('banner-img-preview'), '');
    updateUnpublishedIndicator();
  });

  document.getElementById('btn-save-settings').addEventListener('click', function () {
    saveDraft(false);
  });

  function renderPayments() {
    const wrap = document.getElementById('admin-payments-list');
    wrap.innerHTML = '';

    (state.draft.settings.payment_methods || []).forEach(function (pm, idx) {
      // Normalize legacy lines if structured fields are missing
      if (pm.account_title === undefined) pm.account_title = '';
      if (pm.account_number === undefined) {
        pm.account_number = Array.isArray(pm.lines) ? pm.lines.join(' | ') : '';
      }
      if (pm.extra_note === undefined) pm.extra_note = '';

      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML =
        '<div class="grid-2">' +
          '<label class="field"><span>Method Name (e.g. JazzCash, Meezan Bank)</span><input type="text" class="pm-name" value="' + escapeHtml(pm.name) + '"></label>' +
          '<label class="field"><span>Account Title</span><input type="text" class="pm-title" value="' + escapeHtml(pm.account_title) + '"></label>' +
        '</div>' +
        '<div class="grid-2">' +
          '<label class="field"><span>Account Number / IBAN</span><input type="text" class="pm-number" value="' + escapeHtml(pm.account_number) + '"></label>' +
          '<label class="field"><span>Copy Value (used by Copy button)</span><input type="text" class="pm-copy" value="' + escapeHtml(pm.copy_value) + '"></label>' +
        '</div>' +
        '<label class="field"><span>Extra Note (optional, e.g. IBAN or instructions)</span><input type="text" class="pm-note" value="' + escapeHtml(pm.extra_note) + '"></label>' +
        '<div class="item-actions"></div>';

      card.querySelector('.pm-name').addEventListener('input', function (e) { pm.name = e.target.value; updateUnpublishedIndicator(); });
      card.querySelector('.pm-title').addEventListener('input', function (e) { pm.account_title = e.target.value; updateUnpublishedIndicator(); });
      card.querySelector('.pm-number').addEventListener('input', function (e) { pm.account_number = e.target.value; updateUnpublishedIndicator(); });
      card.querySelector('.pm-copy').addEventListener('input', function (e) { pm.copy_value = e.target.value; updateUnpublishedIndicator(); });
      card.querySelector('.pm-note').addEventListener('input', function (e) { pm.extra_note = e.target.value; updateUnpublishedIndicator(); });

      const act = card.querySelector('.item-actions');
      act.appendChild(makeBtn('Up', 'btn btn-secondary btn-sm', idx === 0, function () {
        swapItems(state.draft.settings.payment_methods, idx, idx - 1);
        renderPayments();
        saveDraft(true);
      }));
      act.appendChild(makeBtn('Down', 'btn btn-secondary btn-sm', idx === state.draft.settings.payment_methods.length - 1, function () {
        swapItems(state.draft.settings.payment_methods, idx, idx + 1);
        renderPayments();
        saveDraft(true);
      }));
      act.appendChild(makeBtn('Delete Method', 'btn btn-danger-outline btn-sm', false, function () {
        if (!confirm('Remove payment method "' + pm.name + '"?')) return;
        state.draft.settings.payment_methods.splice(idx, 1);
        renderPayments();
        saveDraft(false);
      }));

      wrap.appendChild(card);
    });
  }

  document.getElementById('btn-add-payment').addEventListener('click', function () {
    state.draft.settings.payment_methods.push({
      id: 'pm_' + Date.now(),
      name: 'New Bank / Wallet',
      account_title: '',
      account_number: '',
      extra_note: '',
      copy_value: ''
    });
    renderPayments();
    updateUnpublishedIndicator();
  });

  // =========================================================================
  // BACKUPS & RESTORE
  // =========================================================================
  function renderBackups() {
    const wrap = document.getElementById('admin-backups-list');
    wrap.innerHTML = '';

    if (!state.backups || state.backups.length === 0) {
      wrap.innerHTML = '<div class="item-card">No backups yet. A backup is automatically created whenever you click PUBLISH.</div>';
      return;
    }

    state.backups.forEach(function (bk) {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML =
        '<div class="item-row-top">' +
          '<div>' +
            '<div class="item-title">' + escapeHtml(bk.filename) + '</div>' +
            '<div class="item-sub">Saved: ' + escapeHtml(bk.date) + ' &bull; ' + escapeHtml(bk.size_kb) + ' KB</div>' +
          '</div>' +
          '<div class="item-actions"></div>' +
        '</div>';

      const act = card.querySelector('.item-actions');
      act.appendChild(makeBtn('Restore as Published', 'btn btn-primary btn-sm', false, async function () {
        if (!confirm('Restore "' + bk.filename + '" as the live published store?')) return;
        try {
          const data = await postAction('restore_backup', { filename: bk.filename, also_draft: true });
          state.draft = data.draft;
          state.published = JSON.parse(JSON.stringify(data.draft));
          state.backups = data.backups || state.backups;
          elLastPublished.textContent = data.last_published_at;
          populateStaticFormFields();
          renderProducts();
          renderCategories();
          renderPayments();
          renderBackups();
          updateUnpublishedIndicator();
          showFeedback(data.message, false);
        } catch (err) {
          showFeedback('Restore Error: ' + err.message, true);
        }
      }));

      wrap.appendChild(card);
    });
  }

  document.getElementById('btn-reset-draft').addEventListener('click', async function () {
    if (!confirm('Discard all unpublished draft edits and match the live published store?')) return;
    try {
      const data = await postAction('reset_draft', {});
      state.draft = data.draft;
      populateStaticFormFields();
      renderProducts();
      renderCategories();
      renderPayments();
      updateUnpublishedIndicator();
      showFeedback(data.message, false);
    } catch (err) {
      showFeedback('Reset Draft Error: ' + err.message, true);
    }
  });

  // =========================================================================
  // CHANGE PASSWORD
  // =========================================================================
  document.getElementById('form-change-password').addEventListener('submit', async function (e) {
    e.preventDefault();
    const cur = document.getElementById('inp-cur-pass').value;
    const nw = document.getElementById('inp-new-pass').value;
    const conf = document.getElementById('inp-confirm-pass').value;

    try {
      const data = await postAction('change_password', {
        current_password: cur,
        new_password: nw,
        confirm_password: conf
      });
      e.target.reset();
      showFeedback(data.message, false);
    } catch (err) {
      showFeedback('Password Change Error: ' + err.message, true);
    }
  });

  // =========================================================================
  // HELPERS & INIT
  // =========================================================================
  function makeBtn(label, cls, disabled, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.disabled = Boolean(disabled);
    b.addEventListener('click', onClick);
    return b;
  }

  function swapItems(arr, i, j) {
    if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return;
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }

  function renderThumbPreview(container, path) {
    if (path) {
      container.innerHTML = '<img src="../' + escapeHtml(path) + '" alt="Preview">';
    } else {
      container.innerHTML = '<span>No image</span>';
    }
  }

  document.getElementById('btn-save-draft').addEventListener('click', function () {
    saveDraft(false);
  });
  document.getElementById('btn-publish-live').addEventListener('click', function () {
    if (confirm('Publish all draft changes to the live public store?')) {
      publishLive();
    }
  });

  populateStaticFormFields();
  renderProducts();
  renderCategories();
  renderPayments();
  renderBackups();
  updateUnpublishedIndicator();
})();
