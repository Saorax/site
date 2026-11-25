import { Pill } from './Pill';
import { PriceList } from './Price';
import { cx } from './tones';

export const SOURCE_TYPES = {
  store: { label: 'Store', tone: 'blue' },
  bundle: { label: 'Bundle', tone: 'blue' },
  battlePass: { label: 'Battle Pass', tone: 'emerald' },
  chest: { label: 'Chest', tone: 'amber' },
  event: { label: 'Event', tone: 'rose' },
  skirmish: { label: 'Skirmish', tone: 'rose' },
  promo: { label: 'Promo code', tone: 'violet' },
  pack: { label: 'Pack', tone: 'amber' },
  upgrade: { label: 'Upgrade', tone: 'emerald' },
  mission: { label: 'Mission', tone: 'emerald' },
  levelUp: { label: 'Legend level', tone: 'sky' },
  comesWith: { label: 'Comes with a skin', tone: 'slate' },
  ranked: { label: 'Ranked', tone: 'sky' },
  esports: { label: 'Esports', tone: 'sky' },
  account: { label: 'Account', tone: 'slate' },
  clan: { label: 'Clan', tone: 'slate' },
  free: { label: 'Free', tone: 'emerald' },
  team: { label: 'Team color', tone: 'slate' },
  staff: { label: 'Staff only', tone: 'slate' },
};

export const NO_SOURCE_LABEL = 'No known way';

export const SOURCE_FILTER_ORDER = [...Object.values(SOURCE_TYPES).map((entry) => entry.label), NO_SOURCE_LABEL];

export const hasSources = (item) => Array.isArray(item?.sources);

export const sourceTone = (source) => SOURCE_TYPES[source?.type]?.tone || 'slate';

export const sourceSentence = (source) => [source?.label, source?.text].filter(Boolean).join(': ');

export function sourceFilterValues(item) {
  if (!hasSources(item)) return [];
  if (!item.sources.length) return [NO_SOURCE_LABEL];
  return [...new Set(item.sources.map((source) => SOURCE_TYPES[source.type]?.label || source.label).filter(Boolean))];
}

export function sortSourceFilterValues(values) {
  const rank = (value) => {
    const index = SOURCE_FILTER_ORDER.indexOf(value);
    return index === -1 ? SOURCE_FILTER_ORDER.length : index;
  };
  return [...new Set(values)].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
}

export function sourceShortText(source) {
  switch (source?.type) {
    case 'battlePass':
      return source.season ? `Battle Pass S${source.season}` : 'Battle Pass';
    case 'bundle':
      return 'Bundle';
    case 'promo':
      return 'Promo code';
    case 'comesWith':
      return `With ${source.text}`;
    case 'store':
      return source.event ? `${source.event} store` : 'Store';
    case 'levelUp':
      return source.level ? source.text : 'Level-up reward';
    case 'event':
      return source.event ? `${source.event} event` : source.text || source.label;
    case 'esports':
    case 'clan':
    case 'ranked':
      return source.text ? `${source.label}: ${source.text}` : source.label;
    default:
      return source?.text || source?.label || '';
  }
}

export function SourceLine({ sources, max = 2, align = 'center', phoneCompact = false, className = '' }) {
  if (!Array.isArray(sources)) return null;
  const justify = align === 'center' ? 'justify-center' : 'justify-start';
  const items = align === 'center' ? 'items-center' : 'items-start';
  if (!sources.length) return <div className={cx('flex text-xs text-slate-500', justify, className)}>{NO_SOURCE_LABEL} to get it</div>;
  const priced = sources.find((source) => source.type === 'store' && source.prices?.length);
  const rest = sources.filter((source) => source !== priced);
  const shown = rest.slice(0, priced ? max : max + 1);
  const more = rest.length - shown.length;
  const phoneShown = phoneCompact ? (priced ? 0 : 1) : shown.length;
  const phoneMore = rest.length - Math.min(phoneShown, shown.length);
  const phoneHidden = (index) => index >= phoneShown && 'max-sm:hidden';
  const pill = (source, index) => (
    <Pill key={`${source.type}-${index}`} tone={sourceTone(source)} title={sourceSentence(source)} className={cx('min-w-0 max-w-full truncate', phoneHidden(index))}>
      <span className="truncate">{sourceShortText(source)}</span>
    </Pill>
  );
  const moreCounts = (
    <>
      {phoneMore > more && <span className="shrink-0 text-xs text-slate-400 sm:hidden" title={rest.map(sourceSentence).join('\n')}>+{phoneMore}</span>}
      {more > 0 && <span className={cx('shrink-0 text-xs text-slate-400', phoneMore > more && 'max-sm:hidden')} title={rest.slice(shown.length).map(sourceSentence).join('\n')}>+{more}</span>}
    </>
  );
  return (
    <div className={cx('flex min-w-0 max-w-full flex-col gap-1', items, className)}>
      {priced?.event && <Pill tone="rose" title={sourceSentence(priced)} className={cx('max-w-full', phoneCompact && 'max-sm:hidden')}><span className="truncate">{priced.event}</span></Pill>}
      {priced?.tag && <Pill tone={priced.tag === 'New' ? 'amber' : 'rose'} className="max-w-full"><span className="truncate">{priced.tag}</span></Pill>}
      {shown.slice(0, -1).map(pill)}
      {shown.length > 0 && (
        <div className={cx('flex min-w-0 max-w-full items-center gap-1', justify)}>
          {pill(shown[shown.length - 1], shown.length - 1)}
          {moreCounts}
        </div>
      )}
      {priced && <PriceList prices={priced.prices} size="sm" />}
    </div>
  );
}

export function SourceList({ sources, className = '' }) {
  if (!Array.isArray(sources)) return null;
  if (!sources.length) return <p className={cx('max-w-prose text-sm text-slate-400', className)}>No known way to get it. It may be a test item or something the game hands out on its own.</p>;
  return (
    <ul className={cx('space-y-1.5', className)}>
      {sources.map((source, index) => (
        <li key={`${source.type}-${index}`} className="flex flex-col items-start gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <Pill tone={sourceTone(source)}>{source.label}</Pill>
            {source.text && <span className="min-w-0 text-sm text-slate-100">{source.text}</span>}
            {source.tag && <Pill tone={source.tag === 'New' ? 'amber' : 'rose'}>{source.tag}</Pill>}
          </span>
          {source.prices?.length > 0 && <PriceList prices={source.prices} size="sm" />}
        </li>
      ))}
    </ul>
  );
}
