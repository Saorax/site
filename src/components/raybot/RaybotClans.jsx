import { useEffect } from 'react';
import { AsideBox, EmptyState, ErrorState, FactList, PageHeader, PageShell, Pagination, Pill, ScrollX, SearchInput, Section, SkeletonGrid, Tabs, cx, formatNumber, useApi, useDebounced, useQueryState } from '../ui';
import { clanHref, cleanName, dayText, raybotApi, timeAgo } from './raybot';
import { PlayerLink, useNow } from './parts';

const PER_PAGE = 50;

const SORTS = [
  { value: 'lifetime', label: 'Lifetime XP' },
  { value: 'xp', label: 'XP' },
  { value: 'members', label: 'Members' },
  { value: 'created', label: 'Oldest' },
];

export const clanTierTone = (tier) => ['slate', 'sky', 'emerald', 'blue', 'violet'][tier - 1] || 'slate';

export function ClanTier({ tier, className = '' }) {
  if (!tier) return null;
  return <Pill tone={clanTierTone(tier)} className={className}>Tier {tier}</Pill>;
}

function ClanName({ clan }) {
  const name = cleanName(clan.name) || `Clan ${clan.clanId}`;
  return (
    <div className="min-w-0">
      <a href={clanHref(clan.clanId)} className="block truncate font-bold text-white hover:text-blue-300 hover:underline">{name}</a>
      {clan.pastNames?.length > 0 && <div className="truncate text-[11px] text-slate-400">was {clan.pastNames.map(cleanName).join(', ')}</div>}
    </div>
  );
}

