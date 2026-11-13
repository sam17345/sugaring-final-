export interface Variant {
  id: string;
  label: string;
  price: number;
  old_price: number | null;
  in_stock: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  icon: string;
  image: string;
  description: string;
  visible: boolean;
  variants: Variant[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  account_title: string;
  account_number: string;
  extra_note: string;
  copy_value: string;
}

export interface StoreData {
  meta: {
    last_published_at: string;
    draft_updated_at: string;
  };
  settings: {
    shop_name: string;
    tagline: string;
    whatsapp_number: string;
    announcement: string;
    footer_text: string;
    copyright_text: string;
    payment_warning: string;
    whatsapp_template: string;
    payment_methods: PaymentMethod[];
  };
  banner: {
    tag: string;
    title: string;
    text: string;
    button_text: string;
    image: string;
  };
  categories: { id: string; name: string }[];
  products: Product[];
}

export const INITIAL_STORE_DATA: StoreData = {
  meta: {
    last_published_at: '2026-11-12 21:00:00',
    draft_updated_at: '2026-11-12 21:00:00',
  },
  settings: {
    shop_name: 'SS Gaming Store',
    tagline: 'Instant Digital Top-Ups, Game Passes & Premium Subscriptions in Pakistan',
    whatsapp_number: '923424970004',
    announcement: 'Fast WhatsApp Delivery across Pakistan • Pay via JazzCash, Easypaisa or Meezan Bank',
    footer_text: 'Trusted digital top-ups, game passes, and premium subscriptions in Pakistan.',
    copyright_text: '© 2026 SS Gaming Store. All rights reserved.',
    payment_warning:
      'After payment, sending the screenshot is a must. Your codes will be delivered on the same WhatsApp chat.',
    whatsapp_template:
      'Assalam-o-Alaikum {shop_name}!\nOrder No: {order_id}\nProduct: {product}\nPackage: {variant}\nTotal: {total}\nI have paid, screenshot attached.',
    payment_methods: [
      {
        id: 'pm_jazzcash',
        name: 'JazzCash',
        account_title: 'MUHAMMAD SHAKEEL',
        account_number: '03261277193',
        extra_note: '',
        copy_value: '03261277193',
      },
      {
        id: 'pm_easypaisa',
        name: 'Easypaisa',
        account_title: '',
        account_number: '03424970004',
        extra_note: '',
        copy_value: '03424970004',
      },
      {
        id: 'pm_meezan',
        name: 'Meezan Bank',
        account_title: 'MUHAMMAD SHAKEEL',
        account_number: '02280105879611',
        extra_note: 'IBAN: PK47MEZN0002280105879611',
        copy_value: 'PK47MEZN0002280105879611',
      },
    ],
  },
  banner: {
    tag: "Pakistan's Digital Vault",
    title: 'Instant Game Top-Ups & Premium Passes',
    text: 'Verified UC, Diamonds, Game Pass, and streaming plans delivered directly on WhatsApp. Simple manual payment in PKR.',
    button_text: 'Explore Catalog',
    image: '',
  },
  categories: [
    { id: 'cat_gaming', name: 'Gaming' },
    { id: 'cat_social', name: 'Social Services' },
  ],
  products: [
    {
      id: 'prod_xbox_gpu',
      name: 'Xbox Game Pass Ultimate',
      category: 'Gaming',
      icon: 'gamepad',
      image: '',
      description: 'Access hundreds of PC and Console titles, EA Play, and online multiplayer on your Xbox or Windows PC.',
      visible: true,
      variants: [
        { id: 'v_xbox_1m', label: '1 Month Ultimate (PC & Console)', price: 1799, old_price: 2300, in_stock: true },
        { id: 'v_xbox_3m', label: '3 Months Ultimate', price: 4950, old_price: 6200, in_stock: true },
        { id: 'v_xbox_12m', label: '12 Months Ultimate', price: 17500, old_price: 21000, in_stock: true },
      ],
    },
    {
      id: 'prod_pubg_global',
      name: 'PUBG Global UC',
      category: 'Gaming',
      icon: 'crosshair',
      image: '',
      description: 'Official PUBG Mobile Global Unknown Cash top-up by Player ID. Fast delivery for Royale Pass and crates.',
      visible: true,
      variants: [
        { id: 'v_pg_60', label: '60 UC', price: 280, old_price: null, in_stock: true },
        { id: 'v_pg_325', label: '325 UC', price: 1390, old_price: 1550, in_stock: true },
        { id: 'v_pg_660', label: '660 UC (Royale Pass Pack)', price: 2750, old_price: 3100, in_stock: true },
        { id: 'v_pg_1800', label: '1,800 UC', price: 6950, old_price: 7600, in_stock: true },
      ],
    },
    {
      id: 'prod_pubg_kr',
      name: 'PUBG Korean UC',
      category: 'Gaming',
      icon: 'shield',
      image: '',
      description: 'Safe and quick UC packs for PUBG Mobile KRJP version with instant confirmation on WhatsApp.',
      visible: true,
      variants: [
        { id: 'v_pkr_60', label: '60 UC (KR)', price: 340, old_price: null, in_stock: true },
        { id: 'v_pkr_325', label: '325 UC (KR)', price: 1550, old_price: 1750, in_stock: true },
        { id: 'v_pkr_660', label: '660 UC (KR)', price: 2990, old_price: 3350, in_stock: true },
        { id: 'v_pkr_1800', label: '1,800 UC (KR)', price: 7450, old_price: null, in_stock: false },
      ],
    },
    {
      id: 'prod_tiktok_coins',
      name: 'TikTok Coins',
      category: 'Gaming',
      icon: 'coins',
      image: '',
      description: 'Recharge TikTok Live Coins in Pakistan at competitive PKR rates for gifting creators during live streams.',
      visible: true,
      variants: [
        { id: 'v_tt_350', label: '350 Coins', price: 1350, old_price: 1500, in_stock: true },
        { id: 'v_tt_700', label: '700 Coins', price: 2650, old_price: 2950, in_stock: true },
        { id: 'v_tt_1400', label: '1,400 Coins', price: 5200, old_price: 5800, in_stock: true },
        { id: 'v_tt_3500', label: '3,500 Coins', price: 12800, old_price: 14000, in_stock: true },
      ],
    },
    {
      id: 'prod_yalla_ludo',
      name: 'Yalla Ludo Deals',
      category: 'Gaming',
      icon: 'dice',
      image: '',
      description: 'Top up Yalla Ludo Diamonds and VIP memberships quickly using your Player ID.',
      visible: true,
      variants: [
        { id: 'v_yl_2340', label: '2,340 Diamonds', price: 650, old_price: null, in_stock: true },
        { id: 'v_yl_5860', label: '5,860 Diamonds', price: 1550, old_price: 1750, in_stock: true },
        { id: 'v_yl_11880', label: '11,880 Diamonds', price: 3050, old_price: 3400, in_stock: true },
        { id: 'v_yl_vip', label: 'VIP Monthly Pass', price: 1450, old_price: null, in_stock: true },
      ],
    },
    {
      id: 'prod_free_fire',
      name: 'Free Fire Diamonds',
      category: 'Gaming',
      icon: 'flame',
      image: '',
      description: 'Direct Free Fire Diamonds top-up via UID for Elite Pass, skins, and events.',
      visible: true,
      variants: [
        { id: 'v_ff_100', label: '100 Diamonds', price: 290, old_price: null, in_stock: true },
        { id: 'v_ff_310', label: '310 Diamonds', price: 850, old_price: 950, in_stock: true },
        { id: 'v_ff_520', label: '520 Diamonds', price: 1390, old_price: 1550, in_stock: true },
        { id: 'v_ff_1060', label: '1,060 Diamonds', price: 2750, old_price: 3000, in_stock: true },
      ],
    },
    {
      id: 'prod_chatgpt',
      name: 'ChatGPT',
      category: 'Social Services',
      icon: 'sparkles',
      image: '',
      description: 'Upgrade to ChatGPT Plus with priority access, advanced reasoning models, and image tools.',
      visible: true,
      variants: [
        { id: 'v_gpt_shared', label: 'Plus 1 Month (Shared Access)', price: 1650, old_price: 2200, in_stock: true },
        { id: 'v_gpt_private', label: 'Plus 1 Month (Private Account)', price: 4950, old_price: 5800, in_stock: true },
        { id: 'v_gpt_3m', label: 'Plus 3 Months (Private)', price: 14200, old_price: null, in_stock: true },
      ],
    },
    {
      id: 'prod_gemini_pro',
      name: 'Gemini Pro',
      category: 'Social Services',
      icon: 'cpu',
      image: '',
      description: 'Google AI Pro subscription with expanded context, Workspace integration, and cloud storage.',
      visible: true,
      variants: [
        { id: 'v_gem_1m', label: '1 Month Google AI Pro', price: 1450, old_price: 1950, in_stock: true },
        { id: 'v_gem_3m', label: '3 Months Google AI Pro', price: 3990, old_price: 4800, in_stock: true },
        { id: 'v_gem_12m', label: '1 Year Google AI Pro', price: 11500, old_price: 14000, in_stock: true },
      ],
    },
    {
      id: 'prod_capcut_pro',
      name: 'CapCut Pro',
      category: 'Social Services',
      icon: 'video',
      image: '',
      description: 'Unlock all Pro transitions, AI captions, effects, and watermark-free 4K exports on mobile & desktop.',
      visible: true,
      variants: [
        { id: 'v_cc_1m', label: '1 Month Pro (Private)', price: 950, old_price: 1300, in_stock: true },
        { id: 'v_cc_3m', label: '3 Months Pro', price: 2600, old_price: 3300, in_stock: true },
        { id: 'v_cc_12m', label: '1 Year Pro', price: 7800, old_price: 9500, in_stock: true },
      ],
    },
    {
      id: 'prod_spotify',
      name: 'Spotify Premium',
      category: 'Social Services',
      icon: 'music',
      image: '',
      description: 'Ad-free music, offline downloads, and unlimited skips activated directly on your own account.',
      visible: true,
      variants: [
        { id: 'v_sp_1m', label: '1 Month Individual', price: 450, old_price: 600, in_stock: true },
        { id: 'v_sp_3m', label: '3 Months Individual', price: 1250, old_price: 1650, in_stock: true },
        { id: 'v_sp_6m', label: '6 Months Individual', price: 2350, old_price: 3000, in_stock: true },
        { id: 'v_sp_12m', label: '12 Months Individual', price: 4400, old_price: 5500, in_stock: true },
      ],
    },
    {
      id: 'prod_netflix',
      name: 'Netflix',
      category: 'Social Services',
      icon: 'tv',
      image: '',
      description: 'Ultra HD 4K Netflix screen with PIN lock, smooth playback on TV, mobile, and laptop.',
      visible: true,
      variants: [
        { id: 'v_nf_1m_s', label: '1 Month 4K UHD (1 Screen)', price: 550, old_price: 750, in_stock: true },
        { id: 'v_nf_1m_p', label: '1 Month Private Profile + PIN', price: 750, old_price: 950, in_stock: true },
        { id: 'v_nf_3m_s', label: '3 Months 4K UHD (1 Screen)', price: 1550, old_price: 2100, in_stock: true },
      ],
    },
    {
      id: 'prod_prime_video',
      name: 'Prime Video',
      category: 'Social Services',
      icon: 'film',
      image: '',
      description: 'Stream Amazon Originals, movies, and series in 4K HDR across smart TVs and mobile devices.',
      visible: true,
      variants: [
        { id: 'v_pv_1m', label: '1 Month UHD Screen', price: 350, old_price: 500, in_stock: true },
        { id: 'v_pv_3m', label: '3 Months UHD Screen', price: 950, old_price: 1300, in_stock: true },
        { id: 'v_pv_6m', label: '6 Months Private Account', price: 1750, old_price: 2200, in_stock: true },
      ],
    },
    {
      id: 'prod_iptv',
      name: 'IPTV',
      category: 'Social Services',
      icon: 'radio',
      image: '',
      description: 'Buffer-free live sports, Pakistani & international channels, plus huge VOD library in HD/4K.',
      visible: true,
      variants: [
        { id: 'v_iptv_1m', label: '1 Month All Channels + VOD', price: 700, old_price: 950, in_stock: true },
        { id: 'v_iptv_3m', label: '3 Months Sports & Movies', price: 1850, old_price: 2400, in_stock: true },
        { id: 'v_iptv_6m', label: '6 Months VIP Server', price: 3400, old_price: 4200, in_stock: true },
        { id: 'v_iptv_12m', label: '12 Months Annual Pass', price: 5900, old_price: 7500, in_stock: true },
      ],
    },
    {
      id: 'prod_yt_watchtime',
      name: 'YouTube Watch Time',
      category: 'Social Services',
      icon: 'play',
      image: '',
      description: 'High-retention public watch hours to help your channel meet monetization eligibility safely.',
      visible: true,
      variants: [
        { id: 'v_yt_1k', label: '1,000 Watch Hours', price: 3500, old_price: 4200, in_stock: true },
        { id: 'v_yt_2k', label: '2,000 Watch Hours', price: 6500, old_price: 7800, in_stock: true },
        { id: 'v_yt_4k', label: '4,000 Watch Hours (Full Monetization Pack)', price: 11900, old_price: 14500, in_stock: true },
      ],
    },
  ],
};
