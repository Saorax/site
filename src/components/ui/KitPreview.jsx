import { useMemo, useState } from 'react';
import {
  CountPill, CountPills, EmptyState, ErrorState, FilterBar, Heading, ImageTile, JumpNav, LegendFace, LoadingState, MapTile,
  PageHeader, PageShell, Pagination, Pill, Price, PriceList, SearchInput, Section, SelectInput, ShowMore, SidebarHeader,
  SidebarItem, SkeletonGrid, Tabs, TileGrid, Toggle, Card, Img, apiUrl, legendHref, useApi, useDebounced,
  DataViewToggle, FieldTable, FullOnly, RawData, ShowFullData, ListTools, AsideBox, FactList, LinkList, OnThisPage,
} from './index';

const fold = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const sidebarPages = [
  { id: 'overview', label: 'Overview', note: 'Headers, pills and tabs' },
  { id: 'tiles', label: 'Tiles', note: 'Legends, maps and images' },
  { id: 'states', label: 'States', note: 'Loading, empty and errors' },
  { id: 'prices', label: 'Prices', note: 'Currencies and event coins' },
  { id: 'data-view', label: 'Simple / Full data', note: 'Toggle and raw data drawer' },
];

export default function KitPreview() {
  const legends = useApi(apiUrl('/game/legends/summary'));
  const maps = useApi(apiUrl('/game/maps/catalog'));
  const broken = useApi(apiUrl('/game/this-route-does-not-exist'));
  const [active, setActive] = useState('overview');
  const [view, setView] = useState('simple');
  const [query, setQuery] = useState('');
  const [weapon, setWeapon] = useState('');
  const [newestFirst, setNewestFirst] = useState(false);
  const [page, setPage] = useState(1);
  const [shownMaps, setShownMaps] = useState(12);
  const search = useDebounced(query, 150);

  const weapons = useMemo(() => {
    const names = new Map();
    (legends.data || []).forEach((legend) => [legend.weapons?.main, legend.weapons?.secondary].forEach((item) => item?.name && names.set(item.name, item.image)));
    return [...names.keys()].sort().map((name) => ({ name, image: names.get(name) }));
  }, [legends.data]);

  const filtered = useMemo(() => {
    const list = (legends.data || []).filter((legend) => {
      if (weapon && ![legend.weapons?.main?.name, legend.weapons?.secondary?.name].includes(weapon)) return false;
      return !search || fold(legend.bio?.name?.normal).includes(fold(search));
    });
    return newestFirst ? [...list].sort((a, b) => (b.release || 0) - (a.release || 0)) : list;
  }, [legends.data, search, weapon, newestFirst]);

  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageLegends = filtered.slice((page - 1) * pageSize, page * pageSize);
  const mapList = (maps.data?.maps || []).filter((map) => !map.devOnly && !map.testLevel && map.thumbnail);
  const newest = [...(legends.data || [])].sort((a, b) => (b.release || 0) - (a.release || 0))[0];

  const sidebar = ({ close }) => (
    <>
      <SidebarHeader title="UI kit" subtitle="Dev server only." />
      <div className="space-y-2">
        {sidebarPages.map((item) => (
          <SidebarItem key={item.id} href={`#${item.id}`} active={active === item.id} onClick={() => { setActive(item.id); close(); }}>
            <div className="font-bold text-white">{item.label}</div>
            <div className="mt-1 text-xs text-slate-400">{item.note}</div>
          </SidebarItem>
        ))}
      </div>
    </>
  );

  return (
    <PageShell
      title="UI kit"
      subtitle={sidebarPages.find((item) => item.id === active)?.label}
      sidebar={sidebar}
      sidebarLabel="Sections"
      aside={(
        <>
          <AsideBox title="Right column">
            <p className="mb-2 text-xs text-slate-400">PageShell aside: sits right of the page from 1536 px (1280 px without a left sidebar) and below it on smaller screens.</p>
            <FactList rows={[{ label: 'Legends', value: legends.data?.length ?? '…' }, { label: 'Maps', value: mapList.length || '…' }, { label: 'Newest', value: newest?.bio?.name?.normal, href: newest ? legendHref(newest.bio?.name?.normal) : undefined }]} />
          </AsideBox>
          <AsideBox title="LinkList">
            <LinkList items={[{ key: 'a', label: 'Active item', active: true, count: 12 }, { key: 'b', href: '/game/legends', label: 'Link with detail', detail: 'Second line' }, { key: 'c', label: 'Button', onClick: () => setActive('states') }]} />
          </AsideBox>
          <OnThisPage items={sidebarPages.map((item) => ({ id: item.id, label: item.label }))} />
        </>
      )}
    >
      <PageHeader
        titleAs="h2"
        title="UI kit"
        meta={legends.data ? `${legends.data.length} legends · ${mapList.length} maps loaded from the local api` : 'Loading data from the local api'}
        actions={(
          <CountPills>
            <CountPill label="Legends" value={legends.data?.length ?? '…'} tone="blue" />
            <CountPill label="Maps" value={maps.data ? mapList.length : '…'} tone="emerald" />
            <CountPill label="Weapons" value={weapons.length || '…'} tone="amber" onClick={() => setWeapon('')} title="Clear the weapon filter" active={!weapon} />
          </CountPills>
        )}
      >
        <Tabs value={view} onChange={setView} items={[{ value: 'simple', label: 'Simple' }, { value: 'full', label: 'Full data' }]} />
      </PageHeader>

      <JumpNav items={[{ id: 'overview', label: 'Overview' }, { id: 'tiles', label: 'Tiles', count: filtered.length || undefined }, { id: 'states', label: 'States' }, { id: 'prices', label: 'Prices' }]} />

      <Section id="overview" title="Pills, headings and tabs" subtitle="Badges for short labels, count pills for numbers.">
        <div className="flex flex-wrap gap-2">
          {['slate', 'blue', 'emerald', 'amber', 'rose', 'sky', 'violet'].map((tone) => <Pill key={tone} tone={tone}>{tone}</Pill>)}
          <Pill tone="emerald" icon={<span aria-hidden="true">▲</span>}>Buff</Pill>
          <Pill tone="rose" icon={<span aria-hidden="true">▼</span>}>Nerf</Pill>
        </div>
        <div>
          <Heading>Small tabs</Heading>
          <Tabs variant="small" value={weapon} onChange={setWeapon} label="Weapon" items={[{ value: '', label: 'All' }, ...weapons.slice(0, 8).map((item) => ({ value: item.name, label: item.name }))]} />
        </div>
        <div>
          <Heading>Chip tabs</Heading>
          <Tabs variant="chips" value={view} onChange={setView} items={[{ value: 'simple', label: 'Simple', count: 3 }, { value: 'full', label: 'Full data', count: 42 }, { value: 'off', label: 'Disabled', disabled: true }]} />
        </div>
        <Card className="max-w-3xl">
          <div className="text-sm text-slate-300">{view === 'simple' ? 'Simple view: plain game words.' : 'Full view: the raw fields, one click away.'}</div>
          {view === 'full' && newest && <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/30 p-2 font-mono text-[11px] text-slate-400 app-scrollbar">{JSON.stringify({ id: newest.id, codeName: newest.codeName, release: newest.release }, null, 2)}</pre>}
        </Card>
      </Section>

      <FilterBar
        summary={legends.data ? `${filtered.length} of ${legends.data.length} legends` : ''}
        onReset={query || weapon || newestFirst ? () => { setQuery(''); setWeapon(''); setNewestFirst(false); setPage(1); } : undefined}
      >
        <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search legends (try “bodvar”)" />
        <SelectInput label="Weapon" value={weapon} onChange={(value) => { setWeapon(value); setPage(1); }} options={[{ value: '', label: 'Any weapon' }, ...weapons.map((item) => ({ value: item.name, label: item.name }))]} />
        <Toggle label="Newest First" checked={newestFirst} onChange={setNewestFirst} />
      </FilterBar>

      <Section id="tiles" title="Legend faces" count={legends.data ? filtered.length : undefined} collapsible actions={<span className="flex flex-wrap items-center gap-2"><ListTools filename="kit-legends" rows={filtered} columns={[{ key: 'name', label: 'Legend', value: (legend) => legend.bio?.name?.normal }, { key: 'id', label: 'Hero ID', value: (legend) => legend.id }]} /><a href={newest ? legendHref(newest.bio?.name?.normal) : '#'} className="text-xs font-bold text-blue-300 hover:underline">Newest legend</a></span>}>
        {legends.loading && !legends.data && <SkeletonGrid count={12} className="grid-cols-4 sm:grid-cols-8" tileClassName="h-16" />}
        {legends.error && <ErrorState message="Couldn't load the legends." detail={legends.error} onRetry={legends.retry} />}
        {legends.data && !filtered.length && <EmptyState title="No legends match" action={<button type="button" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700" onClick={() => { setQuery(''); setWeapon(''); }}>Clear filters</button>}>Try a shorter name or another weapon.</EmptyState>}
        {pageLegends.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pageLegends.map((legend, index) => <LegendFace key={legend.id} legend={legend} highlight={legend === newest ? 'added' : index === 1 ? 'removed' : ''} />)}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        <div>
          <Heading>Sizes</Heading>
          <div className="flex flex-wrap items-end gap-2">
            {newest && ['sm', 'md', 'lg'].map((size) => <LegendFace key={size} legend={newest} size={size} />)}
            <LegendFace name="Not a legend" />
          </div>
        </div>
        <div>
          <Heading>Image tiles</Heading>
          <TileGrid>
            {(legends.data || []).slice(0, 5).map((legend) => (
              <ImageTile key={legend.id} src={apiUrl(legend.weapons?.main?.image || '')} label={legend.weapons?.main?.name} note={`${legend.bio?.name?.normal}'s first weapon`} badge={<Pill tone="blue">New</Pill>} href={legendHref(legend.bio?.name?.normal)} />
            ))}
            <ImageTile src="" label="Missing image" note="Falls back to a blank tile" />
          </TileGrid>
        </div>
        <div>
          <Heading>Map tiles</Heading>
          {maps.loading && !maps.data && <SkeletonGrid count={6} />}
          {maps.error && <ErrorState message="Couldn't load the maps." detail={maps.error} onRetry={maps.retry} />}
          <TileGrid>
            {mapList.slice(0, shownMaps).map((map) => <MapTile key={map.name} map={map} note={map.levelSets?.[0]?.displayName ? `In ${map.levelSets.length} map pools` : ''} />)}
          </TileGrid>
          <ShowMore shown={Math.min(shownMaps, mapList.length)} total={mapList.length} onMore={setShownMaps} step={12} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mapList.slice(0, 4).map((map) => <MapTile key={map.name} map={map} size="small" />)}
          </div>
        </div>
      </Section>

      <Section id="states" title="Loading, empty and error">
        <LoadingState label="Loading legends…" rows={3} />
        <LoadingState inline label="Refreshing" />
        <EmptyState title="No matches for this filter">Clear a filter to see more.</EmptyState>
        {broken.error ? <ErrorState message="This part couldn't load." detail={broken.error} onRetry={broken.retry} /> : <LoadingState inline label="Trying a broken link" />}
      </Section>

      <Section id="prices" title="Prices" subtitle="Currency icons from the game. Event coins fall back to their name when the icon is missing." collapsible>
        <div className="flex flex-wrap items-center gap-3">
          <Price value={900} currency="gold" />
          <Price value={100} currency="mc" />
          <Price value={2500} currency="glory" />
          <Price value={140} currency="mc" strike />
          <Price value={0} currency="mc" />
          <Price value={300} currency="mc" size="lg" showName />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {['Halloween25', 'StPatricks26', 'Bloomhalla26', 'VDay25', 'Halloween26', 'Heatwave26'].map((key) => <Price key={key} value={120} currency={key} />)}
        </div>
        <PriceList prices={[{ value: 5400, currency: 'gold' }, { value: 100, currency: 'mc' }]} showName />
        <div className="flex flex-wrap gap-2">
          {weapons.slice(0, 6).map((item) => <Pill key={item.name} icon={<Img src={apiUrl(item.image || '')} className="h-4 w-4 object-contain" />}>{item.name}</Pill>)}
        </div>
      </Section>
      <Section id="data-view" title="Simple / Full data" actions={<DataViewToggle />}>
        <FullOnly fallback={<ShowFullData />}>
          <FieldTable className="max-w-3xl" rows={[['StoreID', 1929], ['Cohort', 755], ['Tags', 'Avatar:479']]} />
        </FullOnly>
        <FullOnly>
          <RawData data={{ StoreID: 1929, Cohort: 755, Tags: 'Avatar:479' }} title="Raw Data" filename="kit-sample" />
        </FullOnly>
      </Section>
    </PageShell>
  );
}
