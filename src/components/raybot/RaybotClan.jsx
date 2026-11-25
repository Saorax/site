import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorState, LoadingState, PageHeader, PageShell, Pill, ScrollX, SearchInput, Section, Tabs, foldText, formatNumber, useApi, useQueryState } from '../ui';
import { cleanName, dayText, raybotApi, timeAgo } from './raybot';
import { Fact, PlayerLink, useNow } from './parts';
import { ClanTier } from './RaybotClans';

const RANKS = ['Leader', 'Officer', 'Member', 'Recruit'];

const rankTone = { Leader: 'amber', Officer: 'sky', Member: 'slate', Recruit: 'slate' };

const SORTS = [
  { value: 'rank', label: 'Rank' },
  { value: 'xp', label: 'XP given' },
  { value: 'joined', label: 'Newest' },
  { value: 'name', label: 'Name' },
];

const share = (value) => (value == null ? '–' : value < 0.001 && value > 0 ? '<0.1%' : `${(value * 100).toFixed(1)}%`);

const memberName = (member) => cleanName(member.name) || `ID ${member.bhid}`;

const sorters = {
  rank: () => 0,
  xp: (a, b) => (b.xp ?? 0) - (a.xp ?? 0),
  joined: (a, b) => String(b.joinedAt || '').localeCompare(String(a.joinedAt || '')),
  name: (a, b) => memberName(a).localeCompare(memberName(b), undefined, { sensitivity: 'base' }),
};

function Name({ member }) {
  const name = memberName(member);
  if (!member.profile) return <span className="block truncate font-bold text-slate-200" title={`Brawlhalla ID ${member.bhid}`}>{name}</span>;
  return <PlayerLink bhid={member.bhid} className="block truncate font-bold text-white">{name}</PlayerLink>;
}

