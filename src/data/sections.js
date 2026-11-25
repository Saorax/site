export const sections = [
  {
    key: 'competitive',
    title: 'Competitive',
    href: '/esports',
    hubLabel: 'Esports Hub',
    tools: [
      { title: 'Power Rankings', href: '/pr', icon: 'trophy', text: "Top players in every region, 1v1 and 2v2." },
      { title: 'Players', href: '/esports/player', icon: 'user', text: "Placements, matches and head-to-heads for any player." },
      { title: 'Tournaments', href: '/esports/tournaments', icon: 'bracket', text: 'Official and community events with brackets, results and match details.' },
      { title: 'Match Data', href: '/esports/match-data', icon: 'chart', text: 'Legend picks, win rates, maps and matchups from every reported tournament game.' },
      { title: 'Esports Hub', href: '/esports', icon: 'globe', text: "What's on, latest results and all-time records." },
    ],
    navExtra: [{ label: 'All-Time Records', href: '/esports/records' }, { label: 'Autoseed for TOs', href: '/esports/autoseed' }],
  },
  {
    key: 'ranked',
    title: 'Ranked',
    href: '/raybot',
    hubLabel: 'Raybot',
    tools: [
      { title: 'Raybot', href: '/raybot', icon: 'ranks', text: "Who's in ranked queue now, the top 3 on every server and the Discord bot's commands." },
      { title: 'Leaderboards', href: '/raybot/rankings', icon: 'trophy', text: 'The top 500 of every server in 1v1, 2v2 and Rotating, or all servers together.' },
      { title: 'Ranked Queue', href: '/raybot/queue', icon: 'clock', text: "Who from each top 500 is playing ranked now, with their rating change this session." },
      { title: 'Legend Stats', href: '/raybot/legends', icon: 'legend', text: 'Players, win rates and 1v1 peaks for every legend, with a leaderboard for each.' },
      { title: 'Clans', href: '/raybot/clans', icon: 'banner', text: 'Clans by lifetime XP, XP and members, with every member and the XP they gave.' },
      { title: 'Glory Calculator', href: '/raybot/glory', icon: 'calculator', text: 'Season-end glory from ranked wins and peak rating, typed in or from a saved player.' },
      { title: 'Ranked Stats', href: '/raybot/stats', icon: 'chart', text: 'When each top 500 plays, games per day, tier spread and the most used 1v1 legends.' },
    ],
  },
  {
    key: 'game',
    title: 'Game',
    href: '/game',
    hubLabel: 'Game data hub',
    tools: [
      { title: 'Legends', href: '/game/legends', icon: 'legend', text: 'Stats, weapons, signatures, skins and every balance change for each legend.' },
      { title: 'Game Database', href: '/game/database', icon: 'bag', text: 'Every skin, color, emote, podium, bundle and battle pass, with prices.' },
      { title: 'Patch History', href: '/game/patch', icon: 'scroll', text: 'Every update, with the numbers the official notes leave out.' },
      { title: 'Animations', href: '/game/anim', icon: 'film', text: 'Watch any move frame by frame with its hitboxes.' },
      { title: 'Maps', href: '/game/maps', icon: 'map', text: "Platforms, size and game modes for every stage." },
      { title: 'Color Creator', href: '/game/colors', icon: 'palette', text: 'Recolor any skin with any color scheme and export it as an image or GIF.' },
      { title: 'Weapon Chart', href: '/game/weapons', icon: 'swords', text: 'Which legend has each weapon pair, and the pairs no legend has yet.' },
      { title: 'True Combos', href: '/game/combos', icon: 'bolt', text: "Combos that can't be escaped, checked frame by frame for each weapon and legend." },
      { title: 'News', href: '/game/news', icon: 'news', text: 'Posts from brawlhalla.com, with each patch post linked to its changes here.' },
    ],
  },
  {
    key: 'bifrost',
    title: 'Bifrost',
    blurb: 'A modded Brawlhalla client.',
    href: '/bifrost',
    hubLabel: 'About Bifrost',
    tools: [
      { title: 'Home', href: '/bifrost', icon: 'puzzle', text: 'Everything you need to know about Bifrost.' },
      { title: 'Mod Kit', href: '/bifrost/mods', icon: 'puzzle', text: 'How to install, make and share mods: skins, colors, moves, maps and more.' },
      { title: 'Move Editor', href: '/bifrost/move-editor', icon: 'sliders', text: "Change any move's numbers and hitboxes, then download it as a mod." },
      { title: 'Map Editor', href: '/bifrost/map-editor/', icon: 'grid', text: 'Build or edit a map in your browser and save it for Bifrost.' },
    ],
  },
];

export const siteLinks = [{ title: 'Changelog', href: '/changelog', icon: 'list' }];

export const externalLinks = [{ title: 'API', href: 'https://api.saorax.com/' }];

export const moreLinks = [{ title: 'Ping Checker', href: 'https://github.com/Saorax/ping-checker/releases' }];

export const sectionByKey = (key) => sections.find((section) => section.key === key);

export const navLinks = (key) => [
  ...(sectionByKey(key)?.tools ?? []).map((tool) => ({ label: tool.nav || tool.title, href: tool.href })),
  ...(sectionByKey(key)?.navExtra ?? []),
];
