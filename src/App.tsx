import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Coins,
  Copy,
  CopyPlus,
  Cpu,
  Crosshair,
  Dices,
  Film,
  Flame,
  Gamepad2,
  Menu,
  MessageCircle,
  Music,
  PlayCircle,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Tv,
  Video,
  X,
} from 'lucide-react';
import bannerImg from './assets/images/hero_gaming_banner_1794547038066.jpg';
import logoImg from './assets/images/ss_gaming_logo_1794547038147.jpg';
import { INITIAL_STORE_DATA, PaymentMethod, Product, StoreData, Variant } from './data/storeData';

function formatPKR(amount: number): string {
  return 'Rs. ' + Math.round(amount).toLocaleString('en-PK');
}

function generateOrderId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'SS-' + out;
}

function digitsOnly(val: string): string {
  return val.replace(/[^0-9]/g, '');
}

function swapItems<T>(list: T[], i: number, j: number): T[] {
  if (i < 0 || j < 0 || i >= list.length || j >= list.length) return list;
  const next = [...list];
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return next;
}

function ProductIcon({ iconKey }: { iconKey: string }) {
  const cls = 'w-7 h-7';
  switch (iconKey) {
    case 'crosshair':
      return <Crosshair className={cls} />;
    case 'shield':
      return <Shield className={cls} />;
    case 'coins':
      return <Coins className={cls} />;
    case 'dice':
      return <Dices className={cls} />;
    case 'flame':
      return <Flame className={cls} />;
    case 'sparkles':
      return <Sparkles className={cls} />;
    case 'cpu':
      return <Cpu className={cls} />;
    case 'video':
      return <Video className={cls} />;
    case 'music':
      return <Music className={cls} />;
    case 'tv':
      return <Tv className={cls} />;
    case 'film':
      return <Film className={cls} />;
    case 'radio':
      return <Radio className={cls} />;
    case 'play':
      return <PlayCircle className={cls} />;
    default:
      return <Gamepad2 className={cls} />;
  }
}

