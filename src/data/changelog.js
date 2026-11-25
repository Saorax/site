export const changelog = [
  {
    date: '2026-11-24',
    area: 'Bifrost',
    title: 'Install and server guide',
    text: 'The Bifrost page has install steps, a step by step guide to hosting your own server, and links to every repo and release.',
    href: '/bifrost',
  },
  {
    date: '2026-11-20',
    area: 'Site',
    title: 'New home pages',
    text: 'The home page, the game hub and the esports hub were rebuilt with live rankings, the latest results and a card for every tool. Bifrost has its own page now.',
    href: '/',
  },
  {
    date: '2026-11-14',
    area: 'Competitive',
    title: 'Match VODs',
    text: 'Streamed matches link straight to the right moment of the VOD.',
    href: '/esports/tournaments',
  },
  {
    date: '2026-11-09',
    area: 'Game',
    title: 'True Combos',
    text: "Combos that can't be escaped, for every weapon, checked frame by frame.",
    href: '/game/combos',
  },
  {
    date: '2026-11-07',
    area: 'Bifrost',
    title: 'Share mods as .bmod files',
    text: 'A whole mod fits in one .bmod file. The Mod Kit explains how to add one.',
    href: '/bifrost/mods',
  },
  {
    date: '2026-11-03',
    area: 'Bifrost',
    title: 'Mod Kit, Move Editor and Map Editor',
    text: 'Guides and in-browser editors for making Bifrost mods.',
    href: '/bifrost',
  },
  {
    date: '2026-10-25',
    area: 'Competitive',
    title: 'Esports pages rebuilt',
    text: 'Tournaments, players and matches from start.gg and Challengermode, with live brackets and new Power Rankings.',
    href: '/esports',
  },
  {
    date: '2026-07-18',
    area: 'Game',
    title: 'Map Viewer',
    text: "Platforms, size and game modes for every stage.",
    href: '/game/maps',
  },
  {
    date: '2026-06-06',
    area: 'Game',
    title: 'Store database rebuilt',
    text: 'Skins, colors, emotes, bundles and battle passes, with search and filters.',
    href: '/game/database',
  },
  {
    date: '2025-12-19',
    area: 'Site',
    title: 'Changelog page and new color creator',
    text: 'Added this changelog and remade the color scheme creator.',
    href: '/game/colors',
  },
];

export const changelogAreas = {
  Site: 'slate',
  Competitive: 'amber',
  Game: 'blue',
  Bifrost: 'violet',
};

export const formatChangelogDate = (value) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

export const isRecentChange = (value, now = Date.now()) => now - new Date(`${value}T00:00:00Z`).getTime() < 30 * 24 * 60 * 60 * 1000;