function MemberTable({ members, former = false }) {
  return (
    <ScrollX>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="px-2 py-1 text-left font-bold">Player</th>
            <th className="hidden px-2 py-1 text-left font-bold sm:table-cell">{former ? 'Last rank' : 'Rank'}</th>
            <th className="px-2 py-1 text-right font-bold">XP given</th>
            <th className="hidden px-2 py-1 text-right font-bold sm:table-cell" title="Share of the clan's lifetime XP">Share</th>
            <th className="hidden px-2 py-1 text-right font-bold md:table-cell">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {members.map((member) => (
            <tr key={member.bhid} className="hover:bg-slate-800/40">
              <td className="max-w-[16rem] px-2 py-1.5">
                <Name member={member} />
                <div className="flex flex-wrap gap-x-2 text-[11px] text-slate-400 md:hidden">
                  {member.rank && <span className="sm:hidden">{member.rank}</span>}
                  {member.joinedAt && <span>joined {dayText(member.joinedAt)}</span>}
                </div>
              </td>
              <td className="hidden px-2 py-1.5 sm:table-cell">{member.rank ? <Pill tone={rankTone[member.rank] || 'slate'}>{member.rank}</Pill> : <span className="text-slate-600">–</span>}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-white">
                {member.xp != null ? formatNumber(member.xp) : '–'}
                <div className="text-[11px] text-slate-400 sm:hidden">{share(member.share)}</div>
              </td>
              <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 sm:table-cell">{share(member.share)}</td>
              <td className="hidden whitespace-nowrap px-2 py-1.5 text-right text-xs text-slate-300 md:table-cell">{member.joinedAt ? dayText(member.joinedAt) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

function useFiltered(list, query, rank, sort) {
  return useMemo(() => {
    const text = foldText(query.trim());
    const id = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;
    return list
      .filter((member) => rank === 'all' || member.rank === rank)
      .filter((member) => !text || member.bhid === id || foldText(memberName(member)).includes(text))
      .slice()
      .sort(sorters[sort] || sorters.rank);
  }, [list, query, rank, sort]);
}

function Members({ clan }) {
  const [query, setQuery] = useQueryState('q', '');
  const [rankText, setRank] = useQueryState('rank', 'all');
  const [sortText, setSort] = useQueryState('sort', 'rank');
  const rank = rankText === 'all' || RANKS.includes(rankText) ? rankText : 'all';
  const sort = SORTS.some((item) => item.value === sortText) ? sortText : 'rank';
  const shown = useFiltered(clan.members, query, rank, sort);
  const rankTabs = [
    { value: 'all', label: 'All', count: formatNumber(clan.members.length) },
    ...RANKS.filter((name) => clan.rankCounts?.[name]).map((name) => ({ value: name, label: name, count: formatNumber(clan.rankCounts[name]) })),
  ];
  return (
    <Section id="members" title="Members" count={formatNumber(clan.members.length)} headingAs="h2" padded={false}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Tabs variant="small" label="Rank" value={rank} onChange={setRank} items={rankTabs} />
        <Tabs variant="small" label="Sort members" value={sort} onChange={setSort} items={SORTS} />
        <div className="w-full sm:w-64">
          <SearchInput value={query} onChange={setQuery} placeholder="Name or ID" label="Find a member" />
        </div>
      </div>
      {shown.length ? <MemberTable members={shown} /> : <EmptyState title="No members match" bare />}
    </Section>
  );
}

function Former({ clan }) {
  const list = clan.formerMembers;
  if (!list.length) return null;
  return (
    <Section id="left" title="Left the clan" count={formatNumber(list.length)} headingAs="h2" padded={false} collapsible>
      <MemberTable members={list} former />
      <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">XP and rank from the last time Raybot saw them in the clan. Leave dates aren't saved.</p>
    </Section>
  );
}

function Facts({ clan }) {
  const tier = clan.tier;
  const rankNote = (place) => (place ? `#${formatNumber(place.rank)} of ${formatNumber(place.of)}` : undefined);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Fact label="Lifetime XP" value={clan.lifetimeXp != null ? formatNumber(clan.lifetimeXp) : '–'} note={rankNote(clan.ranks?.lifetime)} />
      {clan.full && <Fact label="XP" value={formatNumber(clan.xp)} note={rankNote(clan.ranks?.xp)} />}
      {tier && (
        <Fact
          label="Tier"
          value={`Tier ${tier.tier}`}
          note={tier.nextTier ? `${formatNumber(tier.xpToNextTier)} XP to Tier ${tier.nextTier}` : 'Highest tier'}
        />
      )}
      {clan.full && <Fact label="Members" value={`${formatNumber(clan.memberCount)}/${tier?.memberCap ?? '–'}`} />}
      {clan.createdAt && <Fact label="Created" value={dayText(clan.createdAt)} />}
      {clan.leader && (
        <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Leader</div>
          <Name member={clan.leader} />
          {clan.leader.joinedAt && <div className="truncate text-[11px] text-slate-400">since {dayText(clan.leader.joinedAt)}</div>}
        </div>
      )}
    </div>
  );
}

export default function RaybotClan({ clanId }) {
  const state = useApi(raybotApi(`/clans/${clanId}`));
  const now = useNow(60000);
  const clan = state.data;
  const missing = /^No Raybot data/i.test(state.error?.message || '');
  const titleName = clan ? cleanName(clan.name) : '';
  useEffect(() => {
    if (titleName) document.title = `${titleName}: Brawlhalla Clan`;
  }, [titleName]);

  if (state.loading && !clan) return <PageShell><LoadingState /></PageShell>;
  if (missing) {
    return (
      <PageShell>
        <EmptyState title="Raybot has no saved data for this clan" className="m-3">
          <a href="/raybot/clans" className="font-bold text-blue-300 hover:underline">All clans</a>
        </EmptyState>
      </PageShell>
    );
  }
  if (state.error && !clan) return <PageShell><ErrorState message="Couldn't load this clan." detail={state.error} onRetry={state.retry} /></PageShell>;

  const name = cleanName(clan.name) || `Clan ${clan.clanId}`;
  const meta = [`Clan ID ${clan.clanId}`, clan.updatedAt && `Updated ${timeAgo(clan.updatedAt, now)}`].filter(Boolean).join(' · ');
  return (
    <PageShell>
      <PageHeader
        title={name}
        titleNote={clan.tier ? <ClanTier tier={clan.tier.tier} /> : null}
        meta={meta}
        actions={<a href="/raybot/clans" className="rounded-lg bg-slate-800 px-2 py-1 text-sm font-bold text-blue-200 hover:bg-slate-700">All clans</a>}
      >
        {clan.pastNames?.length > 0 && <p className="text-sm text-slate-300"><span className="text-slate-400">Was </span>{clan.pastNames.map(cleanName).join(', ')}</p>}
        <Facts clan={clan} />
      </PageHeader>
      {clan.full ? (
        <div className={clan.formerMembers.length ? 'grid items-start gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}>
          {clan.members.length > 0 ? <Members clan={clan} /> : <EmptyState title="No saved members" />}
          <Former clan={clan} />
        </div>
      ) : (
        <EmptyState title="Only the name and lifetime XP are saved">
          Members, XP and tier are saved when someone looks the clan up with Raybot's <code className="rounded bg-slate-800 px-1">/clan</code> command.
        </EmptyState>
      )}
    </PageShell>
  );
}