export default function App() {
  const [publishedData, setPublishedData] = useState<StoreData>(INITIAL_STORE_DATA);
  const [draftData, setDraftData] = useState<StoreData>(INITIAL_STORE_DATA);
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState<StoreData>(INITIAL_STORE_DATA);
  const [backups, setBackups] = useState<{ id: string; date: string; data: StoreData }[]>([]);
  const [isPreviewDraft, setIsPreviewDraft] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'variants' | 'checkout'>('variants');
  const [orderId, setOrderId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Hidden Admin Portal state
  const [adminView, setAdminView] = useState<'none' | 'setup' | 'login' | 'dashboard'>('none');
  const [adminPasswordHash, setAdminPasswordHash] = useState<string | null>(null);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminTab, setAdminTab] = useState<
    'products' | 'prices' | 'categories' | 'banner' | 'settings' | 'restore'
  >('products');
  const [adminFeedback, setAdminFeedback] = useState<{ msg: string; err: boolean } | null>(null);

  // Admin Product Editor Modal
  const [editingProdIdx, setEditingProdIdx] = useState<number | null>(null);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([bannerImg, logoImg]);
  const [pickerTarget, setPickerTarget] = useState<'product' | 'banner' | null>(null);

  // Bulk Price Editor state
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [bulkDirection, setBulkDirection] = useState<'increase' | 'decrease'>('increase');
  const [bulkMode, setBulkMode] = useState<'percent' | 'fixed'>('percent');
  const [bulkAmount, setBulkAmount] = useState<string>('');
  const [bulkIncludeOld, setBulkIncludeOld] = useState<boolean>(false);

  // Category Input
  const [newCategoryName, setNewCategoryName] = useState('');

  const clickCounter = useRef<{ count: number; timer: ReturnType<typeof setTimeout> | null }>({
    count: 0,
    timer: null,
  });

  const activeStore = isPreviewDraft ? draftData : publishedData;

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeStore.products.filter((p) => {
      if (!isPreviewDraft && !p.visible) return false;
      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [activeStore, isPreviewDraft, searchQuery, selectedCategory]);

  const selectedVariant: Variant | null = useMemo(() => {
    if (!activeProduct || !selectedVariantId) return null;
    return activeProduct.variants.find((v) => v.id === selectedVariantId && v.in_stock) ?? null;
  }, [activeProduct, selectedVariantId]);

  const hasUnpublishedChanges = useMemo(() => {
    const d = { ...draftData, meta: undefined };
    const p = { ...publishedData, meta: undefined };
    return JSON.stringify(d) !== JSON.stringify(p);
  }, [draftData, publishedData]);

  function notifyAdmin(msg: string, err = false) {
    setAdminFeedback({ msg, err });
    if (!err) {
      setTimeout(() => setAdminFeedback(null), 3500);
    }
  }

  function validateStore(store: StoreData): string | null {
    if (!store.settings.shop_name.trim()) return 'Shop name is required.';
    if (!store.settings.whatsapp_number.trim()) return 'WhatsApp number is required.';
    for (let i = 0; i < store.settings.payment_methods.length; i++) {
      if (!store.settings.payment_methods[i].name.trim()) {
        return `Payment method #${i + 1} needs a method name.`;
      }
    }
    for (let i = 0; i < store.products.length; i++) {
      const p = store.products[i];
      if (!p.name.trim()) return `Product #${i + 1} needs a name.`;
      if (p.variants.length === 0) return `Product "${p.name}" must have at least 1 plan.`;
      for (let j = 0; j < p.variants.length; j++) {
        const v = p.variants[j];
        if (!v.label.trim()) return `Plan #${j + 1} on "${p.name}" needs a label.`;
        if (isNaN(v.price) || v.price < 0) return `Plan "${v.label}" on "${p.name}" needs a valid price.`;
      }
    }
    return null;
  }

  function handleSaveDraft(nextDraft?: StoreData) {
    const target = nextDraft || draftData;
    const err = validateStore(target);
    if (err) {
      notifyAdmin(err, true);
      return false;
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const saved = { ...target, meta: { ...target.meta, draft_updated_at: now } };
    setDraftData(saved);
    setSavedDraftSnapshot(saved);
    notifyAdmin('Saved to draft!');
    return true;
  }

  function handlePublish() {
    const err = validateStore(draftData);
    if (err) {
      notifyAdmin('Cannot publish: ' + err, true);
      return;
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    setBackups((prev) => [{ id: 'bk_' + Date.now(), date: now, data: publishedData }, ...prev].slice(0, 20));
    const nextPub = { ...draftData, meta: { last_published_at: now, draft_updated_at: now } };
    setPublishedData(nextPub);
    setDraftData(nextPub);
    setSavedDraftSnapshot(nextPub);
    notifyAdmin('Published live! Automatic backup saved.');
  }

  function handleSecretTrigger(e?: React.MouseEvent) {
    clickCounter.current.count += 1;
    if (clickCounter.current.count >= 2 && e) {
      e.preventDefault();
    }
    if (clickCounter.current.timer) clearTimeout(clickCounter.current.timer);
    clickCounter.current.timer = setTimeout(() => {
      clickCounter.current.count = 0;
    }, 2200);

    if (clickCounter.current.count >= 5) {
      clickCounter.current.count = 0;
      setAdminAuthError('');
      setAdminPassInput('');
      setAdminPassConfirm('');
      setAdminView(adminPasswordHash ? 'login' : 'setup');
    }
  }

  function openProduct(product: Product) {
    setActiveProduct(product);
    const first = product.variants.find((v) => v.in_stock);
    setSelectedVariantId(first ? first.id : null);
    setCheckoutStep('variants');
  }

  function buildWhatsAppLink(msg: string) {
    const phone = activeStore.settings.whatsapp_number.replace(/\D+/g, '');
    return `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(msg)}`;
  }

  function copyValue(id: string, val: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(val).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function handleImageUploadPreview(file: File, onDone: (url: string) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (result) {
        setExistingImages((prev) => (prev.includes(result) ? prev : [result, ...prev]));
        onDone(result);
      }
    };
    reader.readAsDataURL(file);
  }

  function openEditorForProduct(idx: number | null) {
    setEditingProdIdx(idx);
    if (idx === null) {
      const defCat = draftData.categories[0]?.name || 'Gaming';
      setEditingProd({
        id: 'prod_' + Date.now(),
        name: '',
        category: defCat,
        icon: 'gamepad',
        image: '',
        description: '',
        visible: true,
        variants: [{ id: 'v_' + Date.now(), label: '1 Month', price: 500, old_price: null, in_stock: true }],
      });
    } else {
      setEditingProd(structuredClone(draftData.products[idx]));
    }
  }

  // Hidden Admin View
  if (adminView !== 'none') {
    if (adminView === 'setup') {
      return (
        <div className="min-h-screen bg-[#070b14] text-[#eef4ff] flex items-center justify-center p-5">
          <div className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-7">
            <span className="inline-block text-xs font-bold text-blue-400 bg-blue-500/15 px-2.5 py-1 rounded-md mb-3">
              First-Time Setup
            </span>
            <h1 className="font-display text-2xl font-bold mb-1">Create Admin Password</h1>
            <p className="text-sm text-zinc-400 mb-5">
              Set your admin password once. After saving, setup is disabled.
            </p>
            {adminAuthError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm">
                {adminAuthError}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (adminPassInput.length < 8) {
                  setAdminAuthError('Password must be at least 8 characters.');
                  return;
                }
                if (adminPassInput !== adminPassConfirm) {
                  setAdminAuthError('Passwords do not match.');
                  return;
                }
                setAdminPasswordHash(adminPassInput);
                setAdminView('dashboard');
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="text-xs font-semibold text-zinc-400">New Password (min 8 chars)</span>
                <input
                  type="password"
                  value={adminPassInput}
                  onChange={(e) => setAdminPassInput(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white focus:border-blue-500 outline-none"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-400">Confirm Password</span>
                <input
                  type="password"
                  value={adminPassConfirm}
                  onChange={(e) => setAdminPassConfirm(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white focus:border-blue-500 outline-none"
                  required
                />
              </label>
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold transition-colors cursor-pointer"
              >
                Save Password &amp; Open Dashboard
              </button>
            </form>
            <button
              type="button"
              onClick={() => setAdminView('none')}
              className="mt-5 text-sm text-zinc-400 hover:text-blue-400 cursor-pointer"
            >
              &larr; Back to Store
            </button>
          </div>
        </div>
      );
    }

    if (adminView === 'login') {
      return (
        <div className="min-h-screen bg-[#070b14] text-[#eef4ff] flex items-center justify-center p-5">
          <div className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-7">
            <span className="inline-block text-xs font-bold text-blue-400 bg-blue-500/15 px-2.5 py-1 rounded-md mb-3">
              SS Gaming Store
            </span>
            <h1 className="font-display text-2xl font-bold mb-1">Admin Login</h1>
            <p className="text-sm text-zinc-400 mb-5">Enter your admin password to manage the store.</p>
            {adminAuthError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm">
                {adminAuthError}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (adminPassInput !== adminPasswordHash) {
                  setAdminAuthError('Incorrect password.');
                  return;
                }
                setAdminView('dashboard');
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="text-xs font-semibold text-zinc-400">Admin Password</span>
                <input
                  type="password"
                  value={adminPassInput}
                  onChange={(e) => setAdminPassInput(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white focus:border-blue-500 outline-none"
                  required
                />
              </label>
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold transition-colors cursor-pointer"
              >
                Sign In
              </button>
            </form>
            <button
              type="button"
              onClick={() => setAdminView('none')}
              className="mt-5 text-sm text-zinc-400 hover:text-blue-400 cursor-pointer"
            >
              &larr; Back to Store
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#070b14] text-[#eef4ff]">
        <header className="sticky top-0 z-30 bg-[#0b1120] border-b border-white/10 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display font-bold text-lg text-blue-400">SS Gaming Admin</div>
            <div className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
              <span>Last published: {publishedData.meta.last_published_at}</span>
              {hasUnpublishedChanges && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-bold">
                  Unpublished changes
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setIsPreviewDraft(true);
                setAdminView('none');
              }}
              className="min-h-[42px] px-4 rounded-xl bg-[#172238] border border-white/10 text-sm font-bold hover:border-blue-500 cursor-pointer"
            >
              Preview draft
            </button>
            <button
              type="button"
              onClick={() => handleSaveDraft()}
              className="min-h-[42px] px-4 rounded-xl bg-[#172238] border border-white/10 text-sm font-bold hover:border-blue-500 cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handlePublish}
              className="min-h-[42px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold cursor-pointer"
            >
              PUBLISH
            </button>
            <button
              type="button"
              onClick={() => setAdminView('none')}
              className="min-h-[42px] px-4 rounded-xl border border-red-500/40 text-red-300 text-sm font-bold hover:bg-red-500/15 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        {adminFeedback && (
          <div className="max-w-6xl mx-auto mt-4 px-4">
            <div
              className={`p-3 rounded-xl border font-semibold text-sm ${
                adminFeedback.err
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
              }`}
            >
              {adminFeedback.msg}
            </div>
          </div>
        )}

        <div className="border-b border-white/10 bg-[#0f172a] px-4 py-3 flex gap-2 overflow-x-auto">
          {(
            [
              ['products', 'Products'],
              ['prices', 'Quick Prices'],
              ['categories', 'Categories'],
              ['banner', 'Banner & Ticker'],
              ['settings', 'Settings & Payments'],
              ['restore', 'Restore / Backups'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAdminTab(id)}
              className={`min-h-[42px] px-4 rounded-xl text-sm font-bold whitespace-nowrap cursor-pointer ${
                adminTab === id
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#172238] text-zinc-400 border border-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <main className="max-w-6xl mx-auto p-4 pb-16 space-y-4">
          {adminTab === 'products' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-xl">Products &amp; Variants</h2>
                  <p className="text-sm text-zinc-400">
                    Add, edit, duplicate, reorder, delete, or toggle stock for every product.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEditorForProduct(null)}
                  className="min-h-[44px] px-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>

              {draftData.products.map((prod, idx) => (
                <div key={prod.id} className="bg-[#0f172a] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#172238] flex items-center justify-center overflow-hidden text-blue-400 shrink-0">
                        {prod.image ? (
                          <img src={prod.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ProductIcon iconKey={prod.icon} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-base">{prod.name}</div>
                        <div className="text-xs text-zinc-400">
                          {prod.category} · {prod.variants.length} plan(s) · {prod.visible ? 'Visible' : 'Hidden'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setDraftData({ ...draftData, products: swapItems(draftData.products, idx, idx - 1) })
                        }
                        className="min-h-[38px] px-3 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        disabled={idx === draftData.products.length - 1}
                        onClick={() =>
                          setDraftData({ ...draftData, products: swapItems(draftData.products, idx, idx + 1) })
                        }
                        className="min-h-[38px] px-3 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditorForProduct(idx)}
                        className="min-h-[38px] px-3.5 rounded-lg bg-blue-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const copy = structuredClone(prod);
                          copy.id = 'prod_' + Date.now();
                          copy.name = prod.name + ' (Copy)';
                          copy.variants = copy.variants.map((v, vi) => ({
                            ...v,
                            id: 'v_' + Date.now() + '_' + vi,
                          }));
                          const nextProds = [...draftData.products];
                          nextProds.splice(idx + 1, 0, copy);
                          setDraftData({ ...draftData, products: nextProds });
                          notifyAdmin(`Duplicated "${prod.name}".`);
                        }}
                        className="min-h-[38px] px-3 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Delete "${prod.name}"?`)) return;
                          const nextProds = draftData.products.filter((_, i) => i !== idx);
                          setDraftData({ ...draftData, products: nextProds });
                          notifyAdmin(`Deleted "${prod.name}".`);
                        }}
                        className="min-h-[38px] px-3 rounded-lg border border-red-500/40 text-red-300 text-xs font-bold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    {prod.variants.map((v, vIdx) => (
                      <div
                        key={v.id}
                        className="flex flex-wrap items-center justify-between gap-2 bg-[#172238] px-3 py-2 rounded-xl text-sm"
                      >
                        <span className={v.in_stock ? '' : 'line-through text-zinc-500'}>
                          {v.label} — {formatPKR(v.price)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = structuredClone(draftData);
                            next.products[idx].variants[vIdx].in_stock = !v.in_stock;
                            setDraftData(next);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                            v.in_stock
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40'
                              : 'bg-red-500/15 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {v.in_stock ? 'In Stock (Mark Sold Out)' : 'Sold Out (Restock)'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {adminTab === 'prices' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-xl">Quick Price Editor</h2>
                  <p className="text-sm text-zinc-400">
                    Change prices across all products in one table or apply bulk % / Rs. adjustments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveDraft()}
                  className="min-h-[44px] px-5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm cursor-pointer"
                >
                  Save all
                </button>
              </div>

              <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">Bulk Price Action</strong>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBulkIds(draftData.products.map((p) => p.id))}
                      className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                    >
                      Select All Products
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBulkIds([])}
                      className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <label className="block">
                    <span className="text-xs text-zinc-400">Action</span>
                    <select
                      value={bulkDirection}
                      onChange={(e) => setBulkDirection(e.target.value as 'increase' | 'decrease')}
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-sm"
                    >
                      <option value="increase">Increase prices by</option>
                      <option value="decrease">Decrease prices by</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-zinc-400">Amount</span>
                    <input
                      type="number"
                      min="0"
                      value={bulkAmount}
                      onChange={(e) => setBulkAmount(digitsOnly(e.target.value))}
                      placeholder="e.g. 10 or 100"
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-zinc-400">Type</span>
                    <select
                      value={bulkMode}
                      onChange={(e) => setBulkMode(e.target.value as 'percent' | 'fixed')}
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-sm"
                    >
                      <option value="percent">% (Percent)</option>
                      <option value="fixed">Rs. (Fixed PKR)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 h-11 text-sm font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkIncludeOld}
                      onChange={(e) => setBulkIncludeOld(e.target.checked)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    Also adjust Old Price
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBulkIds.length === 0) {
                        notifyAdmin('Select at least one product checkbox first.', true);
                        return;
                      }
                      const amt = Number(bulkAmount);
                      if (!amt || amt <= 0) {
                        notifyAdmin('Enter a positive amount.', true);
                        return;
                      }
                      const sign = bulkDirection === 'decrease' ? -1 : 1;
                      const next = structuredClone(draftData);
                      let count = 0;
                      next.products.forEach((p) => {
                        if (!selectedBulkIds.includes(p.id)) return;
                        p.variants.forEach((v) => {
                          const delta = bulkMode === 'percent' ? v.price * (amt / 100) : amt;
                          v.price = Math.max(0, Math.round(v.price + sign * delta));
                          if (bulkIncludeOld && v.old_price && v.old_price > 0) {
                            const oldDelta = bulkMode === 'percent' ? v.old_price * (amt / 100) : amt;
                            v.old_price = Math.max(0, Math.round(v.old_price + sign * oldDelta));
                          }
                          count++;
                        });
                      });
                      setDraftData(next);
                      notifyAdmin(`Updated ${count} plan price(s) in draft. Click "Save all" to confirm.`);
                    }}
                    className="h-11 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm cursor-pointer"
                  >
                    Apply to Selected
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto bg-[#0f172a] border border-white/10 rounded-2xl">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#172238] text-xs text-zinc-400 border-b border-white/10">
                      <th className="p-3">Select</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Plan / Variant</th>
                      <th className="p-3">Price (PKR)</th>
                      <th className="p-3">Old Price (Optional)</th>
                      <th className="p-3">In Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftData.products.map((prod, pIdx) =>
                      prod.variants.map((v, vIdx) => (
                        <tr key={v.id} className="border-b border-white/10 last:border-b-0">
                          <td className="p-3">
                            {vIdx === 0 && (
                              <input
                                type="checkbox"
                                checked={selectedBulkIds.includes(prod.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBulkIds([...selectedBulkIds, prod.id]);
                                  } else {
                                    setSelectedBulkIds(selectedBulkIds.filter((id) => id !== prod.id));
                                  }
                                }}
                                className="w-5 h-5 accent-blue-500 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="p-3">
                            {vIdx === 0 && (
                              <div>
                                <div className="font-bold text-sm">{prod.name}</div>
                                <div className="text-xs text-zinc-400">{prod.category}</div>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={v.label}
                              onChange={(e) => {
                                const next = structuredClone(draftData);
                                next.products[pIdx].variants[vIdx].label = e.target.value;
                                setDraftData(next);
                              }}
                              className="w-full h-10 px-2.5 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              value={v.price}
                              onChange={(e) => {
                                const clean = digitsOnly(e.target.value);
                                const next = structuredClone(draftData);
                                next.products[pIdx].variants[vIdx].price = Number(clean) || 0;
                                setDraftData(next);
                              }}
                              className="w-full h-10 px-2.5 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                            />
                            <div className="text-xs font-bold text-blue-400 mt-1 tabular-nums">
                              {formatPKR(v.price)}
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              value={v.old_price ?? ''}
                              placeholder="Optional"
                              onChange={(e) => {
                                const clean = digitsOnly(e.target.value);
                                const next = structuredClone(draftData);
                                next.products[pIdx].variants[vIdx].old_price =
                                  clean === '' ? null : Number(clean);
                                setDraftData(next);
                              }}
                              className="w-full h-10 px-2.5 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                            />
                            {v.old_price && v.old_price > v.price && (
                              <div className="text-xs font-bold text-blue-400 mt-1 tabular-nums">
                                {formatPKR(v.old_price)} (
                                {Math.round(((v.old_price - v.price) / v.old_price) * 100)}% OFF)
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={v.in_stock}
                              onChange={(e) => {
                                const next = structuredClone(draftData);
                                next.products[pIdx].variants[vIdx].in_stock = e.target.checked;
                                setDraftData(next);
                              }}
                              className="w-5 h-5 accent-blue-500 cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveDraft()}
                  className="min-h-[46px] px-6 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold cursor-pointer"
                >
                  Save all
                </button>
              </div>
            </>
          )}

          {adminTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name..."
                  className="h-11 px-3 rounded-xl bg-[#0f172a] border border-white/10 text-sm flex-1 min-w-[200px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCategoryName.trim()) return;
                    setDraftData({
                      ...draftData,
                      categories: [
                        ...draftData.categories,
                        { id: 'cat_' + Date.now(), name: newCategoryName.trim() },
                      ],
                    });
                    setNewCategoryName('');
                    notifyAdmin('Category added to draft.');
                  }}
                  className="h-11 px-5 rounded-xl bg-blue-500 text-white font-bold text-sm cursor-pointer"
                >
                  + Add Category
                </button>
              </div>

              {draftData.categories.map((c, idx) => (
                <div
                  key={c.id}
                  className="bg-[#0f172a] border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <span className="font-bold">{c.name}</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        setDraftData({ ...draftData, categories: swapItems(draftData.categories, idx, idx - 1) })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={idx === draftData.categories.length - 1}
                      onClick={() =>
                        setDraftData({ ...draftData, categories: swapItems(draftData.categories, idx, idx + 1) })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextName = window.prompt('Rename category:', c.name);
                        if (!nextName || !nextName.trim()) return;
                        const oldName = c.name;
                        const next = structuredClone(draftData);
                        next.categories[idx].name = nextName.trim();
                        next.products.forEach((p) => {
                          if (p.category === oldName) p.category = nextName.trim();
                        });
                        setDraftData(next);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={draftData.categories.length <= 1}
                      onClick={() => {
                        if (!window.confirm(`Delete category "${c.name}"?`)) return;
                        setDraftData({
                          ...draftData,
                          categories: draftData.categories.filter((_, i) => i !== idx),
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {adminTab === 'banner' && (
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-zinc-400">
                  Announcement Bar (leave empty to hide)
                </span>
                <input
                  type="text"
                  value={draftData.settings.announcement}
                  onChange={(e) =>
                    setDraftData({
                      ...draftData,
                      settings: { ...draftData.settings, announcement: e.target.value },
                    })
                  }
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Banner Tag</span>
                  <input
                    type="text"
                    value={draftData.banner.tag}
                    onChange={(e) =>
                      setDraftData({ ...draftData, banner: { ...draftData.banner, tag: e.target.value } })
                    }
                    className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Banner Button Text</span>
                  <input
                    type="text"
                    value={draftData.banner.button_text}
                    onChange={(e) =>
                      setDraftData({
                        ...draftData,
                        banner: { ...draftData.banner, button_text: e.target.value },
                      })
                    }
                    className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-400">Banner Heading</span>
                <input
                  type="text"
                  value={draftData.banner.title}
                  onChange={(e) =>
                    setDraftData({ ...draftData, banner: { ...draftData.banner, title: e.target.value } })
                  }
                  className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-400">Banner Text</span>
                <textarea
                  rows={2}
                  value={draftData.banner.text}
                  onChange={(e) =>
                    setDraftData({ ...draftData, banner: { ...draftData.banner, text: e.target.value } })
                  }
                  className="mt-1 w-full p-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                />
              </label>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-400 block">Banner Background Image</span>
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={draftData.banner.image || bannerImg}
                    alt="Banner preview"
                    className="w-28 h-20 object-cover rounded-xl border border-white/10"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        handleImageUploadPreview(f, (url) =>
                          setDraftData({ ...draftData, banner: { ...draftData.banner, image: url } })
                        );
                      }
                    }}
                    className="text-xs text-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => setPickerTarget('banner')}
                    className="px-3 py-2 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                  >
                    Pick Existing Image
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftData({ ...draftData, banner: { ...draftData.banner, image: '' } })
                    }
                    className="px-3 py-2 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSaveDraft()}
                className="min-h-[44px] px-5 rounded-xl bg-blue-500 text-white font-bold text-sm cursor-pointer"
              >
                Save Banner
              </button>
            </div>
          )}

          {adminTab === 'settings' && (
            <div className="space-y-5">
              <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-zinc-400">Shop Name</span>
                    <input
                      type="text"
                      value={draftData.settings.shop_name}
                      onChange={(e) =>
                        setDraftData({
                          ...draftData,
                          settings: { ...draftData.settings, shop_name: e.target.value },
                        })
                      }
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-zinc-400">WhatsApp Number</span>
                    <input
                      type="text"
                      value={draftData.settings.whatsapp_number}
                      onChange={(e) =>
                        setDraftData({
                          ...draftData,
                          settings: {
                            ...draftData.settings,
                            whatsapp_number: digitsOnly(e.target.value),
                          },
                        })
                      }
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Footer Description</span>
                  <input
                    type="text"
                    value={draftData.settings.footer_text}
                    onChange={(e) =>
                      setDraftData({
                        ...draftData,
                        settings: { ...draftData.settings, footer_text: e.target.value },
                      })
                    }
                    className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">Payment Warning Message</span>
                  <textarea
                    rows={2}
                    value={draftData.settings.payment_warning}
                    onChange={(e) =>
                      setDraftData({
                        ...draftData,
                        settings: { ...draftData.settings, payment_warning: e.target.value },
                      })
                    }
                    className="mt-1 w-full p-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">
                    WhatsApp Message Template ({'{shop_name}'}, {'{order_id}'}, {'{product}'},{' '}
                    {'{variant}'}, {'{total}'})
                  </span>
                  <textarea
                    rows={4}
                    value={draftData.settings.whatsapp_template}
                    onChange={(e) =>
                      setDraftData({
                        ...draftData,
                        settings: { ...draftData.settings, whatsapp_template: e.target.value },
                      })
                    }
                    className="mt-1 w-full p-3 rounded-xl bg-[#070b14] border border-white/10 text-white"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg">Manual Payment Methods</h3>
                <button
                  type="button"
                  onClick={() => {
                    const nextPm: PaymentMethod = {
                      id: 'pm_' + Date.now(),
                      name: 'New Method',
                      account_title: '',
                      account_number: '',
                      extra_note: '',
                      copy_value: '',
                    };
                    setDraftData({
                      ...draftData,
                      settings: {
                        ...draftData.settings,
                        payment_methods: [...draftData.settings.payment_methods, nextPm],
                      },
                    });
                  }}
                  className="min-h-[40px] px-4 rounded-xl bg-blue-500 text-white font-bold text-sm cursor-pointer"
                >
                  + Add Payment Method
                </button>
              </div>

              {draftData.settings.payment_methods.map((pm, idx) => (
                <div key={pm.id} className="bg-[#0f172a] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-zinc-400">Method Name</span>
                      <input
                        type="text"
                        value={pm.name}
                        onChange={(e) => {
                          const next = structuredClone(draftData);
                          next.settings.payment_methods[idx].name = e.target.value;
                          setDraftData(next);
                        }}
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-zinc-400">Account Title</span>
                      <input
                        type="text"
                        value={pm.account_title}
                        onChange={(e) => {
                          const next = structuredClone(draftData);
                          next.settings.payment_methods[idx].account_title = e.target.value;
                          setDraftData(next);
                        }}
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-zinc-400">Account Number / IBAN</span>
                      <input
                        type="text"
                        value={pm.account_number}
                        onChange={(e) => {
                          const next = structuredClone(draftData);
                          next.settings.payment_methods[idx].account_number = e.target.value;
                          setDraftData(next);
                        }}
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-zinc-400">Copy Value</span>
                      <input
                        type="text"
                        value={pm.copy_value}
                        onChange={(e) => {
                          const next = structuredClone(draftData);
                          next.settings.payment_methods[idx].copy_value = e.target.value;
                          setDraftData(next);
                        }}
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-zinc-400">Extra Note (optional)</span>
                    <input
                      type="text"
                      value={pm.extra_note}
                      onChange={(e) => {
                        const next = structuredClone(draftData);
                        next.settings.payment_methods[idx].extra_note = e.target.value;
                        setDraftData(next);
                      }}
                      className="mt-1 w-full h-10 px-3 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        setDraftData({
                          ...draftData,
                          settings: {
                            ...draftData.settings,
                            payment_methods: swapItems(draftData.settings.payment_methods, idx, idx - 1),
                          },
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={idx === draftData.settings.payment_methods.length - 1}
                      onClick={() =>
                        setDraftData({
                          ...draftData,
                          settings: {
                            ...draftData.settings,
                            payment_methods: swapItems(draftData.settings.payment_methods, idx, idx + 1),
                          },
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete payment method "${pm.name}"?`)) return;
                        setDraftData({
                          ...draftData,
                          settings: {
                            ...draftData.settings,
                            payment_methods: draftData.settings.payment_methods.filter((_, i) => i !== idx),
                          },
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 text-xs font-bold cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => handleSaveDraft()}
                className="min-h-[44px] px-5 rounded-xl bg-blue-500 text-white font-bold text-sm cursor-pointer"
              >
                Save Settings &amp; Payments
              </button>
            </div>
          )}

          {adminTab === 'restore' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-xl">Restore &amp; Backups</h2>
                  <p className="text-sm text-zinc-400">
                    Every publish saves a backup automatically. Restore any snapshot or reset draft.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Reset draft to match the live published store?')) return;
                    setDraftData(publishedData);
                    setSavedDraftSnapshot(publishedData);
                    notifyAdmin('Draft reset to published.');
                  }}
                  className="min-h-[40px] px-4 rounded-xl bg-[#172238] border border-white/10 text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Reset draft to published
                </button>
              </div>
              {backups.length === 0 ? (
                <div className="bg-[#0f172a] border border-white/10 rounded-xl p-5 text-sm text-zinc-400">
                  No backups yet. Click PUBLISH after editing to create your first automatic backup.
                </div>
              ) : (
                backups.map((bk) => (
                  <div
                    key={bk.id}
                    className="bg-[#0f172a] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-sm">Backup Snapshot — {bk.date}</div>
                      <div className="text-xs text-zinc-400">{bk.data.products.length} products</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Restore backup from ${bk.date}?`)) return;
                        setPublishedData(bk.data);
                        setDraftData(bk.data);
                        notifyAdmin(`Restored backup from ${bk.date}.`);
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Restore as Published
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </main>

        {/* Product Editor Modal */}
        {editingProd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75" onClick={() => setEditingProd(null)} />
            <div className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0f172a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-lg">
                  {editingProdIdx === null ? 'Add Product' : 'Edit Product'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingProd(null)}
                  className="px-3 py-1 rounded-lg bg-[#172238] text-sm cursor-pointer"
                >
                  &times;
                </button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-zinc-400">Product Name</span>
                    <input
                      type="text"
                      value={editingProd.name}
                      onChange={(e) => setEditingProd({ ...editingProd, name: e.target.value })}
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-zinc-400">Category</span>
                    <select
                      value={editingProd.category}
                      onChange={(e) => setEditingProd({ ...editingProd, category: e.target.value })}
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-[#070b14] border border-white/10 text-sm"
                    >
                      {draftData.categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-zinc-400">Description</span>
                  <textarea
                    rows={2}
                    value={editingProd.description}
                    onChange={(e) => setEditingProd({ ...editingProd, description: e.target.value })}
                    className="mt-1 w-full p-3 rounded-xl bg-[#070b14] border border-white/10 text-sm"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-16 h-14 rounded-xl bg-[#070b14] border border-white/10 flex items-center justify-center overflow-hidden">
                      {editingProd.image ? (
                        <img src={editingProd.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-zinc-500">No img</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          handleImageUploadPreview(f, (url) =>
                            setEditingProd({ ...editingProd, image: url })
                          );
                        }
                      }}
                      className="text-xs text-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={() => setPickerTarget('product')}
                      className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                    >
                      Pick Existing Image
                    </button>
                    {editingProd.image && (
                      <button
                        type="button"
                        onClick={() => setEditingProd({ ...editingProd, image: '' })}
                        className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProd.visible}
                      onChange={(e) => setEditingProd({ ...editingProd, visible: e.target.checked })}
                      className="w-4 h-4 accent-blue-500"
                    />
                    Visible in Store
                  </label>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <strong className="text-sm">Plans / Variants</strong>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingProd({
                        ...editingProd,
                        variants: [
                          ...editingProd.variants,
                          {
                            id: 'v_' + Date.now(),
                            label: 'New Plan',
                            price: 0,
                            old_price: null,
                            in_stock: true,
                          },
                        ],
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#172238] border border-white/10 text-xs font-bold cursor-pointer"
                  >
                    + Add Variant
                  </button>
                </div>

                <div className="space-y-2.5">
                  {editingProd.variants.map((v, vIdx) => (
                    <div
                      key={v.id}
                      className="bg-[#172238] border border-white/10 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-start"
                    >
                      <label className="block sm:col-span-2">
                        <span className="text-[11px] text-zinc-400">Plan Label</span>
                        <input
                          type="text"
                          value={v.label}
                          onChange={(e) => {
                            const nextV = [...editingProd.variants];
                            nextV[vIdx] = { ...v, label: e.target.value };
                            setEditingProd({ ...editingProd, variants: nextV });
                          }}
                          className="mt-1 w-full h-9 px-2.5 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-zinc-400">Price (PKR)</span>
                        <input
                          type="number"
                          min="0"
                          value={v.price}
                          onChange={(e) => {
                            const clean = digitsOnly(e.target.value);
                            const nextV = [...editingProd.variants];
                            nextV[vIdx] = { ...v, price: Number(clean) || 0 };
                            setEditingProd({ ...editingProd, variants: nextV });
                          }}
                          className="mt-1 w-full h-9 px-2.5 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                        />
                        <span className="text-[11px] font-bold text-blue-400 tabular-nums">
                          {formatPKR(v.price)}
                        </span>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-zinc-400">Old Price</span>
                        <input
                          type="number"
                          min="0"
                          value={v.old_price ?? ''}
                          onChange={(e) => {
                            const clean = digitsOnly(e.target.value);
                            const nextV = [...editingProd.variants];
                            nextV[vIdx] = { ...v, old_price: clean === '' ? null : Number(clean) };
                            setEditingProd({ ...editingProd, variants: nextV });
                          }}
                          className="mt-1 w-full h-9 px-2.5 rounded-lg bg-[#070b14] border border-white/10 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5 pt-5">
                        <button
                          type="button"
                          title="Move Up"
                          disabled={vIdx === 0}
                          onClick={() =>
                            setEditingProd({
                              ...editingProd,
                              variants: swapItems(editingProd.variants, vIdx, vIdx - 1),
                            })
                          }
                          className="p-2 rounded-lg bg-[#070b14] border border-white/10 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Move Down"
                          disabled={vIdx === editingProd.variants.length - 1}
                          onClick={() =>
                            setEditingProd({
                              ...editingProd,
                              variants: swapItems(editingProd.variants, vIdx, vIdx + 1),
                            })
                          }
                          className="p-2 rounded-lg bg-[#070b14] border border-white/10 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Duplicate Variant"
                          onClick={() => {
                            const nextV = [...editingProd.variants];
                            nextV.splice(vIdx + 1, 0, {
                              ...v,
                              id: 'v_' + Date.now(),
                              label: v.label + ' (Copy)',
                            });
                            setEditingProd({ ...editingProd, variants: nextV });
                          }}
                          className="p-2 rounded-lg bg-[#070b14] border border-white/10 cursor-pointer"
                        >
                          <CopyPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete Variant"
                          disabled={editingProd.variants.length <= 1}
                          onClick={() => {
                            if (!window.confirm(`Delete plan "${v.label}"?`)) return;
                            setEditingProd({
                              ...editingProd,
                              variants: editingProd.variants.filter((_, i) => i !== vIdx),
                            });
                          }}
                          className="p-2 rounded-lg border border-red-500/40 text-red-300 disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <label className="flex items-center gap-1.5 text-xs font-semibold ml-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={v.in_stock}
                            onChange={(e) => {
                              const nextV = [...editingProd.variants];
                              nextV[vIdx] = { ...v, in_stock: e.target.checked };
                              setEditingProd({ ...editingProd, variants: nextV });
                            }}
                            className="w-4 h-4 accent-blue-500"
                          />
                          Stock
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 py-3.5 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProd(null)}
                  className="px-4 py-2 rounded-xl bg-[#172238] text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!editingProd.name.trim()) {
                      alert('Please enter a product name.');
                      return;
                    }
                    for (const v of editingProd.variants) {
                      if (!v.label.trim()) {
                        alert('Every plan must have a label.');
                        return;
                      }
                    }
                    const nextProds = [...draftData.products];
                    if (editingProdIdx === null) {
                      nextProds.unshift(editingProd);
                    } else {
                      nextProds[editingProdIdx] = editingProd;
                    }
                    const nextDraft = { ...draftData, products: nextProds };
                    if (handleSaveDraft(nextDraft)) {
                      setEditingProd(null);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold cursor-pointer"
                >
                  Save Product to Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing Image Picker Modal */}
        {pickerTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setPickerTarget(null)} />
            <div className="relative z-10 w-full max-w-xl bg-[#0f172a] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Pick Existing Image</h3>
                <button
                  type="button"
                  onClick={() => setPickerTarget(null)}
                  className="px-3 py-1 rounded-lg bg-[#172238] cursor-pointer"
                >
                  &times;
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {existingImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (pickerTarget === 'product' && editingProd) {
                        setEditingProd({ ...editingProd, image: imgUrl });
                      } else if (pickerTarget === 'banner') {
                        setDraftData({ ...draftData, banner: { ...draftData.banner, image: imgUrl } });
                      }
                      setPickerTarget(null);
                    }}
                    className="rounded-xl overflow-hidden border border-white/10 hover:border-blue-500 cursor-pointer"
                  >
                    <img src={imgUrl} alt="" className="w-full h-24 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#070b14] text-[#0b1220] dark:text-[#eef4ff]">
      {isPreviewDraft && (
        <div className="bg-amber-400 text-zinc-950 text-sm font-bold px-4 py-2.5 flex items-center justify-center gap-4 flex-wrap">
          <span>Draft Preview Mode — Changes shown here are not published live yet.</span>
          <button
            type="button"
            onClick={() => {
              setIsPreviewDraft(false);
              setAdminView('dashboard');
            }}
            className="bg-zinc-950 text-white px-3 py-1 rounded-lg text-xs cursor-pointer"
          >
            Back to Admin
          </button>
        </div>
      )}

      {/* Announcement Bar */}
      {activeStore.settings.announcement.trim() !== '' && (
        <div className="bg-[#0a1224] text-blue-100 border-b border-blue-500/25 text-xs sm:text-sm font-medium text-center py-2.5 px-3">
          {activeStore.settings.announcement}
        </div>
      )}

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-b border-black/10 dark:border-white/10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-5 h-[68px] flex items-center justify-between gap-6">
          <a
            href="#home"
            onClick={(e) => handleSecretTrigger(e)}
            className="flex items-center gap-2.5 font-display font-bold text-lg tracking-tight whitespace-nowrap shrink-0 select-none"
          >
            <span className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/35 flex items-center justify-center text-blue-500">
              <Gamepad2 className="w-5 h-5" />
            </span>
            <span>{activeStore.settings.shop_name}</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            <a href="#home" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Home
            </a>
            <a href="#store" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Store
            </a>
            <a href="#contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="#store"
              className="hidden md:inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Browse Deals
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 rounded-xl border border-black/10 dark:border-white/10 flex items-center justify-center bg-zinc-100 dark:bg-[#172238]"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-black/10 dark:border-white/10 px-4 py-3 flex flex-col gap-1 bg-white dark:bg-[#0f172a]">
            <a href="#home" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-lg font-semibold">
              Home
            </a>
            <a href="#store" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-lg font-semibold">
              Store
            </a>
            <a href="#policies" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-lg font-semibold">
              Policies
            </a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-lg font-semibold">
              Contact
            </a>
          </div>
        )}
      </header>

      <main>
        {/* Promo Banner */}
        <section id="home" className="pt-6 pb-4">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-5">
            <div className="relative overflow-hidden rounded-[22px] bg-[#060d1c] border border-blue-500/25 min-h-[320px] sm:min-h-[360px] flex items-center p-7 sm:p-12 shadow-xl">
              <img
                src={activeStore.banner.image || bannerImg}
                alt="Featured store promotion"
                className="absolute inset-0 w-full h-full object-cover opacity-55"
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#060b16]/95 via-[#060b16]/75 to-[#060b16]/40"
                aria-hidden="true"
              />
              <div className="relative z-10 max-w-xl">
                <span className="inline-block text-xs font-bold tracking-wide text-blue-400 mb-2.5">
                  {activeStore.banner.tag}
                </span>
                <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-[1.12] mb-3 text-balance">
                  {activeStore.banner.title}
                </h1>
                <p className="text-zinc-300 text-sm sm:text-base mb-6 max-w-[54ch]">
                  {activeStore.banner.text}
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#store"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm sm:text-base transition-colors"
                  >
                    {activeStore.banner.button_text}
                  </a>
                  <a
                    href={buildWhatsAppLink(
                      `Assalam-o-Alaikum! I want to inquire about an order at ${activeStore.settings.shop_name}.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-green-500" />
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Store Catalog */}
        <section id="store" className="py-8 sm:py-12">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-5">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight mb-1">Browse by Category</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Select any product to compare packages and order in PKR.
                </p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search UC, Game Pass, Netflix..."
                  aria-label="Search products"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-[#0f172a] border border-black/10 dark:border-white/10 text-sm focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Category Chips */}
            <div className="flex flex-wrap gap-2 mb-6" role="tablist">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-[#0f172a] border-black/10 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-blue-500'
                }`}
              >
                All Products
              </button>
              {activeStore.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                    selectedCategory === cat.name
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-[#0f172a] border-black/10 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-blue-500'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white dark:bg-[#0f172a] border border-dashed border-black/15 dark:border-white/15 rounded-2xl text-zinc-500">
                  No products match your filter.
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const inStockPrices = product.variants.filter((v) => v.in_stock).map((v) => v.price);
                  const hasStock = inStockPrices.length > 0;
                  const lowest = hasStock ? Math.min(...inStockPrices) : 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => openProduct(product)}
                      className="group text-left bg-white dark:bg-[#0f172a] border border-black/10 dark:border-white/10 hover:border-blue-500 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                    >
                      <div className="h-[92px] sm:h-[104px] w-full bg-[#e8eff7] dark:bg-[#172238] flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform [&_svg]:w-[22px] [&_svg]:h-[22px]">
                            <ProductIcon iconKey={product.icon} />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 sm:p-3 flex flex-col flex-1 gap-1.5">
                        <span className="self-start text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/12 px-1.5 py-0.5 rounded">
                          {product.category}
                        </span>
                        <h3 className="font-display font-bold text-sm leading-snug">{product.name}</h3>
                        <div className="mt-auto pt-1.5 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-1.5">
                          <span className={`font-bold text-[13px] tabular-nums ${hasStock ? '' : 'text-red-500'}`}>
                            {hasStock ? `From ${formatPKR(lowest)}` : 'Out of stock'}
                          </span>
                          <span className="hidden min-[380px]:inline text-[11px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {hasStock ? 'View packs →' : 'Unavailable'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* About, Refund Policy & Terms */}
        <section id="policies" className="pb-10">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <article id="about" className="bg-white dark:bg-[#0f172a] border border-black/10 dark:border-white/10 rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg mb-2">About {activeStore.settings.shop_name}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                We supply gamers, creators, and streamers across Pakistan with authentic top-ups, Game Pass memberships, and digital subscriptions at fair PKR prices with fast verification on WhatsApp.
              </p>
            </article>
            <article id="refund-policy" className="bg-white dark:bg-[#0f172a] border border-black/10 dark:border-white/10 rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg mb-2">Refund Policy</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <strong className="text-zinc-900 dark:text-white">No refund after code or account delivery.</strong> Because digital codes and top-ups are consumed immediately upon delivery, all completed orders are final.
              </p>
            </article>
            <article id="terms" className="bg-white dark:bg-[#0f172a] border border-black/10 dark:border-white/10 rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg mb-2">Terms &amp; Delivery</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Verify your Player ID / UID and package carefully before paying. Sending your payment screenshot on WhatsApp is mandatory to release your order.
              </p>
            </article>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="pb-14">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-5">
            <div className="bg-white dark:bg-[#0f172a] border border-black/10 dark:border-white/10 rounded-[22px] p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <h2 className="font-display font-bold text-2xl mb-1">Need Help With an Order?</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Message us directly on WhatsApp for custom bundles, bulk top-ups, or instant support across Pakistan.
                </p>
              </div>
              <a
                href={buildWhatsAppLink(
                  `Assalam-o-Alaikum! I want to inquire about an order at ${activeStore.settings.shop_name}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold whitespace-nowrap transition-colors"
              >
                Message on WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#0f172a] border-t border-black/10 dark:border-white/10 py-10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="font-display font-bold text-lg mb-2">{activeStore.settings.shop_name}</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm">
                {activeStore.settings.footer_text}
              </p>
            </div>
            <div>
              <div className="font-bold text-sm mb-2.5">Accepted Payments</div>
              <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                {activeStore.settings.payment_methods.map((pm) => (
                  <li key={pm.id}>{pm.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-bold text-sm mb-2.5">Quick Links</div>
              <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <li><a href="#about" className="hover:text-blue-500">About Us</a></li>
                <li><a href="#refund-policy" className="hover:text-blue-500">Refund Policy</a></li>
                <li><a href="#terms" className="hover:text-blue-500">Terms</a></li>
                <li><a href="#contact" className="hover:text-blue-500">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-5 border-t border-black/10 dark:border-white/10 flex flex-wrap justify-between gap-3 text-xs sm:text-sm text-zinc-500">
            <span onClick={() => handleSecretTrigger()} className="select-none cursor-default">
              {activeStore.settings.copyright_text}
            </span>
            <span>Pakistan · PKR Manual Checkout</span>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href={buildWhatsAppLink(
          `Assalam-o-Alaikum! I want to inquire about an order at ${activeStore.settings.shop_name}.`
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-full font-bold text-sm shadow-lg shadow-green-600/30 transition-transform hover:-translate-y-0.5"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>

      {/* Product & Checkout Modal */}
      {activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setActiveProduct(null)}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0f172a] border border-black/10 dark:border-white/10 rounded-[22px] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveProduct(null)}
              className="absolute top-3.5 right-3.5 w-9 h-9 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-[#172238] flex items-center justify-center cursor-pointer"
              aria-label="Close popup"
            >
              <X className="w-4 h-4" />
            </button>

            {checkoutStep === 'variants' ? (
              <div>
                <div className="flex gap-3.5 items-start mb-4 pr-8">
                  <div className="w-16 h-16 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 overflow-hidden">
                    {activeProduct.image ? (
                      <img src={activeProduct.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ProductIcon iconKey={activeProduct.icon} />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {activeProduct.category}
                    </span>
                    <h2 className="font-display text-xl font-bold mt-0.5 mb-1">{activeProduct.name}</h2>
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                      {activeProduct.description}
                    </p>
                  </div>
                </div>

                <div className="text-xs font-bold text-zinc-500 mb-2">Choose a Package</div>
                <div className="space-y-2 mb-5">
                  {activeProduct.variants.map((v) => {
                    const isSel = v.in_stock && v.id === selectedVariantId;
                    const off =
                      v.old_price && v.old_price > v.price
                        ? Math.round(((v.old_price - v.price) / v.old_price) * 100)
                        : 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!v.in_stock}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors ${
                          !v.in_stock
                            ? 'opacity-45 cursor-not-allowed bg-zinc-100 dark:bg-[#172238] border-black/10 dark:border-white/10'
                            : isSel
                            ? 'border-blue-500 bg-blue-500/10 cursor-pointer'
                            : 'bg-zinc-100 dark:bg-[#172238] border-black/10 dark:border-white/10 hover:border-blue-500 cursor-pointer'
                        }`}
                      >
                        <span className="font-semibold text-sm">{v.label}</span>
                        <span className="flex items-center gap-2 flex-wrap justify-end tabular-nums">
                          {v.old_price && v.old_price > v.price && (
                            <>
                              <span className="text-xs text-zinc-500 line-through">
                                {formatPKR(v.old_price)}
                              </span>
                              {off > 0 && (
                                <span className="text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                  {off}% OFF
                                </span>
                              )}
                            </>
                          )}
                          {v.in_stock ? (
                            <span className="font-bold text-sm">{formatPKR(v.price)}</span>
                          ) : (
                            <span className="text-xs font-bold text-red-500">Sold out</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={!selectedVariant}
                    onClick={() => {
                      setOrderId(generateOrderId());
                      setCheckoutStep('checkout');
                    }}
                    className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-semibold text-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    Order now
                  </button>
                  <a
                    href={buildWhatsAppLink(
                      selectedVariant
                        ? `Assalam-o-Alaikum! I have a question about ${activeProduct.name} (${selectedVariant.label}).`
                        : `Assalam-o-Alaikum! I have a question about ${activeProduct.name}.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-100 dark:bg-[#172238] border border-black/10 dark:border-white/10 hover:border-blue-500 text-center font-semibold text-sm"
                  >
                    <MessageCircle className="w-4 h-4 text-green-500" />
                    Ask on WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              selectedVariant && (
                <div>
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('variants')}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 cursor-pointer"
                  >
                    &larr; Change package
                  </button>
                  <h2 className="font-display text-xl font-bold mb-3">Complete Your Order</h2>

                  <div className="bg-zinc-100 dark:bg-[#172238] border border-black/10 dark:border-white/10 rounded-xl p-3.5 space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Order Number</span>
                      <strong className="tabular-nums">{orderId}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Product</span>
                      <strong>{activeProduct.name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Package</span>
                      <strong>{selectedVariant.label}</strong>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-black/10 dark:border-white/10 text-blue-600 dark:text-blue-400 text-base">
                      <span>Total Payable</span>
                      <strong className="tabular-nums">{formatPKR(selectedVariant.price)}</strong>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-zinc-500 mb-2">
                    Send Manual Payment To Any Account
                  </div>
                  <div className="space-y-2.5 mb-4">
                    {activeStore.settings.payment_methods.map((pm) => (
                      <div
                        key={pm.id}
                        className="bg-zinc-100 dark:bg-[#172238] border border-black/10 dark:border-white/10 rounded-xl p-3 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-sm mb-0.5">{pm.name}</div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                            {pm.account_title && <div>Account Title: {pm.account_title}</div>}
                            {pm.account_number && <div>Account / IBAN: {pm.account_number}</div>}
                            {pm.extra_note && <div>{pm.extra_note}</div>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyValue(pm.id, pm.copy_value || pm.account_number)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer shrink-0 ${
                            copiedId === pm.id
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-white dark:bg-[#0f172a] border-black/10 dark:border-white/10 hover:border-blue-500'
                          }`}
                        >
                          {copiedId === pm.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === pm.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs sm:text-sm mb-4">
                    {activeStore.settings.payment_warning}
                  </div>

                  <a
                    href={buildWhatsAppLink(
                      activeStore.settings.whatsapp_template
                        .replace(/\{shop_name\}/g, activeStore.settings.shop_name)
                        .replace(/\{order_id\}/g, orderId)
                        .replace(/\{product\}/g, activeProduct.name)
                        .replace(/\{variant\}/g, selectedVariant.label)
                        .replace(/\{total\}/g, formatPKR(selectedVariant.price))
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors"
                  >
                    Send screenshot on WhatsApp
                  </a>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
