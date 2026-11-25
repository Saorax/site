import { changelog, changelogAreas, formatChangelogDate, isRecentChange } from '../../data/changelog.js';
import { AsideBox, Card, JumpNav, LinkList, OnThisPage, PageHeader, PageShell, Pill, Section, Tabs, useQueryState } from '../ui';

const monthKey = (date) => date.slice(0, 7);
const monthLabel = (date) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

function groupByMonth(entries) {
  const months = [];
  for (const entry of entries) {
    const key = monthKey(entry.date);
    const last = months[months.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else months.push({ key, label: monthLabel(entry.date), entries: [entry] });
  }
  return months;
}

const areaNames = Object.keys(changelogAreas);

export default function ChangelogPage() {
  const [areaParam, setArea] = useQueryState('area', '');
  const area = areaNames.includes(areaParam) ? areaParam : '';
  const months = groupByMonth(changelog.filter((entry) => !area || entry.area === area));
  const monthLinks = months.map((month) => ({ id: `m-${month.key}`, label: month.label, count: month.entries.length }));
  const areaCount = (name) => changelog.filter((entry) => entry.area === name).length;
  return (
    <PageShell
      aside={(
        <>
          <AsideBox title="Area" className="hidden xl:block">
            <LinkList items={[{ key: 'all', label: 'Everything', count: changelog.length }, ...areaNames.map((name) => ({ key: name, label: name, count: areaCount(name) }))].map((item) => ({ ...item, active: (item.key === 'all' ? '' : item.key) === area, onClick: () => setArea(item.key === 'all' ? '' : item.key) }))} />
          </AsideBox>
          <OnThisPage title="Months" className="hidden xl:block" items={monthLinks} />
        </>
      )}
    >
      <PageHeader title="Changelog">
        <div className="space-y-2 xl:hidden">
          <Tabs variant="small" label="Area" value={area || 'all'} onChange={(value) => setArea(value === 'all' ? '' : value)} items={[{ value: 'all', label: 'Everything' }, ...areaNames.map((name) => ({ value: name, label: name, count: areaCount(name) }))]} />
          <JumpNav label="Months" items={monthLinks} />
        </div>
      </PageHeader>
      {months.map((month) => (
        <Section key={month.key} id={`m-${month.key}`} title={month.label} headingAs="h2">
          <ol className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3 min-[137.5rem]:grid-cols-4">
            {month.entries.map((entry) => (
              <li key={`${entry.date}-${entry.title}`}>
                <Card as="a" href={entry.href} className="block h-full transition hover:border-slate-500">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                    <time dateTime={entry.date}>{formatChangelogDate(entry.date)}</time>
                    <Pill tone={changelogAreas[entry.area] || 'slate'}>{entry.area}</Pill>
                    {isRecentChange(entry.date) && <Pill tone="emerald">New</Pill>}
                  </span>
                  <span className="mt-1.5 block font-bold text-white">{entry.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-400">{entry.text}</span>
                </Card>
              </li>
            ))}
          </ol>
        </Section>
      ))}
    </PageShell>
  );
}
