export const RAW_METADATA = 'Raw Metadata';

export const NAV_GROUPS = [
  {
    title: 'Cosmetics',
    pages: [
      'Skins',
      'Weapon Skins',
      'Colors',
      'Avatars',
      'Emojis',
      'Taunts',
      'Podiums',
      'KO Effects',
      'Smoke Trails',
      'Sidekicks',
      'Companions',
      'UI Themes',
      'Borders',
      'Titles',
    ],
  },
  {
    title: 'Store & events',
    pages: [
      'Bundles',
      'Chests',
      'Battle Passes',
      'Skirmishes',
      'Promo Rewards',
      'Entitlements/Purchases',
    ],
  },
  {
    title: 'Game files',
    pages: [
      'Missions',
      'Achievements',
      'Tournament Events',
      'Guild Missions',
      'Helpful Hints',
      'Music',
      'Splash Arts',
      'Client Themes',
      RAW_METADATA,
    ],
  },
];

export const NAV_PAGES = NAV_GROUPS.flatMap((group) => group.pages).filter((page) => page !== RAW_METADATA);

export const pageSlug = (page) => String(page || '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const PAGE_BY_SLUG = {
  ...Object.fromEntries(NAV_PAGES.map((page) => [pageSlug(page), page])),
  entitlements: 'Entitlements/Purchases',
};

export const selectionFromParams = (params) => {
  if (params.get('page') === 'raw-metadata') {
    return { category: RAW_METADATA, subcategory: null };
  }
  const page = PAGE_BY_SLUG[params.get('page') || ''];
  if (page) return { category: 'Game Database', subcategory: page };
  if (params.get('skin') || params.get('legend')) return { category: 'Game Database', subcategory: 'Skins' };
  if (params.get('taunt')) return { category: 'Game Database', subcategory: 'Taunts' };
  if (params.get('weapon')) return { category: 'Game Database', subcategory: 'Weapon Skins' };
  if (params.get('spawnbot')) return { category: 'Game Database', subcategory: 'Sidekicks' };
  if (params.get('color')) return { category: 'Game Database', subcategory: 'Colors' };
  if (params.get('koEffect') || params.get('koeffect')) return { category: 'Game Database', subcategory: 'KO Effects' };
  if (params.get('smoketrail') || params.get('smokeTrail')) return { category: 'Game Database', subcategory: 'Smoke Trails' };
  if (params.get('avatar')) return { category: 'Game Database', subcategory: 'Avatars' };
  if (params.get('podium')) return { category: 'Game Database', subcategory: 'Podiums' };
  return { category: 'Game Database', subcategory: 'Skins' };
};

export const DATABASE_TITLE = 'Brawlhalla store and cosmetics';

export const databasePageTitle = (selection) => {
  const page = selection?.category === RAW_METADATA ? RAW_METADATA : selection?.subcategory;
  return page ? `${page} · ${DATABASE_TITLE}` : DATABASE_TITLE;
};
