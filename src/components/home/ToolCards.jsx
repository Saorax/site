import { AsideBox, Pill, Section, cx } from '../ui';
import ToolIcon from './ToolIcon';
import { changelog, changelogAreas, formatChangelogDate, isRecentChange } from '../../data/changelog';

export const sectionTones = {
  competitive: { section: 'amber', icon: 'bg-amber-500/15 text-amber-200 ring-amber-400/30', hover: 'hover:border-amber-400/60' },
  game: { section: 'blue', icon: 'bg-blue-500/15 text-blue-200 ring-blue-400/30', hover: 'hover:border-blue-400/60' },
  ranked: { section: 'emerald', icon: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30', hover: 'hover:border-emerald-400/60' },
  bifrost: { section: 'violet', icon: 'bg-violet-500/15 text-violet-200 ring-violet-400/30', hover: 'hover:border-violet-400/60' },
};

export function ToolCard({ tool, tone = sectionTones.game, size = 'normal', note = '' }) {
  return (
    <a
      href={tool.href}
      className={cx(
        'group flex min-w-0 gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 transition focus-visible:border-blue-400 focus-visible:outline-none',
        tone.hover,
        size === 'large' && 'sm:p-3',
      )}
    >
      <span className={cx('grid shrink-0 place-items-center rounded-lg ring-1', tone.icon, size === 'large' ? 'h-11 w-11' : 'h-9 w-9')}>
        <ToolIcon name={tool.icon} className={size === 'large' ? 'h-6 w-6' : 'h-5 w-5'} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-bold text-white">
          {tool.title}
          <span className="text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-300" aria-hidden="true">→</span>
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-slate-400">{tool.text}</span>
        {note && <span className="mt-1 block text-xs font-bold text-amber-300">{note}</span>}
      </span>
    </a>
  );
}

export function ToolGroup({ section, columns = 'sm:grid-cols-2 lg:grid-cols-4', size, headingAs = 'h2' }) {
  const tone = sectionTones[section.key] || sectionTones.game;
  const hubListed = section.tools.some((tool) => tool.href === section.href);
  return (
    <Section
      id={section.key}
      title={section.title}
      subtitle={section.blurb}
      tone={tone.section}
      headingAs={headingAs}
      actions={!hubListed && section.href && (
        <a href={section.href} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">{section.hubLabel} →</a>
      )}
    >
      <div className={cx('grid gap-2', columns)}>
        {section.tools.map((tool) => <ToolCard key={tool.href} tool={tool} tone={tone} size={size} />)}
      </div>
    </Section>
  );
}

export function WhatsNew({ limit = 5, area, now = Date.now(), className = '', listClassName = 'space-y-0.5' }) {
  const entries = changelog.filter((entry) => !area || entry.area === area).slice(0, limit);
  if (!entries.length) return null;
  return (
    <AsideBox title="What's new" href="/changelog" linkLabel="Changelog" className={className}>
      <ol className={cx('-mx-1', listClassName)}>
        {entries.map((entry) => (
          <li key={`${entry.date}-${entry.title}`}>
            <a href={entry.href} className="block rounded-lg px-1 py-1.5 transition hover:bg-slate-800/70">
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                <time dateTime={entry.date}>{formatChangelogDate(entry.date)}</time>
                {!area && <Pill tone={changelogAreas[entry.area] || 'slate'}>{entry.area}</Pill>}
                {isRecentChange(entry.date, now) && <Pill tone="emerald">New</Pill>}
              </span>
              <span className="mt-0.5 block text-sm font-bold text-white">{entry.title}</span>
              <span className="line-clamp-2 block text-xs leading-snug text-slate-400">{entry.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </AsideBox>
  );
}
