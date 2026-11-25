import { sections, siteLinks } from './sections.js';

export const foldName = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

export function closestNames(query, items, nameOf, limit = 5) {
  const key = foldName(query);
  if (!key) return [];
  const allowed = Math.max(2, Math.floor(key.length / 3));
  return items
    .map((item) => {
      const names = [].concat(nameOf(item)).map(foldName).filter(Boolean);
      const score = Math.min(...names.map((name) => (name.startsWith(key) || key.startsWith(name) ? 0 : editDistance(key, name))));
      return { item, score };
    })
    .filter((entry) => entry.score <= allowed)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export const sitePages = () => [
  { title: 'Home', href: '/' },
  ...sections.flatMap((section) => [
    { title: section.hubLabel, href: section.href, section: section.key },
    ...section.tools.map((tool) => ({ title: tool.title, href: tool.href, section: section.key })),
    ...(section.navExtra ?? []).map((link) => ({ title: link.label, href: link.href, section: section.key })),
  ]),
  ...siteLinks.map((link) => ({ title: link.title, href: link.href })),
].filter((page, index, list) => list.findIndex((other) => other.href === page.href) === index);

const trimPath = (path) => {
  const clean = `/${String(path ?? '').split(/[?#]/)[0].split('/').filter(Boolean).join('/')}`.toLowerCase();
  return clean === '/' ? '/' : clean.replace(/\/$/, '');
};

export function pageSuggestions(path, pages = sitePages(), limit = 4) {
  const segments = trimPath(path).split('/').filter(Boolean);
  const deduped = segments.filter((segment, index) => segment !== segments[index - 1]);
  const known = new Map(pages.map((page) => [trimPath(page.href), page]));
  const found = [];
  const add = (page) => { if (page && !found.includes(page)) found.push(page); };
  for (let length = deduped.length; length > 0; length -= 1) {
    const exact = known.get(`/${deduped.slice(0, length).join('/')}`);
    if (exact) { add(exact); break; }
  }
  const last = deduped.at(-1) ?? '';
  closestNames(last, pages.filter((page) => page.href !== '/'), (page) => [trimPath(page.href).split('/').at(-1), page.title], limit)
    .forEach(add);
  return found.slice(0, limit);
}