function ClanTable({ rows, sort }) {
  const strong = (key) => (sort === key ? 'font-bold text-white' : 'text-slate-300');
  return (
    <ScrollX>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="w-14 px-2 py-1 text-right font-bold">#</th>
            <th className="px-2 py-1 text-left font-bold">Clan</th>
            <th className="hidden px-2 py-1 text-left font-bold sm:table-cell">Tier</th>
            <th className="px-2 py-1 text-right font-bold">{sort === 'xp' ? 'XP' : 'Lifetime XP'}</th>
            <th className="hidden px-2 py-1 text-right font-bold md:table-cell">{sort === 'xp' ? 'Lifetime XP' : 'XP'}</th>
            <th className="hidden px-2 py-1 text-right font-bold sm:table-cell">Members</th>
            <th className="hidden px-2 py-1 text-left font-bold lg:table-cell">Leader</th>
            <th className="hidden px-2 py-1 text-right font-bold md:table-cell">Created</th>
            <th className="hidden px-2 py-1 text-right font-bold xl:table-cell">Saved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((clan) => {
            const first = sort === 'xp' ? clan.xp : clan.lifetimeXp;
            const second = sort === 'xp' ? clan.lifetimeXp : clan.xp;
            return (
              <tr key={clan.clanId} className="hover:bg-slate-800/40">
                <td className="px-2 py-1.5 text-right align-top font-bold tabular-nums text-slate-300">{formatNumber(clan.rank)}</td>
                <td className="max-w-[18rem] px-2 py-1.5">
                  <ClanName clan={clan} />
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-slate-400 sm:hidden">
                    {clan.tier && <span>Tier {clan.tier}</span>}
                    {clan.members != null && <span>{formatNumber(clan.members)} members</span>}
                    {clan.createdAt && <span>{new Date(clan.createdAt).getUTCFullYear()}</span>}
                  </div>
                </td>
                <td className="hidden px-2 py-1.5 sm:table-cell">{clan.tier ? <ClanTier tier={clan.tier} /> : <span className="text-slate-600">–</span>}</td>
                <td className={cx('px-2 py-1.5 text-right tabular-nums', strong(sort === 'xp' ? 'xp' : 'lifetime'))}>{first != null ? formatNumber(first) : '–'}</td>
                <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 md:table-cell">{second != null ? formatNumber(second) : '–'}</td>
                <td className={cx('hidden px-2 py-1.5 text-right tabular-nums sm:table-cell', strong('members'))}>
                  {clan.members != null ? <>{formatNumber(clan.members)}<span className="text-slate-500">/{clan.memberCap}</span></> : '–'}
                </td>
                <td className="hidden max-w-[12rem] px-2 py-1.5 lg:table-cell">
                  {clan.leader ? <PlayerLink bhid={clan.leader.bhid} className="block truncate text-slate-200">{cleanName(clan.leader.name) || `ID ${clan.leader.bhid}`}</PlayerLink> : <span className="text-slate-600">–</span>}
                </td>
                <td className={cx('hidden whitespace-nowrap px-2 py-1.5 text-right text-xs md:table-cell', strong('created'))}>{clan.createdAt ? dayText(clan.createdAt) : '–'}</td>
                <td className="hidden whitespace-nowrap px-2 py-1.5 text-right text-xs text-slate-400 xl:table-cell">{dayText(clan.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollX>
  );
}

function Tiers({ data }) {
  const most = Math.max(1, ...data.tiers.map((tier) => tier.clans));
  return (
    <AsideBox title="Tiers">
      <ul className="space-y-1.5 text-xs">
        {data.tiers.slice().reverse().map((tier) => (
          <li key={tier.tier} title={`${formatNumber(tier.xp)}+ XP, up to ${tier.memberCap} members`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-slate-200">Tier {tier.tier}</span>
              <span className="tabular-nums text-slate-300">{formatNumber(tier.clans)}</span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-slate-800">
              <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${(tier.clans / most) * 100}%` }} />
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">{formatNumber(tier.xp)}+ XP · {tier.memberCap} members</div>
          </li>
        ))}
      </ul>
    </AsideBox>
  );
}

function Saved({ data }) {
  return (
    <AsideBox title="Saved clans">
      <FactList
        rows={[
          { label: 'Clans', value: formatNumber(data.clans) },
          { label: 'With members', value: formatNumber(data.withMembers), title: 'Looked up with the bot, so their members, XP and tier are saved' },
          { label: 'Name only', value: formatNumber(data.clans - data.withMembers), title: 'Saved from a member\'s stats: name and lifetime XP only' },
        ]}
      />
    </AsideBox>
  );
}

export default function RaybotClans() {
  const [sortText, setSort] = useQueryState('sort', 'lifetime');
  const [pageText, setPage] = useQueryState('page', '1');
  const [query, setQuery] = useQueryState('q', '');
  const search = useDebounced(query.replace(/\s+/g, ' ').trim(), 250);
  const sort = SORTS.some((item) => item.value === sortText) ? sortText : 'lifetime';
  const page = Math.max(1, Number.parseInt(pageText, 10) || 1);
  const state = useApi(raybotApi(`/clans/leaderboard?sort=${sort}&page=${page}&perPage=${PER_PAGE}${search ? `&search=${encodeURIComponent(search)}` : ''}`));
  const now = useNow(60000);
  const data = state.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;
  useEffect(() => {
    if (data && page > totalPages) setPage(String(totalPages));
  }, [data, page, totalPages, setPage]);

  const pick = (setter) => (value) => {
    setter(value);
    setPage('1');
  };
  const goTo = (next) => {
    setPage(String(next));
    document.getElementById('clans')?.scrollIntoView({ block: 'start' });
  };

  const first = data && data.total ? (page - 1) * PER_PAGE + 1 : 0;
  const last = data ? Math.min(data.total, page * PER_PAGE) : 0;
  const aside = data ? (
    <>
      <Saved data={data} />
      <Tiers data={data} />
    </>
  ) : null;

  return (
    <PageShell aside={aside} asideLabel="Clan stats">
      <PageHeader title="Clans" meta={data?.updatedAt ? `Updated ${timeAgo(data.updatedAt, now)}` : undefined}>
        <Tabs label="Sort by" value={sort} onChange={pick(setSort)} items={SORTS} />
        <SearchInput value={query} onChange={pick(setQuery)} placeholder="Clan name or clan ID" label="Find a clan" />
      </PageHeader>

      {state.error && !data ? (
        <ErrorState message="Couldn't load the clans." detail={state.error} onRetry={state.retry} />
      ) : !data ? (
        <SkeletonGrid count={8} className="grid-cols-1" tileClassName="h-10" />
      ) : (
        <Section
          id="clans"
          title={SORTS.find((item) => item.value === sort)?.label}
          count={formatNumber(data.total)}
          headingAs="h2"
          padded={false}
          actions={data.total > 0 && <span className="text-xs tabular-nums text-slate-400">{formatNumber(first)}–{formatNumber(last)}</span>}
        >
          {data.total ? (
            <ClanTable rows={data.rows} sort={sort} />
          ) : (
            <EmptyState title={search ? `No saved clan called "${search}"` : 'No clans on this board'} className="m-3">
              {search && sort !== 'lifetime' && 'This sort only lists clans with saved members. Lifetime XP lists every saved clan.'}
            </EmptyState>
          )}
          <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={goTo} className="border-t border-slate-800" />
          {sort !== 'lifetime' && (
            <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
              Only clans looked up with the bot have their members, XP and tier saved. Lifetime XP lists every saved clan.
            </p>
          )}
        </Section>
      )}
    </PageShell>
  );
}
